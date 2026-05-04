import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { randomUUID } from "crypto";
import { constants, accessSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { homedir } from "os";
import { basename, dirname, join } from "path";
import { Readable, Writable } from "stream";
import * as acp from "@agentclientprotocol/sdk";
import { applyCodexBridgeEnv, buildCodexConfigArgs, shouldSetRequestedMode } from "./codex";
import { commandAvailable, createToolDiagnostics, withCodexStandardTooling, withManagedPath } from "./tool-env";
import type {
  AgentRecord,
  AgentRuntimeConfig,
  AskResult,
  DoctorResult,
  OutputEntry,
  PendingPermission,
  StartAgentInput,
} from "./types";
import { RuntimeHttpError } from "./types";

const MAX_STDERR_LINES = 50;
const ENDPOINT_TIMEOUT_MS = 5000;

type EnvLike = Record<string, string | undefined>;

type EndpointCheckResult = {
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  errorCode: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function updateContextUsage(record: AgentRecord, patch: Partial<NonNullable<AgentRecord["contextUsage"]>>) {
  const existing: NonNullable<AgentRecord["contextUsage"]> = record.contextUsage ?? {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    maxTokens: null,
    fullnessPercent: null,
  };
  const inputTokens = finiteNumber(patch.inputTokens) ?? existing.inputTokens ?? null;
  const outputTokens = finiteNumber(patch.outputTokens) ?? existing.outputTokens ?? null;
  const totalTokens = finiteNumber(patch.totalTokens) ?? existing.totalTokens ?? null;
  const maxTokens = finiteNumber(patch.maxTokens) ?? existing.maxTokens ?? null;
  const explicitFullnessPercent = finiteNumber(patch.fullnessPercent);
  const fullnessPercent = explicitFullnessPercent ?? (
    totalTokens !== null && maxTokens !== null && maxTokens > 0
      ? Math.min(100, Math.max(0, (totalTokens / maxTokens) * 100))
      : existing.fullnessPercent ?? null
  );

  record.contextUsage = {
    inputTokens,
    outputTokens,
    totalTokens,
    maxTokens,
    fullnessPercent,
  };
}

function applyPromptUsage(record: AgentRecord, usage: unknown) {
  const payload = asRecord(usage);
  if (!payload) {
    return;
  }

  updateContextUsage(record, {
    inputTokens: finiteNumber(payload.inputTokens),
    outputTokens: finiteNumber(payload.outputTokens),
    totalTokens: finiteNumber(payload.totalTokens),
  });
}

function applySessionUsageUpdate(record: AgentRecord, update: Record<string, unknown>) {
  const used = finiteNumber(update.used);
  const size = finiteNumber(update.size);
  if (used === null || size === null || size <= 0) {
    return false;
  }

  updateContextUsage(record, {
    totalTokens: used,
    maxTokens: size,
    fullnessPercent: Math.min(100, Math.max(0, (used / size) * 100)),
  });
  return true;
}

function expandHomePath(input: string, env: EnvLike = process.env) {
  if (input.startsWith("~/")) {
    return join(env.HOME || homedir(), input.slice(2));
  }
  return input;
}

function asStringArray(value: unknown, field: string): string[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new RuntimeHttpError(400, `${field} must be an array of non-empty strings.`);
  }
  return value.map((item) => item.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeMcpServers(value: unknown, field: string): acp.McpServer[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RuntimeHttpError(400, `${field} must be an array.`);
  }

  return value.map((item, index) => {
    const record = asRecord(item);
    if (!record) {
      throw new RuntimeHttpError(400, `${field}[${index}] must be an object.`);
    }
    if (record.type !== "stdio" && record.type !== "http" && record.type !== "sse") {
      throw new RuntimeHttpError(400, `${field}[${index}].type must be stdio, http, or sse.`);
    }
    if (typeof record.name !== "string" || record.name.trim().length === 0) {
      throw new RuntimeHttpError(400, `${field}[${index}].name is required.`);
    }

    if (record.type === "stdio") {
      if (typeof record.command !== "string" || record.command.trim().length === 0) {
        throw new RuntimeHttpError(400, `${field}[${index}].command is required for stdio MCP servers.`);
      }
      return {
        type: "stdio",
        name: record.name.trim(),
        command: record.command.trim(),
        args: asStringArray(record.args, `${field}[${index}].args`),
        env: normalizeNameValueList(record.env, `${field}[${index}].env`),
        ...(record._meta != null ? { _meta: record._meta as Record<string, unknown> } : {}),
      };
    }

    if (typeof record.url !== "string" || record.url.trim().length === 0) {
      throw new RuntimeHttpError(400, `${field}[${index}].url is required for ${record.type} MCP servers.`);
    }
    return {
      type: record.type,
      name: record.name.trim(),
      url: record.url.trim(),
      headers: normalizeNameValueList(record.headers, `${field}[${index}].headers`),
      ...(record._meta != null ? { _meta: record._meta as Record<string, unknown> } : {}),
    } as acp.McpServer;
  });
}

function normalizeNameValueList(value: unknown, field: string): Array<{ name: string; value: string; _meta?: Record<string, unknown> | null }> {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RuntimeHttpError(400, `${field} must be an array.`);
  }
  return value.map((item, index) => {
    const record = asRecord(item);
    if (!record || typeof record.name !== "string" || typeof record.value !== "string") {
      throw new RuntimeHttpError(400, `${field}[${index}] must include string name and value.`);
    }
    return {
      name: record.name,
      value: record.value,
      ...(record._meta != null ? { _meta: record._meta as Record<string, unknown> } : {}),
    };
  });
}

function executableExists(filePath: string) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command: string, env: EnvLike): boolean {
  const expanded = expandHomePath(command, env);
  return expanded.includes("/") ? executableExists(expanded) : commandAvailable(expanded, { env });
}

function pushStderrLine(buffer: string[], line: string) {
  const normalized = line.trim();
  if (!normalized) {
    return;
  }
  buffer.push(normalized);
  if (buffer.length > MAX_STDERR_LINES) {
    buffer.splice(0, buffer.length - MAX_STDERR_LINES);
  }
}

function createOutputEntry(input: Omit<OutputEntry, "id" | "timestamp"> & { timestamp?: string }): OutputEntry {
  return {
    id: randomUUID(),
    timestamp: input.timestamp ?? nowIso(),
    type: input.type,
    text: input.text,
    toolCallId: input.toolCallId,
    toolKind: input.toolKind,
    status: input.status,
    raw: input.raw,
  };
}

function appendOutputEntry(record: AgentRecord, input: Omit<OutputEntry, "id" | "timestamp"> & { timestamp?: string }) {
  record.activeOutputEntryId = null;
  record.outputEntries.push(createOutputEntry(input));
}

function appendMessageChunk(record: AgentRecord, text: string, type: "message" | "thought") {
  const activeEntry = record.activeOutputEntryId
    ? record.outputEntries.find((entry) => entry.id === record.activeOutputEntryId)
    : null;

  if (activeEntry && activeEntry.type === type) {
    activeEntry.text += text;
    return;
  }

  const entry = createOutputEntry({ type, text });
  record.outputEntries.push(entry);
  record.activeOutputEntryId = entry.id;
}

function summarizeToolCallUpdate(update: Record<string, unknown>) {
  const contentSummary = Array.isArray(update.content)
    ? update.content
        .map((item) => {
          const record = asRecord(item);
          const content = asRecord(record?.content);
          if (record?.type === "content" && content?.type === "text" && typeof content.text === "string") {
            return content.text;
          }
          if (record?.type === "content" && content?.type) {
            return `[${content.type}]`;
          }
          return "";
        })
        .filter(Boolean)
        .join(" ")
    : "";

  const toolCallId = typeof update.toolCallId === "string" ? update.toolCallId : "";
  const status = typeof update.status === "string" ? update.status : "updated";
  const base = `Tool call ${toolCallId} ${status}`.trim();
  return contentSummary ? `${base}: ${contentSummary}` : base;
}

function renderOutputEntries(entries: OutputEntry[]) {
  return entries
    .map((entry) => {
      switch (entry.type) {
        case "message":
          return entry.text;
        case "thought":
          return `Thought: ${entry.text}`;
        case "tool_call":
          return `Tool${entry.toolKind ? ` ${entry.toolKind}` : ""}${entry.status ? ` (${entry.status})` : ""}: ${entry.text}`;
        case "tool_call_update":
          return `${entry.status ? `Tool update (${entry.status})` : "Tool update"}: ${entry.text}`;
        case "permission":
          return `Permission: ${entry.text}`;
        default:
          return entry.text;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

function selectTextFileRange(content: string, line?: number | null, limit?: number | null) {
  if (line == null && limit == null) {
    return content;
  }

  const lines = content.match(/[^\n]*\n|[^\n]+/g) ?? [];
  const start = Math.max(0, (line ?? 1) - 1);
  const end = limit == null ? undefined : start + Math.max(0, limit);
  return lines.slice(start, end).join("");
}

function sanitizePathPart(input: string) {
  const sanitized = input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "skill";
}

function discoverSkillDirs(skillRoot: string, env: EnvLike): string[] {
  const expanded = expandHomePath(skillRoot, env);
  if (!existsSync(expanded)) {
    throw new RuntimeHttpError(400, `skill root not found: ${skillRoot}`);
  }
  if (!statSync(expanded).isDirectory()) {
    throw new RuntimeHttpError(400, `skill root is not a directory: ${skillRoot}`);
  }
  if (existsSync(join(expanded, "SKILL.md"))) {
    return [expanded];
  }
  return readdirSync(expanded, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => join(expanded, entry.name))
    .filter((candidate) => existsSync(join(candidate, "SKILL.md")));
}

function materializeSkillRoots(cwd: string, workerName: string, skillRoots: string[], env: EnvLike): string[] {
  if (skillRoots.length === 0) {
    return [];
  }

  const skillsDir = join(cwd, ".agents", "skills");
  mkdirSync(skillsDir, { recursive: true });
  const createdLinks: string[] = [];
  try {
    for (const skillRoot of skillRoots) {
      const skillDirs = discoverSkillDirs(skillRoot, env);
      if (skillDirs.length === 0) {
        throw new RuntimeHttpError(400, `skill root contains no skill directories: ${skillRoot}`);
      }
      for (const skillDir of skillDirs) {
        const linkBase = `omniharness-${sanitizePathPart(workerName)}-${sanitizePathPart(basename(skillDir))}`;
        let linkPath = join(skillsDir, linkBase);
        let suffix = 2;
        while (existsSync(linkPath)) {
          linkPath = join(skillsDir, `${linkBase}-${suffix}`);
          suffix += 1;
        }
        symlinkSync(skillDir, linkPath, "dir");
        createdLinks.push(linkPath);
      }
    }
    return createdLinks;
  } catch (error) {
    cleanupSkillLinks(createdLinks);
    throw error;
  }
}

function cleanupSkillLinks(linkPaths: string[]) {
  for (const linkPath of linkPaths) {
    try {
      if (lstatSync(linkPath).isSymbolicLink()) {
        rmSync(linkPath, { force: true, recursive: true });
      }
    } catch {
      // Best-effort cleanup for worker-scoped temporary skill links.
    }
  }
}

function describeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isInitializeMethodNotFound(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const record = error as { message?: unknown; data?: { method?: unknown } | null };
  const message = typeof record.message === "string" ? record.message : "";
  const method = typeof record.data?.method === "string" ? record.data.method : "";
  return /\bmethod not found\b/i.test(message) && (/\binitialize\b/i.test(message) || method === "initialize");
}

function normalizeAgentStartupError(input: { type: string; command: string; error: unknown; stderrBuffer: string[] }) {
  if (input.error instanceof RuntimeHttpError) {
    return input.error;
  }

  const details = {
    command: input.command,
    recentStderr: [...input.stderrBuffer],
    rawError: input.error,
  };

  if (isInitializeMethodNotFound(input.error)) {
    const commandLabel = input.command.includes("/") ? input.command : `"${input.command}"`;
    const typeSpecificHint =
      input.type === "codex"
        ? "Install codex-acp or configure an ACP-compatible Codex command."
        : "Configure an ACP-compatible command for this worker.";
    return new RuntimeHttpError(
      400,
      `${commandLabel} rejected ACP initialize. This command speaks MCP, not ACP. ${typeSpecificHint}`,
      details,
    );
  }

  return new RuntimeHttpError(
    400,
    `failed to start ${input.type} agent via ${input.command}: ${describeUnknownError(input.error)}`,
    details,
  );
}

function getTypeBaseUrl(type: string, env: EnvLike) {
  if (type === "codex") return env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (type === "claude") return env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  if (type === "gemini") return env.GOOGLE_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  return null;
}

function getApiKeyValue(type: string, env: EnvLike) {
  if (type === "codex") return env.OPENAI_API_KEY?.trim() || null;
  if (type === "claude") return env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim() || null;
  if (type === "gemini") return env.GEMINI_API_KEY?.trim() || null;
  return null;
}

function getApiKeyRequirement(type: string) {
  void type;
  return { required: false, message: null as string | null };
}

function endpointCheck(urlString: string): Promise<EndpointCheckResult> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      resolve({ reachable: false, statusCode: null, latencyMs: null, errorCode: "EINVAL" });
      return;
    }

    const start = Date.now();
    const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = requestImpl(
      {
        method: "HEAD",
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
      },
      (res) => {
        res.resume();
        res.once("end", () => {
          resolve({
            reachable: res.statusCode !== null,
            statusCode: res.statusCode ?? null,
            latencyMs: Date.now() - start,
            errorCode: null,
          });
        });
      },
    );

    req.setTimeout(ENDPOINT_TIMEOUT_MS, () => {
      req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    });
    req.once("error", (error: NodeJS.ErrnoException) => {
      resolve({ reachable: false, statusCode: null, latencyMs: null, errorCode: error.code || "UNKNOWN" });
    });
    req.end();
  });
}

class RuntimeClient implements acp.Client {
  constructor(
    private readonly getRecord: () => AgentRecord | undefined,
    private readonly publishChunk: (name: string, chunk: string) => void,
  ) {}

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const record = this.getRecord();
    if (!record) {
      return { outcome: { outcome: "cancelled" } };
    }
    record.updatedAt = nowIso();
    record.state = "working";
    appendOutputEntry(record, {
      type: "permission",
      text: `Permission requested${params.options.length > 0 ? `: ${params.options.map((option) => `${option.kind} ${option.name}`).join(", ")}` : ""}`,
      status: "pending",
      raw: params,
    });
    return new Promise((resolve) => {
      record.pendingPermissions.push({
        requestId: nextPermissionRequestId++,
        params,
        requestedAt: nowIso(),
        resolve,
      });
    });
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    const content = await readFile(params.path, "utf8");
    return {
      content: selectTextFileRange(content, params.line, params.limit),
    };
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    await mkdir(dirname(params.path), { recursive: true });
    await writeFile(params.path, params.content, "utf8");
    return {};
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const record = this.getRecord();
    if (!record) {
      return;
    }
    const update = asRecord(params.update);
    if (!update) {
      return;
    }
    record.updatedAt = nowIso();

    if (update.sessionUpdate === "usage_update") {
      applySessionUsageUpdate(record, update);
      return;
    }

    if (update.sessionUpdate === "agent_message_chunk") {
      const content = asRecord(update.content);
      const text = content?.type === "text" && typeof content.text === "string" ? content.text : "";
      if (text) {
        record.currentText += text;
        record.lastText = record.currentText;
        appendMessageChunk(record, text, "message");
        this.publishChunk(record.name, text);
      }
      return;
    }

    if (update.sessionUpdate === "agent_thought_chunk") {
      const content = asRecord(update.content);
      const text = content?.type === "text" && typeof content.text === "string" ? content.text : "";
      if (text) {
        appendMessageChunk(record, text, "thought");
      }
      return;
    }

    if (update.sessionUpdate === "tool_call") {
      record.state = "working";
      appendOutputEntry(record, {
        type: "tool_call",
        text: typeof update.title === "string" && update.title.trim().length > 0
          ? update.title
          : typeof update.kind === "string"
            ? update.kind
            : "Tool call started",
        toolCallId: typeof update.toolCallId === "string" ? update.toolCallId : undefined,
        toolKind: typeof update.kind === "string" ? update.kind : undefined,
        status: typeof update.status === "string" ? update.status : undefined,
        raw: update,
      });
      return;
    }

    if (update.sessionUpdate === "tool_call_update") {
      appendOutputEntry(record, {
        type: "tool_call_update",
        text: summarizeToolCallUpdate(update),
        toolCallId: typeof update.toolCallId === "string" ? update.toolCallId : undefined,
        status: typeof update.status === "string" ? update.status : undefined,
        raw: update,
      });
    }
  }
}

let nextPermissionRequestId = 1;

export class AgentRuntimeManager {
  readonly agents = new Map<string, AgentRecord>();
  private readonly chunkSubscribers = new Map<string, Set<(chunk: string) => void>>();

  constructor(
    private readonly options: {
      config?: AgentRuntimeConfig;
      env?: EnvLike;
    } = {},
  ) {}

  toStatus(record: AgentRecord) {
    return {
      name: record.name,
      type: record.type,
      cwd: record.cwd,
      state: record.state,
      sessionId: record.sessionId,
      protocolVersion: record.protocolVersion,
      requestedModel: record.requestedModel,
      effectiveModel: record.effectiveModel,
      requestedEffort: record.requestedEffort,
      effectiveEffort: record.effectiveEffort,
      sessionMode: record.sessionMode,
      contextUsage: record.contextUsage,
      lastError: record.lastError,
      recentStderr: [...record.stderrBuffer],
      stderrBuffer: [...record.stderrBuffer],
      lastText: record.lastText,
      currentText: record.currentText,
      renderedOutput: renderOutputEntries(record.outputEntries),
      outputEntries: record.outputEntries.map((entry) => ({ ...entry })),
      stopReason: record.stopReason,
      pendingPermissions: record.pendingPermissions.map((item) => ({
        requestId: item.requestId,
        requestedAt: item.requestedAt,
        sessionId: item.params.sessionId,
        options: item.params.options.map((option) => ({
          optionId: option.optionId,
          kind: option.kind,
          name: option.name,
        })),
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  listAgents() {
    return Array.from(this.agents.values()).map((agent) => this.toStatus(agent));
  }

  getAgent(name: string) {
    const record = this.agents.get(name);
    return record ? this.toStatus(record) : null;
  }

  async startAgent(input: StartAgentInput) {
    const type = input.type?.trim() || "opencode";
    const name = input.name?.trim();
    if (!name) {
      throw new RuntimeHttpError(400, "Agent name is required");
    }

    const cwd = input.cwd || process.cwd();
    const existing = this.agents.get(name);
    if (existing) {
      if (
        input.resumeSessionId
        && existing.sessionId === input.resumeSessionId
        && existing.type === type
        && existing.cwd === cwd
      ) {
        return this.toStatus(existing);
      }
      throw new RuntimeHttpError(400, `Agent already exists: ${name}`);
    }

    const requestedModel = input.model?.trim() || null;
    const requestedEffort = input.effort?.trim().toLowerCase() || null;
    const configuredAgent = this.options.config?.agents?.[type];
    const baseEnv = this.options.env || process.env;
    const skillRoots = [
      ...asStringArray(configuredAgent?.skillRoots, `agents.${type}.skillRoots`),
      ...asStringArray(input.skillRoots, "skillRoots"),
    ];
    const mcpServers = [
      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
    ];

    let defaultArgs: string[] = [];
    if (type === "opencode") {
      defaultArgs = ["acp"];
      if (requestedModel) {
        defaultArgs.push("--model", requestedModel);
      }
    } else if (type === "codex") {
      defaultArgs = buildCodexConfigArgs({
        model: requestedModel,
        effort: requestedEffort,
      });
    }
    const configuredArgs = configuredAgent?.args && configuredAgent.args.length > 0 ? configuredAgent.args : undefined;
    const requestedArgs = input.args && input.args.length > 0 ? input.args : undefined;
    const finalEnv = withManagedPath({
      ...baseEnv,
      ...(configuredAgent?.env || {}),
      ...(input.env || {}),
    }, cwd);

    if (type === "codex") {
      Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
      Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
    }

    const recordRef: { current?: AgentRecord } = {};
    const stderrBuffer: string[] = [];
    const client = new RuntimeClient(() => recordRef.current, (agentName, chunk) => this.publishChunk(agentName, chunk));
    const defaultCommand = input.command || configuredAgent?.command || type;
    const defaultArgsList = requestedArgs || configuredArgs || defaultArgs;
    const useCodexFallback = type === "codex" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useClaudeDefault = type === "claude" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useGeminiDefault = type === "gemini" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const candidates = (useCodexFallback
      ? [{ command: "codex-acp", args: [] as string[] }]
      : useClaudeDefault
        ? [{ command: "claude-agent-acp", args: [] as string[] }]
        : useGeminiDefault
          ? [{ command: "gemini", args: ["--experimental-acp", ...(requestedModel ? ["--model", requestedModel] : [])] as string[] }]
          : [{ command: defaultCommand, args: defaultArgsList }])
      .filter((candidate) => commandExists(candidate.command, finalEnv));

    if (candidates.length === 0) {
      if (type === "codex" && !input.command && !configuredAgent?.command) {
        if (commandExists("codex", finalEnv)) {
          throw new RuntimeHttpError(400, "codex on PATH is MCP-only and cannot be used by OmniHarness runtime. Install codex-acp or configure an ACP-compatible Codex command.");
        }
        throw new RuntimeHttpError(400, "codex-acp binary not found on PATH. Install codex-acp or configure an ACP-compatible Codex command.");
      }
      throw new RuntimeHttpError(400, `No runnable command is available for worker type "${type}".`);
    }

    const managedSkillLinks = materializeSkillRoots(cwd, name, skillRoots, finalEnv);
    let child: ChildProcessWithoutNullStreams | undefined;
    let connection: acp.ClientSideConnection | undefined;
    let init: unknown;
    let session: unknown;
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const result = await this.spawnAgentConnection({
          cwd,
          command: expandHomePath(candidate.command, finalEnv),
          args: candidate.args,
          env: finalEnv as NodeJS.ProcessEnv,
          mcpServers,
          skillRoots,
          resumeSessionId: input.resumeSessionId,
          getClient: () => client,
          onStderrLine: (line) => {
            pushStderrLine(stderrBuffer, line);
            if (recordRef.current) {
              recordRef.current.updatedAt = nowIso();
            }
          },
        });
        child = result.child;
        connection = result.connection;
        init = result.init;
        session = result.session;
        break;
      } catch (error) {
        lastError = normalizeAgentStartupError({ type, command: candidate.command, error, stderrBuffer });
      }
    }

    if (!child || !connection || !session) {
      cleanupSkillLinks(managedSkillLinks);
      throw normalizeAgentStartupError({ type, command: defaultCommand, error: lastError ?? new Error("failed to start agent"), stderrBuffer });
    }

    const requestedMode = input.mode || configuredAgent?.mode;
    const sessionRecord = asRecord(session);
    const sessionId = asNonEmptyString(sessionRecord?.sessionId);
    if (!sessionId) {
      cleanupSkillLinks(managedSkillLinks);
      throw new RuntimeHttpError(500, "Agent session did not include a session id.");
    }

    const modesRecord = asRecord(sessionRecord?.modes);
    const currentModeId = asNonEmptyString(modesRecord?.currentModeId);
    if (connection && shouldSetRequestedMode(requestedMode, currentModeId)) {
      try {
        const setModeParams = {
          sessionId,
          modeId: requestedMode,
        } as Parameters<acp.ClientSideConnection["setSessionMode"]>[0];
        await connection.setSessionMode(setModeParams);
      } catch (modeError: unknown) {
        process.stderr.write(`[${name}] setSessionMode("${requestedMode}") failed: ${describeUnknownError(modeError)}\n`);
      }
    }

    const created = nowIso();
    const initRecord = asRecord(init);
    const protocolVersion = typeof initRecord?.protocolVersion === "number" || typeof initRecord?.protocolVersion === "string"
      ? initRecord.protocolVersion
      : null;
    const record: AgentRecord = {
      name,
      type,
      cwd,
      child,
      connection,
      sessionId,
      state: "idle",
      lastError: null,
      stderrBuffer,
      protocolVersion,
      requestedModel,
      effectiveModel: requestedModel,
      requestedEffort,
      effectiveEffort: null,
      sessionMode: requestedMode || null,
      contextUsage: null,
      lastText: "",
      currentText: "",
      activeOutputEntryId: null,
      outputEntries: [],
      stopReason: null,
      pendingPermissions: [],
      activeTask: null,
      managedSkillLinks,
      createdAt: created,
      updatedAt: created,
    };
    recordRef.current = record;
    this.agents.set(name, record);

    child.on("exit", (code, signal) => {
      const target = this.agents.get(name);
      if (!target) {
        return;
      }
      this.cancelAllPendingPermissions(target);
      cleanupSkillLinks(target.managedSkillLinks);
      target.updatedAt = nowIso();
      target.state = target.state === "error" ? "error" : "stopped";
      target.lastError = target.lastError ?? `exit code=${code} signal=${signal}`;
    });

    return this.toStatus(record);
  }

  async stopAgent(name: string) {
    const record = this.agents.get(name);
    if (!record) {
      return false;
    }
    try {
      this.cancelAllPendingPermissions(record);
      cleanupSkillLinks(record.managedSkillLinks);
      record.state = "stopped";
      record.updatedAt = nowIso();
      record.child.kill("SIGTERM");
    } finally {
      this.agents.delete(name);
    }
    return true;
  }

  async askAgent(name: string, prompt: string, onChunk?: (chunk: string) => void): Promise<AskResult> {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, `Agent not found: ${name}`);
    }
    if (record.state === "working") {
      throw new RuntimeHttpError(409, `Agent is busy: ${name}`);
    }
    record.state = "working";
    record.updatedAt = nowIso();
    record.currentText = "";
    record.activeOutputEntryId = null;
    record.lastError = null;
    record.stopReason = null;
    const unsubscribe = onChunk ? this.subscribeChunks(name, onChunk) : null;

    try {
      const promptParams = {
        sessionId: record.sessionId,
        prompt: [{ type: "text", text: prompt }],
      } as Parameters<acp.ClientSideConnection["prompt"]>[0];
      const response = await record.connection.prompt(promptParams);
      const responseRecord = asRecord(response);
      record.stopReason = typeof responseRecord?.stopReason === "string" ? responseRecord.stopReason : null;
      applyPromptUsage(record, responseRecord?.usage);
      record.lastText = record.currentText;
      record.state = "idle";
      record.updatedAt = nowIso();
      return {
        name,
        state: record.state,
        stopReason: record.stopReason,
        response: record.lastText,
      };
    } catch (error) {
      record.state = "error";
      record.lastError = describeUnknownError(error);
      record.updatedAt = nowIso();
      throw error;
    } finally {
      unsubscribe?.();
    }
  }

  async cancelAgentTurn(name: string) {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, "not_found");
    }
    const cancelParams = { sessionId: record.sessionId } as Parameters<acp.ClientSideConnection["cancel"]>[0];
    await record.connection.cancel(cancelParams);
    const cancelledPermissions = this.cancelAllPendingPermissions(record);
    record.updatedAt = nowIso();
    if (record.state === "working") {
      record.state = "idle";
    }
    return { ok: true, name: record.name, cancelledPermissions };
  }

  async setMode(name: string, mode: string) {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, "not_found");
    }
    const setModeParams = { sessionId: record.sessionId, modeId: mode } as Parameters<acp.ClientSideConnection["setSessionMode"]>[0];
    await record.connection.setSessionMode(setModeParams);
    record.sessionMode = mode;
    record.updatedAt = nowIso();
    return { ok: true, name: record.name, mode };
  }

  approvePermission(name: string, optionId?: string) {
    return this.resolvePermission(name, "approve", optionId);
  }

  denyPermission(name: string, optionId?: string) {
    return this.resolvePermission(name, "deny", optionId);
  }

  async doctor() {
    const types = ["codex", "claude", "gemini", "opencode"];
    const results = await Promise.all(types.map((type) => this.runDoctorForType(type)));
    return { results };
  }

  private async spawnAgentConnection(input: {
    cwd: string;
    command: string;
    args: string[];
    env: NodeJS.ProcessEnv;
    mcpServers: acp.McpServer[];
    skillRoots: string[];
    resumeSessionId?: string;
    getClient: () => acp.Client;
    onStderrLine?: (line: string) => void;
  }) {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(input.command, input.args, {
        cwd: input.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: input.env,
      });
    } catch (error) {
      throw new RuntimeHttpError(400, `failed to spawn agent process: ${describeUnknownError(error)}`);
    }

    const processFailure = new Promise<never>((_, reject) => {
      child.once("error", (error) => {
        reject(new RuntimeHttpError(400, `failed to spawn agent process: ${error.message}`));
      });
      child.once("exit", (code, signal) => {
        reject(new RuntimeHttpError(400, `agent process exited before ACP startup completed (code=${code}, signal=${signal})`));
      });
    });

    child.stderr.on("data", (data) => {
      const lines = data
        .toString("utf8")
        .split(/\r?\n/g)
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);
      for (const line of lines) {
        input.onStderrLine?.(line);
      }
    });

    const stream = acp.ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    );
    const connection = new acp.ClientSideConnection(input.getClient, stream);
    try {
      const initializeParams = {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
      } as Parameters<acp.ClientSideConnection["initialize"]>[0];
      const init = await Promise.race([
        connection.initialize(initializeParams),
        processFailure,
      ]);
      const sessionSetupParams = {
        cwd: input.cwd,
        mcpServers: input.mcpServers,
        ...(input.skillRoots.length > 0 ? { _meta: { "omniharness/skillRoots": input.skillRoots } } : {}),
      } as Parameters<acp.ClientSideConnection["newSession"]>[0];
      const session = input.resumeSessionId
        ? await this.resumeOrLoadSession(connection, input.resumeSessionId, sessionSetupParams, processFailure)
        : await Promise.race([connection.newSession(sessionSetupParams), processFailure]);
      return { child, connection, init, session };
    } catch (error) {
      child.kill("SIGTERM");
      throw error;
    }
  }

  private async resumeOrLoadSession(
    connection: acp.ClientSideConnection,
    sessionId: string,
    sessionSetupParams: Parameters<acp.ClientSideConnection["newSession"]>[0],
    spawnError: Promise<never>,
  ) {
    try {
      const resumeParams = { sessionId } as Parameters<acp.ClientSideConnection["unstable_resumeSession"]>[0];
      return await Promise.race([
        connection.unstable_resumeSession(resumeParams),
        spawnError,
      ]);
    } catch {
      const loadParams = {
        sessionId,
        ...sessionSetupParams,
      } as Parameters<acp.ClientSideConnection["loadSession"]>[0];
      return await Promise.race([
        connection.loadSession(loadParams),
        spawnError,
      ]);
    }
  }

  private subscribeChunks(name: string, callback: (chunk: string) => void) {
    const set = this.chunkSubscribers.get(name) || new Set<(chunk: string) => void>();
    set.add(callback);
    this.chunkSubscribers.set(name, set);
    return () => {
      const current = this.chunkSubscribers.get(name);
      if (!current) {
        return;
      }
      current.delete(callback);
      if (current.size === 0) {
        this.chunkSubscribers.delete(name);
      }
    };
  }

  private publishChunk(name: string, chunk: string) {
    const subscribers = this.chunkSubscribers.get(name);
    if (!subscribers || subscribers.size === 0) {
      return;
    }
    for (const callback of subscribers) {
      callback(chunk);
    }
  }

  private cancelAllPendingPermissions(record: AgentRecord) {
    let count = 0;
    while (this.resolvePendingPermission(record, "cancel")) {
      count += 1;
    }
    return count;
  }

  private resolvePermission(name: string, decision: "approve" | "deny", explicitOptionId?: string) {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, "not_found");
    }
    const pending = this.resolvePendingPermission(record, decision, explicitOptionId);
    if (!pending) {
      throw new RuntimeHttpError(409, "no_pending_permissions");
    }
    return {
      ok: true,
      name: record.name,
      action: decision,
      requestId: pending.requestId,
      pendingPermissions: record.pendingPermissions.length,
    };
  }

  private resolvePendingPermission(record: AgentRecord, decision: "approve" | "deny" | "cancel", explicitOptionId?: string): PendingPermission | null {
    const pending = record.pendingPermissions.shift();
    if (!pending) {
      return null;
    }

    if (decision === "cancel") {
      pending.resolve({ outcome: { outcome: "cancelled" } });
    } else {
      const optionId = this.findPermissionOptionId(pending.params, decision, explicitOptionId);
      pending.resolve(optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } });
    }
    record.updatedAt = nowIso();
    return pending;
  }

  private findPermissionOptionId(params: acp.RequestPermissionRequest, mode: "approve" | "deny", explicitOptionId?: string) {
    if (explicitOptionId && params.options.some((option) => option.optionId === explicitOptionId)) {
      return explicitOptionId;
    }
    const preferred = mode === "approve"
      ? params.options.find((option) => option.kind.startsWith("allow"))
      : params.options.find((option) => option.kind.startsWith("reject"));
    return preferred?.optionId ?? params.options[0]?.optionId ?? null;
  }

  private async runDoctorForType(type: string): Promise<DoctorResult> {
    const baseEnv = this.options.env || process.env;
    const env = withManagedPath(baseEnv);
    const commandHint =
      type === "codex"
        ? "codex-acp"
        : type === "claude"
          ? "claude-agent-acp"
          : type === "gemini"
            ? "gemini"
            : "opencode";
    const binary = commandExists(commandHint, env);
    let endpoint: boolean | null = null;
    let message = binary ? undefined : `${commandHint} binary not found on PATH`;
    const keyRequirement = getApiKeyRequirement(type);
    const apiKey = keyRequirement.required ? Boolean(getApiKeyValue(type, env)) : null;

    if (binary && (apiKey === null || apiKey)) {
      const baseUrl = getTypeBaseUrl(type, env);
      if (baseUrl) {
        const endpointResult = await endpointCheck(baseUrl);
        endpoint = endpointResult.reachable;
        if (!endpoint && !message) {
          message = `Endpoint ${baseUrl} is unreachable (${endpointResult.errorCode || "UNKNOWN"})`;
        }
      }
    }

    return {
      type,
      status: binary && (endpoint !== false) ? "ok" : "warning",
      binary,
      apiKey,
      endpoint,
      tools: createToolDiagnostics({ env }),
      ...(message ? { message } : {}),
    };
  }
}
