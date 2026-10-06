import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import * as acp from "@agentclientprotocol/sdk";
import { isFullAccessAgentMode } from "../gemini";
import {
  appendBoundedText,
  appendMessageChunk,
  appendOutputEntry,
} from "../output-store";
import { normalizeSessionUpdate } from "./session-updates";
import { TerminalService } from "./terminal-service";
import { McpService, registeredAcpMcpHandlersSnapshot, type AcpMcpHandler } from "./mcp-service";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  bufferWorkerPlanStartupUpdate,
  handleAcpSessionUpdateForWorker,
  isAcpPlanNotification,
  type WorkerPlanStartupContext,
} from "./plan-stream";
import {
  handleAcpGoalSessionUpdateForWorker,
  isAcpGoalNotification,
} from "./goal-state";

export type AcpExtensionHandler = {
  request?(params: Record<string, unknown>): Promise<Record<string, unknown>>;
  notify?(params: Record<string, unknown>): Promise<void>;
};
import type {
  AgentRecord,
  ElicitationCreateParams,
  ElicitationResponse,
} from "../types";
import { applyProviderConfigOptions } from "../config-state";

const MAX_TEXT_FIELD_CHARS = 100_000;
const ELICITATION_CREATE_METHOD = "elicitation/create";

/**
 * Human-input request ids are OmniHarness handles, not ACP JSON-RPC ids: they
 * key the pending maps here and every `requestId`-folded row in the worker's
 * append-only stream.
 *
 * That stream outlives this process — a resumed worker keeps writing to the
 * same JSONL — so a counter that restarts at 1 hands a *new* request the id of
 * an old one. Every reader folds by id and lets the later row win, which
 * silently merges two unrelated questions into one card and lets a stale row's
 * terminal status close a live request. Seed from the wall clock so each
 * runtime process starts above every id it could have issued before.
 */
const REQUEST_ID_EPOCH = Date.now();
let nextPermissionRequestId = REQUEST_ID_EPOCH;
let nextElicitationRequestId = REQUEST_ID_EPOCH;

function nowIso() {
  return new Date().toISOString();
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

/** Codex reports `_meta.codex.threadStatus` on every turn boundary, prompted or not. */
function readProviderThreadStatus(update: unknown): "active" | "idle" | null {
  const meta = asRecord(asRecord(update)?._meta);
  const status = asRecord(asRecord(meta?.codex)?.threadStatus)?.type;
  return status === "active" || status === "idle" ? status : null;
}

/**
 * Track turns the provider runs without a prompt from us. A Codex /goal keeps
 * starting turns after the prompted one ends; without this the agent read as
 * idle (or working forever) and the runner settled a conversation that was
 * still producing output.
 */
function applyProviderThreadStatus(record: AgentRecord, status: "active" | "idle" | null) {
  if (!status) return;
  record.providerTurnActive = status === "active";
  // `askAgent` settles the turn it started; it reads `providerTurnActive` then.
  if (record.promptInFlight) return;
  if (status === "active" && record.state === "idle") {
    record.state = "working";
    record.lastText = record.currentText || record.lastText;
    record.currentText = "";
    record.activeOutputEntryId = null;
    record.stopReason = null;
    emitNamedEvent({ kind: "acp.provider_turn_started", workerId: record.name });
  } else if (status === "idle" && record.state === "working") {
    endProviderTurn(record);
  }
}

function endProviderTurn(record: AgentRecord) {
  record.lastText = record.currentText || record.lastText;
  record.currentText = "";
  record.stopReason = "end_turn";
  record.state = "idle";
  emitNamedEvent({ kind: "acp.provider_turn_ended", workerId: record.name });
}

/**
 * claude-agent-acp attaches `cost` to a `usage_update` only when the SDK
 * reports a turn `result` — for prompted turns and for the ones Claude starts
 * on its own after a background task notification alike.
 */
function isTurnResultUsageUpdate(update: Record<string, unknown>) {
  return finiteNumber(asRecord(update.cost)?.amount) !== null;
}

/**
 * Claude has no Codex-style thread status, so a turn it starts on its own
 * (a background-task notification) reads as working from its first tool call
 * and, without this, never reads as idle again. The stuck-worker reaper then
 * took the quiet "working" worker for a hung one and re-sent the user's last,
 * already-answered message — which the agent read as fresh consent to act.
 */
function settleUnpromptedTurnAtResult(record: AgentRecord, update: Record<string, unknown>) {
  if (!isTurnResultUsageUpdate(update)) return;
  // `askAgent` settles the turn it started, and a Codex /goal turn ends on
  // its own thread status.
  if (record.promptInFlight || record.providerTurnActive) return;
  if (record.state !== "working") return;
  if (record.pendingPermissions.length > 0 || record.pendingElicitations.length > 0) return;
  endProviderTurn(record);
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

function selectTextFileRange(content: string, line?: number | null, limit?: number | null) {
  if (line == null && limit == null) {
    return content;
  }

  const lines = content.match(/[^\n]*\n|[^\n]+/g) ?? [];
  const start = Math.max(0, (line ?? 1) - 1);
  const end = limit == null ? undefined : start + Math.max(0, limit);
  return lines.slice(start, end).join("");
}

function isInside(root: string, candidate: string) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function resolveWorkspacePath(workspaceRoots: readonly string[], requestedPath: string, forWrite: boolean) {
  const candidate = resolve(workspaceRoots[0]!, requestedPath);
  const workspaceRoot = workspaceRoots.find((root) => isInside(resolve(root), candidate));
  if (!workspaceRoot) throw acp.RequestError.invalidParams({ path: requestedPath }, "Path is outside the workspace");
  const root = await realpath(workspaceRoot);
  if (!forWrite) {
    const canonical = await realpath(candidate);
    if (!isInside(root, canonical)) throw acp.RequestError.invalidParams({ path: requestedPath }, "Path resolves outside the workspace");
    return canonical;
  }
  let existingParent = dirname(candidate);
  while (existingParent !== dirname(existingParent)) {
    try {
      const canonicalParent = await realpath(existingParent);
      if (!isInside(root, canonicalParent)) throw acp.RequestError.invalidParams({ path: requestedPath }, "Path resolves outside the workspace");
      break;
    } catch (error) {
      if (error instanceof acp.RequestError) throw error;
      existingParent = dirname(existingParent);
    }
  }
  return candidate;
}

function buildElicitationRequestText(params: ElicitationCreateParams) {
  const message = asNonEmptyString(params.message);
  const fieldNames = params.requestedSchema?.properties
    ? Object.keys(params.requestedSchema.properties)
    : [];
  const fieldsSuffix = fieldNames.length > 0
    ? ` (${fieldNames.length} field${fieldNames.length === 1 ? "" : "s"})`
    : "";
  return message ? `Question for user: ${message}${fieldsSuffix}` : `Question for user${fieldsSuffix}`;
}

export function appendElicitationOutcomeEntry(record: AgentRecord, requestId: number, response: ElicitationResponse) {
  const status = response.action === "accept" ? "answered" : response.action === "decline" ? "skipped" : "cancelled";
  const summary = response.action === "accept"
    ? Object.entries(response.content)
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("/") : String(value)}`)
        .join(", ")
    : "";
  appendOutputEntry(record, {
    type: "elicitation",
    text: summary
      ? `Question ${status} for request ${requestId}: ${summary}`
      : `Question ${status} for request ${requestId}`,
    status,
    raw: { requestId, action: response.action, ...(response.action === "accept" ? { content: response.content } : {}) },
  });
}

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

function isModeSwitchPermission(params: acp.RequestPermissionRequest) {
  const toolCall = asRecord(params.toolCall);
  return asNonEmptyString(toolCall?.kind) === "switch_mode";
}

export function findPermissionOptionId(
  params: acp.RequestPermissionRequest,
  mode: "approve" | "deny",
  explicitOptionId?: string,
) {
  if (explicitOptionId && params.options.some((option) => option.optionId === explicitOptionId)) {
    return explicitOptionId;
  }
  const preferred = mode === "approve"
    ? params.options.find((option) => option.kind === "allow_always" || option.optionId === "allow_always" || option.optionId === "proceed_always")
      ?? params.options.find((option) => option.kind.startsWith("allow"))
    : params.options.find((option) => option.kind.startsWith("reject"));
  return preferred?.optionId ?? params.options[0]?.optionId ?? null;
}

export function findAutoApprovePermissionOptionId(params: acp.RequestPermissionRequest) {
  const preferred =
    params.options.find((option) => option.kind === "allow_always" || option.optionId === "allow_always" || option.optionId === "proceed_always")
    ?? params.options.find((option) => option.kind.startsWith("allow"));
  return preferred?.optionId ?? null;
}

export function appendPermissionOutcomeEntry(
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

export class RuntimeClient implements acp.Client {
  private readonly terminals: TerminalService;
  private readonly mcp: McpService;
  private readonly workspaceRoots: readonly string[];
  private startupPlanContext: WorkerPlanStartupContext | null;

  constructor(
    private readonly getRecord: () => AgentRecord | undefined,
    private readonly publishChunk: (name: string, chunk: string) => void,
    workspaceRoots: string | readonly string[] | null = null,
    mcpHandlers: ReadonlyMap<string, AcpMcpHandler> = registeredAcpMcpHandlersSnapshot(),
    private readonly extensions: ReadonlyMap<string, AcpExtensionHandler> = new Map(),
    startupPlanContext: WorkerPlanStartupContext | null = null,
  ) {
    this.startupPlanContext = startupPlanContext;
    this.workspaceRoots = typeof workspaceRoots === "string" ? [workspaceRoots] : workspaceRoots ?? [];
    this.mcp = new McpService(mcpHandlers, (action, resourceId) => {
      const record = this.getRecord();
      if (!record) return;
      emitNamedEvent({
        kind: action === "created" ? "acp.resource_created" : "acp.resource_released",
        workerId: record.name,
        resource: "mcp",
        resourceId,
      });
    });
    this.terminals = new TerminalService(
      (terminalId, snapshot) => {
        const record = this.getRecord();
        if (!record) return;
        appendOutputEntry(record, {
          type: "agent_content",
          text: snapshot.output,
          status: snapshot.exitStatus ? "completed" : "in_progress",
          raw: { content: { type: "terminal", terminalId, ...snapshot } },
        });
      },
      (action, terminalId) => {
        const record = this.getRecord();
        if (!record) return;
        emitNamedEvent({
          kind: action === "created" ? "acp.resource_created" : "acp.resource_released",
          workerId: record.name,
          resource: "terminal",
          resourceId: terminalId,
        });
      },
    );
  }

  setWorkerPlanStartupContext(context: WorkerPlanStartupContext | null) {
    this.startupPlanContext = context;
  }

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
    emitNamedEvent({ kind: "acp.interaction_requested", workerId: record.name, interaction: "permission", requestId });
    if (isFullAccessAgentMode(record.sessionMode) && !isModeSwitchPermission(params)) {
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

  async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (method === ELICITATION_CREATE_METHOD) {
      return this.unstable_createElicitation(params as unknown as acp.CreateElicitationRequest) as unknown as Record<string, unknown>;
    }
    if (method === acp.CLIENT_METHODS.mcp_connect) {
      return this.mcp.connect(params as acp.ConnectMcpRequest) as unknown as Record<string, unknown>;
    }
    if (method === acp.CLIENT_METHODS.mcp_message) {
      return this.mcp.message(params as acp.MessageMcpRequest) as unknown as Record<string, unknown>;
    }
    if (method === acp.CLIENT_METHODS.mcp_disconnect) {
      return this.mcp.disconnect(params as acp.DisconnectMcpRequest) as unknown as Record<string, unknown>;
    }
    const extension = this.extensions.get(method);
    if (extension?.request) return extension.request(params);
    throw acp.RequestError.methodNotFound(method);
  }

  async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
    if (method === acp.CLIENT_METHODS.mcp_message) {
      await this.mcp.notify(params as acp.MessageMcpNotification);
      return;
    }
    const extension = this.extensions.get(method);
    if (extension?.notify) return extension.notify(params);
    throw acp.RequestError.methodNotFound(method);
  }

  async unstable_createElicitation(
    params: acp.CreateElicitationRequest,
  ): Promise<acp.CreateElicitationResponse> {
    return this.createElicitation(params as ElicitationCreateParams);
  }

  async unstable_completeElicitation(params: acp.CompleteElicitationNotification): Promise<void> {
    const record = this.getRecord();
    if (!record) return;
    const index = record.pendingElicitations.findIndex((pending) => pending.params.elicitationId === params.elicitationId);
    if (index < 0) return;
    const [pending] = record.pendingElicitations.splice(index, 1);
    if (!pending) return;
    const response: ElicitationResponse = { action: "accept", content: {} };
    appendElicitationOutcomeEntry(record, pending.requestId, response);
    pending.resolve(response);
    record.updatedAt = nowIso();
  }

  private async createElicitation(params: ElicitationCreateParams): Promise<ElicitationResponse> {
    const record = this.getRecord();
    if (!record) {
      return { action: "cancel" };
    }
    if (params.mode !== "form" && params.mode !== "url") {
      return { action: "decline" };
    }
    const requestId = nextElicitationRequestId++;
    record.updatedAt = nowIso();
    record.state = "working";
    appendOutputEntry(record, {
      type: "elicitation",
      text: buildElicitationRequestText(params),
      status: "pending",
      raw: { ...params, requestId },
    });
    emitNamedEvent({ kind: "acp.interaction_requested", workerId: record.name, interaction: "elicitation", requestId });
    return new Promise((resolve) => {
      record.pendingElicitations.push({
        requestId,
        params,
        requestedAt: nowIso(),
        resolve,
      });
    });
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    const record = this.getRecord();
    const workspaceRoots = record ? [record.cwd, ...record.additionalDirectories] : this.workspaceRoots;
    if (workspaceRoots.length === 0) throw acp.RequestError.invalidParams({ path: params.path }, "Agent session is unavailable");
    const filePath = await resolveWorkspacePath(workspaceRoots, params.path, false);
    const content = await readFile(filePath, "utf8");
    return {
      content: selectTextFileRange(content, params.line, params.limit),
    };
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    const record = this.getRecord();
    const workspaceRoots = record ? [record.cwd, ...record.additionalDirectories] : this.workspaceRoots;
    if (workspaceRoots.length === 0) throw acp.RequestError.invalidParams({ path: params.path }, "Agent session is unavailable");
    const filePath = await resolveWorkspacePath(workspaceRoots, params.path, true);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, params.content, "utf8");
    return {};
  }

  createTerminal(params: acp.CreateTerminalRequest) {
    return this.terminals.create(params);
  }

  terminalOutput(params: acp.TerminalOutputRequest) {
    return this.terminals.output(params);
  }

  releaseTerminal(params: acp.ReleaseTerminalRequest) {
    return this.terminals.release(params);
  }

  waitForTerminalExit(params: acp.WaitForTerminalExitRequest) {
    return this.terminals.wait(params);
  }

  killTerminal(params: acp.KillTerminalRequest) {
    return this.terminals.kill(params);
  }

  dispose() {
    this.terminals.dispose();
    void this.mcp.dispose();
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const record = this.getRecord();
    const goalWorkerId = record?.name ?? this.startupPlanContext?.workerId;
    if (goalWorkerId && isAcpGoalNotification(params.update) && !isAcpPlanNotification(params.update)) {
      await handleAcpGoalSessionUpdateForWorker({
        workerId: goalWorkerId,
        agentCapabilities: record?.agentCapabilities,
        sessionId: params.sessionId,
        update: params.update,
      });
    }
    if (this.startupPlanContext && isAcpPlanNotification(params.update)) {
      const admission = bufferWorkerPlanStartupUpdate(this.startupPlanContext, {
        sessionId: params.sessionId,
        update: params.update,
      });
      if (admission !== "ignored") return;
    }
    const workerId = record?.name ?? this.startupPlanContext?.workerId;
    if (workerId && isAcpPlanNotification(params.update)) {
      const planResult = await handleAcpSessionUpdateForWorker({
        workerId,
        sessionId: params.sessionId,
        update: params.update,
      });
      if (planResult.kind !== "ignored") {
        if (record) record.updatedAt = nowIso();
        return;
      }
    }
    if (!record) {
      return;
    }
    const update = params.update;
    record.updatedAt = nowIso();

    if (update.sessionUpdate === "config_option_update") {
      const previousModelStatus = record.modelStatus;
      const previousEffortStatus = record.effortStatus;
      applyProviderConfigOptions(record, update.configOptions);
      if (
        (record.modelStatus === "rejected" && previousModelStatus !== "rejected")
        || (record.effortStatus === "rejected" && previousEffortStatus !== "rejected")
      ) {
        emitNamedEvent({
          kind: "error.surfaced",
          code: "worker.configuration.rejected",
          message: "The provider reported a different runtime configuration than the requested value.",
          surface: "toast",
          workerId: record.name,
          cause: null,
        });
      }
    } else if (update.sessionUpdate === "current_mode_update") {
      record.sessionMode = update.currentModeId;
    } else if (update.sessionUpdate === "session_info_update") {
      applyProviderThreadStatus(record, readProviderThreadStatus(update));
    }

    if (update.sessionUpdate === "usage_update") {
      applySessionUsageUpdate(record, update as unknown as Record<string, unknown>);
      settleUnpromptedTurnAtResult(record, update as unknown as Record<string, unknown>);
      if (isTurnResultUsageUpdate(update as unknown as Record<string, unknown>)) {
        record.promptTurnWatch?.onTurnResult();
      }
    } else if (
      update.sessionUpdate === "agent_message_chunk"
      || update.sessionUpdate === "agent_thought_chunk"
      || update.sessionUpdate === "tool_call"
    ) {
      // Only output a turn produces counts. Trailing usage, title and status
      // updates follow a turn's result and must not read as a new turn.
      record.promptTurnWatch?.onTurnActivity();
    }

    const normalized = normalizeSessionUpdate(update);
    if (normalized.kind === "message_chunk" && normalized.role === "agent") {
      const text = stripAgentControlText(normalized.text);
      if (text) {
        record.currentText = appendBoundedText(record.currentText, text, MAX_TEXT_FIELD_CHARS);
        record.lastText = record.currentText;
        appendMessageChunk(record, text, "message");
        this.publishChunk(record.name, text);
      }
      return;
    }

    if (normalized.kind === "message_chunk" && normalized.role === "thought") {
      const text = normalized.text;
      const isCwdThought = text.startsWith("[current working directory");
      if (text && !isCwdThought) {
        appendMessageChunk(record, text, "thought");
      }
      return;
    }

    if (normalized.kind === "message_chunk") {
      appendOutputEntry(record, {
        type: "user_message_chunk",
        text: normalized.text,
        raw: update,
      });
      return;
    }

    if (normalized.entry.type === "tool_call") {
      record.state = "working";
    }
    appendOutputEntry(record, normalized.entry);
    if ((update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") && Array.isArray(update.content)) {
      for (const item of update.content) {
        if (item.type === "content" && item.content.type !== "text") {
          appendOutputEntry(record, {
            type: "agent_content",
            text: item.content.type,
            toolCallId: update.toolCallId,
            raw: { content: item.content, toolCallId: update.toolCallId },
          });
        } else if (item.type === "terminal") {
          appendOutputEntry(record, {
            type: "agent_content",
            text: "",
            toolCallId: update.toolCallId,
            status: update.status ?? undefined,
            raw: { content: { type: "terminal", terminalId: item.terminalId }, toolCallId: update.toolCallId },
          });
        }
      }
    }
  }
}
