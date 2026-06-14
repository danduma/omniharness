import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { constants, accessSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { homedir } from "os";
import { basename, dirname, join } from "path";
import { Readable, Writable } from "stream";
import * as acp from "@agentclientprotocol/sdk";
import { sanitizeAcpStream } from "./acp-stream-sanitizer";
import { applyCodexBridgeEnv, buildCodexConfigArgs, shouldSetRequestedMode } from "./codex";
import { applyCredentialProfileEnv, resolveCredentialProfile } from "./external-credentials";
import { isRecoverableConnectionSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";
import { commandAvailable, createToolDiagnostics, refreshCachedLoginShellPath, withCodexStandardTooling, withManagedPath } from "./tool-env";
import {
  appendBoundedText,
  appendMessageChunk,
  appendOutputEntry,
  openAgentOutputArchive,
  renderOutputEntries,
  selectLiveOutputEntries,
  summarizeToolCallUpdate,
} from "./output-store";
import type {
  AgentRecord,
  AgentRuntimeConfig,
  AskResult,
  CancelTerminalProcessResult,
  DoctorResult,
  PendingPermission,
  StartAgentInput,
} from "./types";
import { RuntimeHttpError } from "./types";
import {
  computeEnvFingerprint,
  computeWorkerPoolKey,
  WorkerPool,
} from "./worker-pool";
import { MemoryTracer } from "./memory-trace";
import {
  resolveRuntimeResourceSettings,
  RUNTIME_RESOURCE_SETTING_KEYS,
} from "@/lib/runtime-resource-settings";
import {
  acquireWorkerSpawnResources,
  assessResourcePressure,
  readSystemResourceSnapshot,
  type ResourcePressureLevel,
  type SystemResourceSnapshotProvider,
} from "./resource-admission";
import { emitNamedEvent } from "@/server/events/named-events";

const MAX_STDERR_LINES = 50;
const ENDPOINT_TIMEOUT_MS = 750;
const WORKER_CONNECTION_RESET_MAX_BACKOFF_MS = 15 * 60_000;
const MAX_TEXT_FIELD_CHARS = 100_000;
// Bumped from 30s to 90s. Gemini's `--experimental-acp` startup
// occasionally needs >30s on a cold first run (TLS cert install,
// model fetch, etc.). The previous default caused recovery attempts
// to abort with "Agent ACP initialize timed out after 30000ms" and
// surface as needs_user incidents — even though the SDK would have
// come up given a few more seconds.
const DEFAULT_AGENT_STARTUP_TIMEOUT_MS = 90_000;
const CLAUDE_THINKING_DISPLAY_ARGS = {
  "thinking-display": "summarized",
} as const;

type EnvLike = Record<string, string | undefined>;

type EndpointCheckResult = {
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  errorCode: string | null;
};

const endpointCheckCache = new Map<string, { result: EndpointCheckResult | null; refreshing: boolean }>();

function defaultCommandFor(type: string, model: string | null): { command: string; args: string[] } | null {
  switch (type) {
    case "gemini":
      return { command: "gemini", args: ["--experimental-acp", ...(model ? ["--model", model] : [])] };
    case "claude":
      return { command: "claude-agent-acp", args: [] };
    case "codex":
      return { command: "codex-acp", args: [] };
    case "opencode":
      return { command: "opencode", args: ["acp", ...(model ? ["--model", model] : [])] };
    default:
      return null;
  }
}

function userHomeFromEnv(env: EnvLike) {
  return env.HOME?.trim() || homedir();
}

function bridgeCredentialFileIfMissing(source: string, target: string) {
  if (!existsSync(source) || existsSync(target)) {
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  try {
    symlinkSync(source, target);
  } catch {
    copyFileSync(source, target);
  }
}

function bridgeProjectScopedCliCredentials(type: string, env: EnvLike) {
  if (type === "gemini") {
    const scopedHome = env.GEMINI_CLI_HOME?.trim();
    if (!scopedHome) return;
    const globalHome = join(userHomeFromEnv(env), ".gemini");
    const scopedConfigDir = join(scopedHome, ".gemini");
    for (const fileName of [
      "google_accounts.json",
      "google_account_id",
      "mcp-oauth-tokens-v2.json",
      "settings.json",
    ]) {
      bridgeCredentialFileIfMissing(join(globalHome, fileName), join(scopedConfigDir, fileName));
    }
    return;
  }

  if (type === "codex") {
    const scopedHome = env.CODEX_HOME?.trim();
    if (!scopedHome) return;
    const globalHome = join(userHomeFromEnv(env), ".codex");
    for (const fileName of ["auth.json", "config.toml"]) {
      bridgeCredentialFileIfMissing(join(globalHome, fileName), join(scopedHome, fileName));
    }
  }
}

function applyClaudeKeychainOAuthToken(env: EnvLike) {
  // omniharness spawns claude with a project-scoped CLAUDE_CONFIG_DIR, so the
  // worker process does not see the user's global ~/.claude state and the
  // underlying `claude` binary reports "Authentication required" on every
  // session/prompt. The user's OAuth credentials live in the macOS Keychain
  // entry "Claude Code-credentials"; extract the access token and forward it
  // as CLAUDE_CODE_OAUTH_TOKEN (the env var Claude Code 2.x reads at startup)
  // so OAuth-only users can talk to claude through ACP without configuring an
  // explicit ANTHROPIC_API_KEY.
  if (process.platform !== "darwin") {
    return;
  }
  if (env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim() || env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
    return;
  }
  let raw: string;
  try {
    raw = String(execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], {
      encoding: "utf8",
      timeout: 1_500,
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    return;
  }
  if (!raw) {
    return;
  }
  let token: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: string } };
    token = parsed.claudeAiOauth?.accessToken?.trim();
  } catch {
    return;
  }
  if (token) {
    env.CLAUDE_CODE_OAUTH_TOKEN = token;
  }
}

function applyProjectScopedCliStorage(type: string, cwd: string, env: EnvLike) {
  const cliHome = join(cwd, ".omniharness", "cli-home");
  let shouldBridgeCredentials = false;
  if (type === "gemini" && !env.GEMINI_CLI_HOME?.trim()) {
    env.GEMINI_CLI_HOME = join(cliHome, "gemini");
    shouldBridgeCredentials = true;
  }
  if (type === "codex") {
    const codexHome = join(cliHome, "codex", "home");
    if (!env.CODEX_HOME?.trim()) {
      env.CODEX_HOME = codexHome;
      shouldBridgeCredentials = true;
    }
    if (!env.CODEX_SQLITE_HOME?.trim()) {
      env.CODEX_SQLITE_HOME = join(cliHome, "codex", "sqlite");
    }
  }
  if (type === "claude" && !env.CLAUDE_CONFIG_DIR?.trim()) {
    env.CLAUDE_CONFIG_DIR = join(cliHome, "claude");
  }
  if (type === "opencode") {
    const opencodeHome = join(cliHome, "opencode");
    if (!env.OPENCODE_CONFIG_DIR?.trim()) {
      env.OPENCODE_CONFIG_DIR = join(opencodeHome, "config");
    }
    if (!env.XDG_DATA_HOME?.trim()) {
      env.XDG_DATA_HOME = join(opencodeHome, "data");
    }
    if (!env.XDG_STATE_HOME?.trim()) {
      env.XDG_STATE_HOME = join(opencodeHome, "state");
    }
    if (!env.XDG_CACHE_HOME?.trim()) {
      env.XDG_CACHE_HOME = join(opencodeHome, "cache");
    }
  }
  if (shouldBridgeCredentials) {
    bridgeProjectScopedCliCredentials(type, env);
  }
}

function buildSessionMeta(agentType: string | undefined, skillRoots: string[]) {
  const meta: Record<string, unknown> = {};
  if (skillRoots.length > 0) {
    meta["omniharness/skillRoots"] = skillRoots;
  }
  if (agentType === "claude") {
    meta.claudeCode = {
      options: {
        extraArgs: CLAUDE_THINKING_DISPLAY_ARGS,
        settings: {
          showThinkingSummaries: true,
        },
      },
    };
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function startupTimeout(label: string, timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => {
      reject(new RuntimeHttpError(400, `${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timeout.unref?.();
  });
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

function stripAgentControlText(text: string) {
  return text.replace(/^\[MODE_UPDATE\]\s*autoEdit/i, "");
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

let closedPipeConsoleSuppressionDepth = 0;
let originalConsoleError: typeof console.error | null = null;

function collectErrorCodes(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return [];
  }
  seen.add(value);
  const record = value as { code?: unknown; cause?: unknown };
  return [
    typeof record.code === "string" ? record.code : null,
    ...collectErrorCodes(record.cause, seen),
  ].filter((code): code is string => Boolean(code));
}

function isClosedPipeAcpWriteConsoleError(args: unknown[]) {
  if (args[0] !== "ACP write error:") {
    return false;
  }
  const codes = new Set(collectErrorCodes(args[1]));
  return codes.has("EPIPE")
    || codes.has("ABORT_ERR")
    || codes.has("ERR_STREAM_PREMATURE_CLOSE")
    || codes.has("ERR_STREAM_DESTROYED");
}

async function suppressClosedPipeAcpWriteConsoleError<T>(operation: () => Promise<T>): Promise<T> {
  if (!originalConsoleError) {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      if (closedPipeConsoleSuppressionDepth > 0 && isClosedPipeAcpWriteConsoleError(args)) {
        return;
      }
      originalConsoleError?.(...args);
    };
  }

  closedPipeConsoleSuppressionDepth += 1;
  try {
    return await operation();
  } finally {
    await new Promise<void>((resolve) => setImmediate(resolve));
    closedPipeConsoleSuppressionDepth -= 1;
    if (closedPipeConsoleSuppressionDepth === 0 && originalConsoleError) {
      console.error = originalConsoleError;
      originalConsoleError = null;
    }
  }
}

function childExitDetail(record: AgentRecord) {
  if (record.child.exitCode === null && record.child.signalCode === null) {
    return null;
  }
  return `exit code=${record.child.exitCode} signal=${record.child.signalCode}`;
}

function assertAgentCanReceiveRequest(record: AgentRecord) {
  const exitDetail = childExitDetail(record);
  if (exitDetail || record.state === "stopped") {
    const detail = record.lastError || exitDetail;
    throw new RuntimeHttpError(
      409,
      `Agent is not running: ${record.name}${detail ? ` (${detail})` : ""}`,
    );
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
    let timeout: NodeJS.Timeout | null = null;
    let settled = false;
    const finish = (result: EndpointCheckResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve(result);
    };

    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      finish({ reachable: false, statusCode: null, latencyMs: null, errorCode: "EINVAL" });
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
          finish({
            reachable: res.statusCode !== null,
            statusCode: res.statusCode ?? null,
            latencyMs: Date.now() - start,
            errorCode: null,
          });
        });
      },
    );

    timeout = setTimeout(() => {
      req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
      finish({ reachable: false, statusCode: null, latencyMs: Date.now() - start, errorCode: "ETIMEDOUT" });
    }, ENDPOINT_TIMEOUT_MS);
    timeout.unref?.();
    req.setTimeout(ENDPOINT_TIMEOUT_MS, () => {
      req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    });
    req.once("error", (error: NodeJS.ErrnoException) => {
      finish({ reachable: false, statusCode: null, latencyMs: Date.now() - start, errorCode: error.code || "UNKNOWN" });
    });
    req.end();
  });
}

function refreshEndpointCheck(urlString: string) {
  const cached = endpointCheckCache.get(urlString);
  if (cached?.refreshing) {
    return;
  }

  endpointCheckCache.set(urlString, { result: cached?.result ?? null, refreshing: true });
  void endpointCheck(urlString)
    .then((result) => {
      endpointCheckCache.set(urlString, { result, refreshing: false });
    })
    .catch(() => {
      endpointCheckCache.set(urlString, {
        result: cached?.result ?? null,
        refreshing: false,
      });
    });
}

function readCachedEndpointCheck(urlString: string): EndpointCheckResult | null {
  const cached = endpointCheckCache.get(urlString);
  refreshEndpointCheck(urlString);
  return cached?.result ?? null;
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
    const requestId = nextPermissionRequestId++;
    record.updatedAt = nowIso();
    record.state = "working";
    appendOutputEntry(record, {
      type: "permission",
      text: buildPermissionRequestText(params),
      status: "pending",
      raw: { ...params, requestId },
    });
    // Mode switches (e.g. exiting plan mode via "Ready to code?") change how the
    // agent operates and are always the user's call — never auto-approve them, even
    // in full-access/YOLO mode where every other permission is bypassed.
    if (isFullAccessPermissionMode(record.sessionMode) && !isModeSwitchPermission(params)) {
      const optionId = findAutoApprovePermissionOptionId(params);
      appendPermissionOutcomeEntry(record, requestId, params, "approve", optionId);
      record.updatedAt = nowIso();
      return optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } };
    }
    return new Promise((resolve) => {
      record.pendingPermissions.push({
        requestId,
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
      const text = content?.type === "text" && typeof content.text === "string" ? stripAgentControlText(content.text) : "";
      if (text) {
        record.currentText = appendBoundedText(record.currentText, text, MAX_TEXT_FIELD_CHARS);
        record.lastText = record.currentText;
        appendMessageChunk(record, text, "message");
        this.publishChunk(record.name, text);
      }
      return;
    }

    if (update.sessionUpdate === "agent_thought_chunk") {
      const content = asRecord(update.content);
      const text = content?.type === "text" && typeof content.text === "string" ? content.text : "";
      const isCwdThought = text.startsWith("[current working directory");
      if (text && !isCwdThought) {
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

function describePermissionToolCall(params: acp.RequestPermissionRequest) {
  const toolCall = asRecord(params.toolCall);
  if (!toolCall) {
    return null;
  }
  const title = asNonEmptyString(toolCall.title);
  const kind = asNonEmptyString(toolCall.kind);
  if (title && kind) {
    return `${kind}: ${title}`;
  }
  return title ?? kind;
}

function buildPermissionRequestText(params: acp.RequestPermissionRequest) {
  const target = describePermissionToolCall(params);
  const optionsText = params.options.length > 0
    ? `: ${params.options.map((option) => `${option.kind} ${option.name}`).join(", ")}`
    : "";
  return target
    ? `Permission requested for ${target}${optionsText}`
    : `Permission requested${optionsText}`;
}

function isFullAccessPermissionMode(mode: string | null) {
  return mode === "full-access" || mode === "danger-full-access";
}

// A `switch_mode` permission asks to change the agent's operating mode (the
// plan-mode → code-mode "Ready to code?" handoff). This is a deliberate user
// gate and must never be auto-approved, regardless of session permission mode.
function isModeSwitchPermission(params: acp.RequestPermissionRequest) {
  const toolCall = asRecord(params.toolCall);
  return asNonEmptyString(toolCall?.kind) === "switch_mode";
}

function findPermissionOptionId(params: acp.RequestPermissionRequest, mode: "approve" | "deny", explicitOptionId?: string) {
  if (explicitOptionId && params.options.some((option) => option.optionId === explicitOptionId)) {
    return explicitOptionId;
  }
  const preferred = mode === "approve"
    ? params.options.find((option) => option.kind === "allow_always" || option.optionId === "allow_always" || option.optionId === "proceed_always")
      ?? params.options.find((option) => option.kind.startsWith("allow"))
    : params.options.find((option) => option.kind.startsWith("reject"));
  return preferred?.optionId ?? params.options[0]?.optionId ?? null;
}

function findAutoApprovePermissionOptionId(params: acp.RequestPermissionRequest) {
  const preferred =
    params.options.find((option) => option.kind === "allow_always" || option.optionId === "allow_always" || option.optionId === "proceed_always")
    ?? params.options.find((option) => option.kind.startsWith("allow"));
  return preferred?.optionId ?? null;
}

function appendPermissionOutcomeEntry(
  record: AgentRecord,
  requestId: number,
  params: acp.RequestPermissionRequest,
  decision: "approve" | "deny" | "cancel",
  optionId: string | null,
) {
  if (decision === "cancel") {
    appendOutputEntry(record, {
      type: "permission",
      text: `Permission cancelled for request ${requestId}`,
      status: "cancelled",
      raw: { requestId, decision },
    });
    return;
  }

  const option = optionId
    ? params.options.find((candidate) => candidate.optionId === optionId)
    : null;
  const status = optionId
    ? decision === "approve" ? "approved" : "denied"
    : "cancelled";
  const optionLabel = option
    ? `${option.kind} ${option.name}`.trim()
    : optionId;
  appendOutputEntry(record, {
    type: "permission",
    text: optionLabel
      ? `Permission ${status} for request ${requestId}: ${optionLabel}`
      : `Permission ${status} for request ${requestId}`,
    status,
    raw: {
      requestId,
      decision,
      optionId: optionId ?? null,
      option: option ?? null,
      toolCall: params.toolCall,
    },
  });
}

export class AgentRuntimeManager {
  readonly agents = new Map<string, AgentRecord>();
  private readonly chunkSubscribers = new Map<string, Set<(chunk: string) => void>>();
  private readonly workerPool = new WorkerPool();
  private readonly memoryTracer: MemoryTracer;
  private readonly pendingAgentReaps = new Map<string, NodeJS.Timeout>();
  private reapSweepTimer: NodeJS.Timeout | null = null;
  private resourcePressureTimer: NodeJS.Timeout | null = null;
  private resourcePressureCheckInFlight = false;
  private lastResourcePressureLevel: ResourcePressureLevel = "normal";
  private readonly runtimeStartedAt = Date.now();
  private lastAgentUseAt = this.runtimeStartedAt;
  private runtimeSettingsEnv: EnvLike = {};
  private readonly poolMemberMaxAgeMs: number;
  private readonly agentIdleTimeoutMs: number;
  private readonly agentExitGraceMs: number;

  constructor(
    private readonly options: {
      config?: AgentRuntimeConfig;
      env?: EnvLike;
      resourceSnapshotProvider?: SystemResourceSnapshotProvider;
    } = {},
  ) {
    const baseEnv = this.options.env || process.env;
    const sizeRaw = baseEnv.OMNIHARNESS_WORKER_POOL_SIZE ?? baseEnv.OMNIHARNESS_GEMINI_POOL_SIZE;
    const parsed = sizeRaw ? Number.parseInt(sizeRaw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) {
      this.workerPool.setMaxPerKey(parsed);
    } else {
      this.workerPool.setMaxPerKey(1);
    }
    this.workerPool.setMaxTotal(
      readPositiveInteger(baseEnv.OMNIHARNESS_WORKER_POOL_MAX_TOTAL, 4),
    );
    this.poolMemberMaxAgeMs = readPositiveInteger(
      baseEnv.OMNIHARNESS_WORKER_POOL_MAX_AGE_MS,
      30 * 60_000,
    );
    this.agentIdleTimeoutMs = readPositiveInteger(
      baseEnv.OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS,
      30 * 60_000,
    );
    this.agentExitGraceMs = readPositiveInteger(
      baseEnv.OMNIHARNESS_AGENT_EXIT_GRACE_MS,
      60_000,
    );
    const sweepIntervalMs = readPositiveInteger(
      baseEnv.OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS,
      60_000,
    );
    this.reapSweepTimer = setInterval(() => this.runReapSweep(), sweepIntervalMs);
    this.reapSweepTimer.unref?.();
    if (baseEnv.OMNIHARNESS_RESOURCE_PRESSURE !== "0") {
      const pressureIntervalMs = readPositiveInteger(
        baseEnv.OMNIHARNESS_RESOURCE_PRESSURE_INTERVAL_MS,
        30_000,
      );
      this.resourcePressureTimer = setInterval(() => {
        void this.runResourcePressureCheck();
      }, pressureIntervalMs);
      this.resourcePressureTimer.unref?.();
    }
    this.memoryTracer = new MemoryTracer({
      env: baseEnv as Record<string, string | undefined>,
      getCounts: () => ({
        agents: this.agents.size,
        poolMembers: this.workerPool.countAll(),
      }),
    });
  }

  applyRuntimeSettings(env: EnvLike, options: { emit?: boolean } = {}): { ok: true; keys: string[] } {
    const settingKeys = Object.values(RUNTIME_RESOURCE_SETTING_KEYS);
    const nextEnv = { ...this.runtimeSettingsEnv };
    const changed: string[] = [];

    for (const key of settingKeys) {
      const value = env[key];
      if (typeof value !== "string") continue;
      if (nextEnv[key] === value) continue;
      nextEnv[key] = value;
      changed.push(key);
    }

    if (changed.length > 0) {
      this.runtimeSettingsEnv = nextEnv;
      if (options.emit !== false) {
        emitNamedEvent({ kind: "runtime.settings_updated", keys: changed });
      }
    }

    return { ok: true, keys: changed };
  }

  private getRuntimeEnv(overrides: EnvLike = {}): EnvLike {
    return {
      ...(this.options.env || process.env),
      ...this.runtimeSettingsEnv,
      ...overrides,
    };
  }

  private async runResourcePressureCheck(): Promise<void> {
    if (this.resourcePressureCheckInFlight) return;
    this.resourcePressureCheckInFlight = true;
    try {
      const baseEnv = this.getRuntimeEnv();
      const snapshot = this.options.resourceSnapshotProvider
        ? await this.options.resourceSnapshotProvider()
        : await readSystemResourceSnapshot(process.cwd());
      const assessment = assessResourcePressure(snapshot, baseEnv);
      if (assessment.level === "normal") {
        this.lastResourcePressureLevel = "normal";
        return;
      }

      const poolMembersBefore = this.workerPool.countAll();
      const evictedPoolMembers = assessment.level === "critical"
        ? this.workerPool.evictAll()
        : 0;
      const shouldSurface =
        assessment.level !== this.lastResourcePressureLevel || evictedPoolMembers > 0;
      this.lastResourcePressureLevel = assessment.level;
      if (!shouldSurface) return;

      emitNamedEvent({
        kind: "runtime.resource_pressure",
        level: assessment.level,
        memoryFreePercent: snapshot.memoryFreePercent ?? null,
        diskFreeMb: snapshot.diskFreeMb ?? null,
        activeAgents: this.agents.size,
        poolMembers: poolMembersBefore,
        evictedPoolMembers,
        reasons: assessment.reasons,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "runtime.resource_pressure",
        message: assessment.level === "critical"
          ? `System resources are critically low. OmniHarness evicted ${evictedPoolMembers} prewarmed worker${evictedPoolMembers === 1 ? "" : "s"} and will refuse new workers until resources recover.`
          : "System resources are low. OmniHarness will refuse new workers until resources recover.",
        surface: "toast",
      });
    } catch (error) {
      process.stderr.write(`[resource-pressure] check failed: ${describeUnknownError(error)}\n`);
    } finally {
      this.resourcePressureCheckInFlight = false;
    }
  }

  private runReapSweep(): void {
    try {
      this.workerPool.sweepExpired(this.poolMemberMaxAgeMs);
    } catch (error) {
      process.stderr.write(`[runtime-sweep] pool sweep failed: ${describeUnknownError(error)}\n`);
    }
    const now = Date.now();
    for (const [name, record] of this.agents) {
      if (record.state !== "idle") continue;
      const updatedAt = Date.parse(record.updatedAt);
      if (!Number.isFinite(updatedAt)) continue;
      if (now - updatedAt < this.agentIdleTimeoutMs) continue;
      void this.stopAgent(name).catch((error) => {
        process.stderr.write(
          `[runtime-sweep] failed to reap idle agent ${name}: ${describeUnknownError(error)}\n`,
        );
      });
    }
    this.runIdleCleanupSweep(now);
  }

  private runIdleCleanupSweep(now: number): void {
    const settings = resolveRuntimeResourceSettings(this.getRuntimeEnv());
    if (!settings.idleCleanupEnabled) return;

    const activeAgents = Array.from(this.agents.values())
      .filter((record) => record.state !== "stopped" && record.state !== "error")
      .length;
    if (activeAgents > 0) return;

    const poolMembers = this.workerPool.countAll();
    if (poolMembers === 0) return;

    const quietSince = Math.max(this.runtimeStartedAt, this.lastAgentUseAt);
    const idleMs = now - quietSince;
    if (idleMs < settings.idleCleanupAfterMs) return;

    const evictedPoolMembers = this.workerPool.evictAll();
    if (evictedPoolMembers === 0) return;

    this.lastAgentUseAt = now;
    emitNamedEvent({
      kind: "runtime.idle_cleanup",
      idleMs,
      activeAgents,
      evictedPoolMembers,
    });
  }

  private scheduleAgentRecordReap(name: string): void {
    const existing = this.pendingAgentReaps.get(name);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pendingAgentReaps.delete(name);
      const record = this.agents.get(name);
      if (!record) return;
      // Only reap if the record is still in a terminal state. If the agent was
      // restarted under the same name in the grace window, leave it alone.
      if (record.state !== "stopped" && record.state !== "error") return;
      this.agents.delete(name);
    }, this.agentExitGraceMs);
    timer.unref?.();
    this.pendingAgentReaps.set(name, timer);
  }

  toStatus(record: AgentRecord) {
    const outputEntries = selectLiveOutputEntries(record);
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
      credentialProfile: record.credentialProfile,
      sessionMode: record.sessionMode,
      contextUsage: record.contextUsage,
      lastError: record.lastError,
      recentStderr: [...record.stderrBuffer],
      stderrBuffer: [...record.stderrBuffer],
      lastText: record.lastText,
      currentText: record.currentText,
      renderedOutput: renderOutputEntries(outputEntries),
      outputEntries,
      outputArchive: record.outputArchive.stats(outputEntries.length),
      stopReason: record.stopReason,
      pendingPermissions: record.pendingPermissions.map((item) => ({
        requestId: item.requestId,
        requestedAt: item.requestedAt,
        sessionId: item.params.sessionId,
        toolCall: (() => {
          const toolCall = asRecord(item.params.toolCall);
          return toolCall
            ? {
                toolCallId: asNonEmptyString(toolCall.toolCallId),
                kind: asNonEmptyString(toolCall.kind),
                title: asNonEmptyString(toolCall.title),
                status: asNonEmptyString(toolCall.status),
              }
            : null;
        })(),
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

  async readAgentOutput(name: string, options?: { cursor?: number; limit?: number }) {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, `Agent not found: ${name}`);
    }
    return record.outputArchive.readPage(options);
  }

  private async runAgentRequest<T>(record: AgentRecord, request: () => Promise<T>): Promise<T> {
    assertAgentCanReceiveRequest(record);
    return await new Promise<T>((resolve, reject) => {
      const rejectForExit = (code: number | null, signal: NodeJS.Signals | null) => {
        const message = `Agent is not running: ${record.name} (exit code=${code} signal=${signal})`;
        record.state = "stopped";
        record.lastError = record.lastError ?? `exit code=${code} signal=${signal}`;
        record.updatedAt = nowIso();
        reject(new RuntimeHttpError(409, message));
      };
      const rejectForError = (error: Error) => {
        const message = `Agent process error: ${error.message}`;
        record.state = "error";
        record.lastError = message;
        record.updatedAt = nowIso();
        reject(new RuntimeHttpError(500, message));
      };
      const cleanup = () => {
        record.child.off("exit", rejectForExit);
        record.child.off("error", rejectForError);
      };

      record.child.once("exit", rejectForExit);
      record.child.once("error", rejectForError);
      suppressClosedPipeAcpWriteConsoleError(request).then(resolve, reject).finally(cleanup);
    });
  }

  async startAgent(input: StartAgentInput) {
    this.applyRuntimeSettings(input.env ?? {}, { emit: false });
    this.lastAgentUseAt = Date.now();
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
    const resumeSessionId = input.resumeSessionId?.trim() || null;
    const configuredAgent = this.options.config?.agents?.[type];
    const baseEnv = this.getRuntimeEnv();
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
    applyProjectScopedCliStorage(type, cwd, finalEnv);
    const credentialProfile = await resolveCredentialProfile({
      type,
      cwd,
      env: finalEnv,
      requestedProfile: input.credentialProfile,
      configuredProfile: configuredAgent?.credentialProfile,
    });
    applyCredentialProfileEnv(finalEnv, credentialProfile);

    if (type === "codex") {
      Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
      Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
    }
    if (type === "claude") {
      applyClaudeKeychainOAuthToken(finalEnv);
    }

    const requestedMode = input.mode || configuredAgent?.mode;
    const defaultCommand = input.command || configuredAgent?.command || type;
    const defaultArgsList = requestedArgs || configuredArgs || defaultArgs;
    const useCodexFallback = type === "codex" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useClaudeDefault = type === "claude" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useGeminiDefault = type === "gemini" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useOpencodeDefault = type === "opencode" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;

    const eligibleForPool =
      (useGeminiDefault || useClaudeDefault || useCodexFallback || useOpencodeDefault)
      && !resumeSessionId
      && skillRoots.length === 0;
    const poolKey = eligibleForPool
      ? computeWorkerPoolKey({
          type,
          cwd,
          model: requestedModel,
          mode: requestedMode ?? null,
          mcpServers,
          skillRoots,
          envFingerprint: computeEnvFingerprint(finalEnv as NodeJS.ProcessEnv),
        })
      : null;
    const pooledMember = poolKey ? this.workerPool.checkout(poolKey) : null;

    let recordRef: { current?: AgentRecord };
    let stderrBuffer: string[];
    let client: RuntimeClient;
    let child: ChildProcessWithoutNullStreams | undefined;
    let connection: acp.ClientSideConnection | undefined;
    let init: unknown;
    let session: unknown;
    let managedSkillLinks: string[];

    if (pooledMember) {
      recordRef = pooledMember.recordRef;
      stderrBuffer = pooledMember.stderrBuffer;
      client = pooledMember.client as RuntimeClient;
      child = pooledMember.child;
      connection = pooledMember.connection;
      init = pooledMember.init;
      session = pooledMember.session;
      managedSkillLinks = [];
    } else {
      recordRef = { current: undefined };
      stderrBuffer = [];
      client = new RuntimeClient(() => recordRef.current, (agentName, chunk) => this.publishChunk(agentName, chunk));
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

      managedSkillLinks = materializeSkillRoots(cwd, name, skillRoots, finalEnv);
      let lastError: unknown;

      for (const candidate of candidates) {
        try {
          const result = await this.spawnAgentConnection({
            cwd,
            command: expandHomePath(candidate.command, finalEnv),
            args: candidate.args,
            env: finalEnv as NodeJS.ProcessEnv,
            startupTimeoutMs: readPositiveInteger(
              baseEnv.OMNIHARNESS_AGENT_STARTUP_TIMEOUT_MS,
              DEFAULT_AGENT_STARTUP_TIMEOUT_MS,
            ),
            mcpServers,
            skillRoots,
            ...(resumeSessionId ? { resumeSessionId } : {}),
            getClient: () => client,
            onStderrLine: (line) => {
              pushStderrLine(stderrBuffer, line);
              if (recordRef.current) {
                recordRef.current.updatedAt = nowIso();
              }
            },
            agentType: type,
            spawnPurpose: "run",
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
    }
    const sessionRecord = asRecord(session);
    const sessionId = resumeSessionId ?? asNonEmptyString(sessionRecord?.sessionId);
    if (!sessionId) {
      cleanupSkillLinks(managedSkillLinks);
      throw new RuntimeHttpError(500, "Agent session did not include a session id.");
    }

    const modesRecord = asRecord(sessionRecord?.modes);
    const currentModeId = asNonEmptyString(modesRecord?.currentModeId);
    if (connection && shouldSetRequestedMode(requestedMode, currentModeId, modesRecord?.availableModes)) {
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
      credentialProfile: credentialProfile.status,
      sessionMode: requestedMode || null,
      contextUsage: null,
      lastText: "",
      currentText: "",
      activeOutputEntryId: null,
      outputEntries: [],
      outputArchive: openAgentOutputArchive({
        name,
        dataDir: baseEnv.OMNIHARNESS_RUNTIME_DATA_DIR,
        resume: Boolean(input.resumeSessionId),
      }),
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
      // Reap the record after a short grace period so the supervisor observer
      // and UI polling get to see the stopped/error transition. Without this
      // the record stays in this.agents forever, retaining its output buffer,
      // closed ACP connection, and child handle.
      this.scheduleAgentRecordReap(name);
    });

    if (poolKey) {
      this.scheduleWorkerPoolRefill({
        type,
        cwd,
        model: requestedModel,
        mode: requestedMode ?? null,
        env: input.env,
        mcpServers: input.mcpServers ?? [],
      });
    }

    return this.toStatus(record);
  }

  async stopAgent(name: string) {
    const record = this.agents.get(name);
    if (!record) {
      return false;
    }
    try {
      const cancelParams = { sessionId: record.sessionId } as Parameters<acp.ClientSideConnection["cancel"]>[0];
      void record.connection.cancel(cancelParams).catch(() => undefined);
      this.cancelAllPendingPermissions(record);
      cleanupSkillLinks(record.managedSkillLinks);
      record.state = "stopped";
      record.updatedAt = nowIso();
      const child = record.child;
      child.kill("SIGTERM");
      const forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, 500);
      forceKillTimer.unref?.();
    } finally {
      const pending = this.pendingAgentReaps.get(name);
      if (pending) {
        clearTimeout(pending);
        this.pendingAgentReaps.delete(name);
      }
      this.agents.delete(name);
    }
    return true;
  }

  async askAgent(name: string, prompt: string, onChunk?: (chunk: string) => void): Promise<AskResult> {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, `Agent not found: ${name}`);
    }
    assertAgentCanReceiveRequest(record);
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
      const response = await retrySupervisorRequest(
        () => this.runAgentRequest(record, () => record.connection.prompt(promptParams)),
        {
          maxDelayMs: WORKER_CONNECTION_RESET_MAX_BACKOFF_MS,
          retryIndefinitelyWhen: isRecoverableConnectionSupervisorError,
        },
      );
      const responseRecord = asRecord(response);
      record.stopReason = typeof responseRecord?.stopReason === "string" ? responseRecord.stopReason : null;
      applyPromptUsage(record, responseRecord?.usage);
      record.lastText = record.currentText;
      record.currentText = "";
      record.state = "idle";
      record.updatedAt = nowIso();
      return {
        name,
        state: record.state,
        stopReason: record.stopReason,
        response: record.lastText,
      };
    } catch (error) {
      record.state = error instanceof RuntimeHttpError && error.statusCode === 409 ? "stopped" : "error";
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
    assertAgentCanReceiveRequest(record);
    const cancelParams = { sessionId: record.sessionId } as Parameters<acp.ClientSideConnection["cancel"]>[0];
    await this.runAgentRequest(record, () => record.connection.cancel(cancelParams));
    const cancelledPermissions = this.cancelAllPendingPermissions(record);
    record.updatedAt = nowIso();
    if (record.state === "working") {
      record.state = "idle";
    }
    return { ok: true, name: record.name, cancelledPermissions };
  }

  cancelTerminalProcess(name: string, processId: string, toolCallId?: string | null): CancelTerminalProcessResult {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, "not_found");
    }

    const normalizedProcessId = processId.trim();
    if (!/^\d+$/.test(normalizedProcessId)) {
      throw new RuntimeHttpError(400, "processId must be a numeric terminal process id");
    }

    const pid = Number(normalizedProcessId);
    const signal: NodeJS.Signals = "SIGINT";
    try {
      process.kill(pid, signal);
    } catch (error) {
      throw new RuntimeHttpError(404, `terminal process not found: ${normalizedProcessId}`, {
        processId: normalizedProcessId,
        error: describeUnknownError(error),
      });
    }

    const normalizedToolCallId = asNonEmptyString(toolCallId) ?? null;
    record.updatedAt = nowIso();
    appendOutputEntry(record, {
      type: "tool_call_update",
      text: `Terminal process ${normalizedProcessId} cancelled by user.`,
      toolCallId: normalizedToolCallId ?? undefined,
      status: "cancelled",
      raw: {
        sessionUpdate: "tool_call_update",
        toolCallId: normalizedToolCallId ?? undefined,
        status: "cancelled",
        rawOutput: {
          process_id: normalizedProcessId,
          formatted_output: "Terminal process cancelled by user.",
        },
      },
    });

    return {
      ok: true,
      name: record.name,
      processId: normalizedProcessId,
      toolCallId: normalizedToolCallId,
      signal,
    };
  }

  async setMode(name: string, mode: string) {
    const record = this.agents.get(name);
    if (!record) {
      throw new RuntimeHttpError(404, "not_found");
    }
    assertAgentCanReceiveRequest(record);
    const setModeParams = { sessionId: record.sessionId, modeId: mode } as Parameters<acp.ClientSideConnection["setSessionMode"]>[0];
    await this.runAgentRequest(record, () => record.connection.setSessionMode(setModeParams));
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

  async doctor(options: { refresh?: boolean } = {}) {
    const types = ["codex", "claude", "gemini", "opencode"];
    const baseEnv = this.options.env || process.env;
    if (options.refresh) {
      await refreshCachedLoginShellPath(baseEnv);
    }
    const env = withManagedPath(baseEnv, undefined, { loginShellPathMode: "cached" });
    const tools = createToolDiagnostics({ env, assumeManagedPath: true });
    const results = await Promise.all(types.map((type) => this.runDoctorForType(type, { env, tools })));
    return { results };
  }

  async prewarmWorker(input: {
    type: string;
    cwd: string;
    model?: string | null;
    mode?: string | null;
    env?: Record<string, string>;
    mcpServers?: acp.McpServer[];
  }): Promise<{ ok: true; key: string; size: number; warmed: boolean }> {
    this.applyRuntimeSettings(input.env ?? {}, { emit: false });
    const type = input.type;
    const cwd = input.cwd || process.cwd();
    const requestedModel = input.model?.trim() || null;
    const configuredAgent = this.options.config?.agents?.[type];
    const baseEnv = this.getRuntimeEnv();
    const mcpServers = [
      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
    ];
    const skillRoots: string[] = [];

    const finalEnv = withManagedPath({
      ...baseEnv,
      ...(configuredAgent?.env || {}),
      ...(input.env || {}),
    }, cwd);
    applyProjectScopedCliStorage(type, cwd, finalEnv);
    const credentialProfile = await resolveCredentialProfile({
      type,
      cwd,
      env: finalEnv,
      requestedProfile: undefined,
      configuredProfile: configuredAgent?.credentialProfile,
    });
    applyCredentialProfileEnv(finalEnv, credentialProfile);

    if (type === "codex") {
      Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
      Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
    }
    if (type === "claude") {
      applyClaudeKeychainOAuthToken(finalEnv);
    }

    const requestedMode = input.mode || configuredAgent?.mode || null;
    const poolKey = computeWorkerPoolKey({
      type,
      cwd,
      model: requestedModel,
      mode: requestedMode,
      mcpServers,
      skillRoots,
      envFingerprint: computeEnvFingerprint(finalEnv as NodeJS.ProcessEnv),
    });

    const candidate = defaultCommandFor(type, requestedModel);
    if (!candidate) {
      throw new RuntimeHttpError(400, `Worker type "${type}" has no default ACP command; cannot prewarm`);
    }
    if (!commandExists(candidate.command, finalEnv)) {
      throw new RuntimeHttpError(400, `${candidate.command} binary not found on PATH; cannot prewarm`);
    }

    // Atomic check-and-reserve. Without this, two concurrent prewarm POSTs
    // (e.g. the UI firing on focus+keystroke at the same instant) can both
    // pass needsWarm() before either calls beginInFlight(), and we end up
    // spawning two children for a pool that only ever holds one.
    if (!this.workerPool.tryBeginWarm(poolKey)) {
      return { ok: true, key: poolKey, size: this.workerPool.countMembers(poolKey), warmed: false };
    }
    try {
      const recordRef: { current?: AgentRecord } = {};
      const stderrBuffer: string[] = [];
      const client = new RuntimeClient(() => recordRef.current, (agentName, chunk) => this.publishChunk(agentName, chunk));

      const result = await this.spawnAgentConnection({
        cwd,
        command: expandHomePath(candidate.command, finalEnv),
        args: candidate.args,
        env: finalEnv as NodeJS.ProcessEnv,
        startupTimeoutMs: readPositiveInteger(
          baseEnv.OMNIHARNESS_AGENT_STARTUP_TIMEOUT_MS,
          DEFAULT_AGENT_STARTUP_TIMEOUT_MS,
        ),
        mcpServers,
        skillRoots,
        getClient: () => client,
        onStderrLine: (line) => {
          pushStderrLine(stderrBuffer, line);
        },
        agentType: type,
        spawnPurpose: "prewarm",
      });

      const sessionRecord = asRecord(result.session);
      const sessionId = asNonEmptyString(sessionRecord?.sessionId);
      if (!sessionId) {
        result.child.kill("SIGTERM");
        throw new RuntimeHttpError(500, `${type} prewarm session did not include a session id.`);
      }
      const initRecord = asRecord(result.init);
      const protocolVersion = typeof initRecord?.protocolVersion === "number" || typeof initRecord?.protocolVersion === "string"
        ? initRecord.protocolVersion
        : null;

      this.workerPool.add({
        key: poolKey,
        type,
        cwd,
        recordRef,
        client,
        stderrBuffer,
        child: result.child,
        connection: result.connection,
        init: result.init,
        session: result.session,
        sessionId,
        protocolVersion,
        warmedAt: Date.now(),
      });

      return { ok: true, key: poolKey, size: this.workerPool.countMembers(poolKey), warmed: true };
    } finally {
      this.workerPool.endInFlight(poolKey);
    }
  }

  private scheduleWorkerPoolRefill(input: {
    type: string;
    cwd: string;
    model: string | null;
    mode: string | null;
    env?: Record<string, string>;
    mcpServers: acp.McpServer[];
  }) {
    setImmediate(() => {
      this.prewarmWorker(input).catch((error) => {
        process.stderr.write(`[worker-pool] refill failed (${input.type}): ${describeUnknownError(error)}\n`);
      });
    });
  }

  shutdownPools() {
    this.workerPool.shutdown();
    this.memoryTracer.stop();
    if (this.reapSweepTimer) {
      clearInterval(this.reapSweepTimer);
      this.reapSweepTimer = null;
    }
    if (this.resourcePressureTimer) {
      clearInterval(this.resourcePressureTimer);
      this.resourcePressureTimer = null;
    }
    for (const timer of this.pendingAgentReaps.values()) clearTimeout(timer);
    this.pendingAgentReaps.clear();
  }

  private async spawnAgentConnection(input: {
    cwd: string;
    command: string;
    args: string[];
    env: NodeJS.ProcessEnv;
    startupTimeoutMs: number;
    mcpServers: acp.McpServer[];
    skillRoots: string[];
    resumeSessionId?: string;
    getClient: () => acp.Client;
    onStderrLine?: (line: string) => void;
    agentType?: string;
    spawnPurpose?: "run" | "prewarm";
  }) {
    const resourceAdmission = await acquireWorkerSpawnResources({
      cwd: input.cwd,
      env: input.env,
      snapshotProvider: this.options.resourceSnapshotProvider,
    });

    try {
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
      this.memoryTracer.onSpawn(child, input.agentType ?? "unknown", {
        command: input.command,
        cwd: input.cwd,
        purpose: input.spawnPurpose ?? "run",
        resumed: Boolean(input.resumeSessionId),
      });

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
      const connection = new acp.ClientSideConnection(input.getClient, sanitizeAcpStream(stream));
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
          suppressClosedPipeAcpWriteConsoleError(() => connection.initialize(initializeParams)),
          processFailure,
          startupTimeout("Agent ACP initialize", input.startupTimeoutMs),
        ]);
        const sessionMeta = buildSessionMeta(input.agentType, input.skillRoots);
        const sessionSetupParams = {
          cwd: input.cwd,
          mcpServers: input.mcpServers,
          ...(sessionMeta ? { _meta: sessionMeta } : {}),
        } as Parameters<acp.ClientSideConnection["newSession"]>[0];
        const session = input.resumeSessionId
          ? await this.resumeOrLoadSession(
            connection,
            input.resumeSessionId,
            sessionSetupParams,
            processFailure,
            input.startupTimeoutMs,
          )
          : await Promise.race([
            suppressClosedPipeAcpWriteConsoleError(() => connection.newSession(sessionSetupParams)),
            processFailure,
            startupTimeout("Agent ACP new session", input.startupTimeoutMs),
          ]);
        return { child, connection, init, session };
      } catch (error) {
        child.kill("SIGTERM");
        throw error;
      }
    } finally {
      resourceAdmission.release();
    }
  }

  private async resumeOrLoadSession(
    connection: acp.ClientSideConnection,
    sessionId: string,
    sessionSetupParams: Parameters<acp.ClientSideConnection["newSession"]>[0],
    spawnError: Promise<never>,
    startupTimeoutMs: number,
  ) {
    // Newer ACP adapter builds (e.g. @agentclientprotocol/claude-agent-acp)
    // validate `session/resume` with a zod schema that requires `cwd` (and
    // any other session-setup params) alongside `sessionId`; sending only
    // `{ sessionId }` returns `-32602 Invalid params` with `cwd: { _errors }`
    // even when the session is otherwise resumable. Pass the full setup
    // payload to both `resume` and `load` so old and new adapters work.
    try {
      const resumeParams = {
        sessionId,
        ...sessionSetupParams,
      } as Parameters<acp.ClientSideConnection["unstable_resumeSession"]>[0];
      return await Promise.race([
        suppressClosedPipeAcpWriteConsoleError(() => connection.unstable_resumeSession(resumeParams)),
        spawnError,
        startupTimeout("Agent ACP resume session", startupTimeoutMs),
      ]);
    } catch {
      const loadParams = {
        sessionId,
        ...sessionSetupParams,
      } as Parameters<acp.ClientSideConnection["loadSession"]>[0];
      return await Promise.race([
        suppressClosedPipeAcpWriteConsoleError(() => connection.loadSession(loadParams)),
        spawnError,
        startupTimeout("Agent ACP load session", startupTimeoutMs),
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
      appendPermissionOutcomeEntry(record, pending.requestId, pending.params, decision, null);
    } else {
      const optionId = findPermissionOptionId(pending.params, decision, explicitOptionId);
      pending.resolve(optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } });
      appendPermissionOutcomeEntry(record, pending.requestId, pending.params, decision, optionId);
    }
    record.updatedAt = nowIso();
    return pending;
  }

  private async runDoctorForType(type: string, input: { env: EnvLike; tools: ReturnType<typeof createToolDiagnostics> }): Promise<DoctorResult> {
    const { env, tools } = input;
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
        const endpointResult = readCachedEndpointCheck(baseUrl);
        endpoint = endpointResult?.reachable ?? null;
        if (endpointResult && !endpoint && !message) {
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
      tools,
      ...(message ? { message } : {}),
    };
  }
}
