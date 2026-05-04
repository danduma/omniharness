import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { Agent } from "@mastra/core/agent";
import { eq } from "drizzle-orm";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { clarifications, executionEvents, messages as dbMessages, runs, settings, supervisorInterventions, workers } from "@/server/db/schema";
import { buildMastraModelConfig, getSupervisorModelConfig, validateSupervisorModelConfig } from "@/server/supervisor/model-config";
import { SUPERVISOR_SYSTEM_PROMPT } from "@/server/supervisor/prompt";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { buildSupervisorTools } from "@/server/supervisor/tools";
import { buildSupervisorTurnContext } from "@/server/supervisor/context";
import { buildSupervisorModelMessages } from "@/server/supervisor/context-window";
import { parseSupervisorToolCallFromMastra, SupervisorProtocolError } from "@/server/supervisor/protocol";
import { retrySupervisorRequest } from "@/server/supervisor/retry";
import { selectSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { parseAllowedWorkerTypes, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";
import { persistRunFailure } from "@/server/runs/failures";
import { isActiveImplementationRun } from "@/server/runs/status";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { recordSupervisorIntervention } from "@/server/supervisor/interventions";
import { drainQueuedImplementationMessages } from "@/server/conversations/queued-messages";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { parsePlan } from "@/server/plans/parser";
import { syncPlanItems } from "@/server/plans/checklist";
import { assessPlanReadiness } from "@/server/plans/readiness";
import { pauseForClarifications } from "@/server/clarifications/loop";
import { validateRun } from "@/server/validation";

export interface SupervisorOptions {
  runId: string;
}

export type SupervisorRunResult =
  | { state: "wait"; delayMs: number }
  | { state: "paused" }
  | { state: "completed" }
  | { state: "failed" };

function asString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SupervisorProtocolError(`Tool argument "${field}" must be a non-empty string.`);
  }
  return value.trim();
}

function asNumber(value: unknown, field: string) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new SupervisorProtocolError(`Tool argument "${field}" must be a finite number.`);
  }
  return value;
}

function asOptionalString(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return null;
  }

  return asString(value, field);
}

function asStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new SupervisorProtocolError(`Tool argument "${field}" must be an array of strings.`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function asOptionalStringArray(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return asStringArray(value, field);
}

function asOptionalMcpServers(value: unknown, field: string): bridge.BridgeMcpServer[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) {
    throw new SupervisorProtocolError(`Tool argument "${field}" must be an array of MCP server objects.`);
  }
  return value as bridge.BridgeMcpServer[];
}

function normalizeBridgeWorkerMode(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized || normalized === "auto") {
    return undefined;
  }

  return normalized;
}

const WORKER_YOLO_MODE_SETTING = "WORKER_YOLO_MODE";
const SUPERVISOR_FILE_READ_LIMIT = 60_000;
const SUPERVISOR_INSPECT_OUTPUT_LIMIT = 20_000;
const SUPERVISOR_INSPECT_TIMEOUT_MS = 10_000;
const WORKER_BUSY_RETRY_DELAY_MS = 5_000;
const SUPERVISOR_INSPECT_COMMANDS = new Set(["rg", "grep", "find", "sed", "awk", "head", "tail", "wc", "ls", "pwd"]);

function parseBooleanSettingValue(value: string | null | undefined, defaultValue: boolean) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function resolveWorkerSpawnMode(requestedMode: unknown, yoloModeEnabled: boolean) {
  const normalizedMode = normalizeBridgeWorkerMode(requestedMode);
  if (normalizedMode) {
    return normalizedMode;
  }

  return yoloModeEnabled ? "full-access" : undefined;
}

function isMissingAgentError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("404") || message.includes("not_found") || message.includes("agent not found");
}

function formatSupervisorError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isAgentBusyError(error: unknown) {
  return /\bagent is busy\b/i.test(formatSupervisorError(error));
}

function resolveSupervisorReadPath(requestedPath: string, projectPath: string | null | undefined) {
  if (path.isAbsolute(requestedPath)) {
    return requestedPath;
  }

  return path.resolve(projectPath || process.cwd(), requestedPath);
}

function readSupervisorFile(requestedPath: string, projectPath: string | null | undefined) {
  const absolutePath = resolveSupervisorReadPath(requestedPath, projectPath);
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new SupervisorProtocolError(`Path "${requestedPath}" is not a file.`);
  }

  const rawContent = fs.readFileSync(absolutePath, "utf8");
  const truncated = rawContent.length > SUPERVISOR_FILE_READ_LIMIT;
  return {
    absolutePath,
    content: truncated ? rawContent.slice(0, SUPERVISOR_FILE_READ_LIMIT) : rawContent,
    truncated,
  };
}

function isPathInside(childPath: string, parentPath: string) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveSupervisorInspectionCwd(cwd: string | null, projectPath: string | null | undefined) {
  const projectRoot = path.resolve(projectPath || process.cwd());
  const requestedCwd = cwd
    ? path.isAbsolute(cwd)
      ? path.resolve(cwd)
      : path.resolve(projectRoot, cwd)
    : projectRoot;

  if (!isPathInside(requestedCwd, projectRoot)) {
    throw new SupervisorProtocolError(`Inspection cwd must stay inside the run project directory: ${requestedCwd}`);
  }

  return requestedCwd;
}

function resolveSupervisorWorkerCwd(cwd: string, projectPath: string | null | undefined) {
  if (!projectPath) {
    return path.resolve(cwd);
  }

  return resolveSupervisorInspectionCwd(cwd, projectPath);
}

function validateSupervisorInspectArgs(command: string, args: string[]) {
  if (!SUPERVISOR_INSPECT_COMMANDS.has(command)) {
    throw new SupervisorProtocolError(`Unsupported inspection command "${command}".`);
  }

  if (args.some((arg) => arg.includes("\0"))) {
    throw new SupervisorProtocolError("Inspection arguments cannot contain NUL bytes.");
  }

  if (command === "find" && args.some((arg) => ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(arg))) {
    throw new SupervisorProtocolError("find inspection cannot use mutation or execution flags.");
  }

  if (command === "sed" && args.some((arg) => arg === "-i" || arg.startsWith("-i"))) {
    throw new SupervisorProtocolError("sed inspection cannot edit files in place.");
  }

  if (command === "awk" && args.some((arg) => /\bsystem\s*\(/.test(arg))) {
    throw new SupervisorProtocolError("awk inspection cannot execute shell commands.");
  }
}

function runSupervisorInspection(command: string, args: string[], cwd: string) {
  validateSupervisorInspectArgs(command, args);

  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: SUPERVISOR_INSPECT_TIMEOUT_MS,
    maxBuffer: SUPERVISOR_INSPECT_OUTPUT_LIMIT * 4,
  });

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const output = truncate([stdout, stderr ? `stderr:\n${stderr}` : ""].filter(Boolean).join("\n"), SUPERVISOR_INSPECT_OUTPUT_LIMIT);

  return {
    exitCode: result.status ?? (result.error ? 1 : 0),
    output,
    error: result.error instanceof Error ? result.error.message : null,
  };
}

function buildWorkerSpawnSummary({
  workerId,
  workerType,
  title,
  model,
  effort,
  mode,
  purpose,
  fallbackNote,
}: {
  workerId: string;
  workerType: keyof typeof WORKER_TYPE_LABELS;
  title?: string;
  model?: string | null;
  effort?: string | null;
  mode?: string;
  purpose?: string;
  fallbackNote?: string;
}) {
  const details = [
    `CLI: ${WORKER_TYPE_LABELS[workerType]}`,
    `Worker: ${workerId}`,
    `Model: ${model || "Default"}`,
    `Effort: ${effort || "Default"}`,
    `Mode: ${mode || "default"}`,
  ];

  if (title) {
    details.push(`Title: ${title}.`);
  }

  if (purpose) {
    details.push(`Purpose: ${purpose}.`);
  }

  if (fallbackNote) {
    details.push(fallbackNote.trim());
  }

  return `Spawned worker. ${details.join(" | ")}`;
}

async function insertRunMessage(runId: string, role: string, content: string, kind?: string, workerId?: string) {
  await db.insert(dbMessages).values({
    id: randomUUID(),
    runId,
    role,
    kind,
    content,
    workerId: workerId ?? null,
    createdAt: new Date(),
  });
  notifyEventStreamSubscribers();
}

async function insertExecutionEvent(
  runId: string,
  eventType: string,
  details: Record<string, unknown>,
  workerId?: string | null,
) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
  notifyEventStreamSubscribers();
}

function appendWorkerOutput(existingLog: string | null | undefined, nextChunk: string) {
  if (!nextChunk) {
    return existingLog ?? "";
  }

  if (!existingLog) {
    return nextChunk;
  }

  const separator = existingLog.endsWith("\n") || nextChunk.startsWith("\n") ? "" : "\n";
  return `${existingLog}${separator}${nextChunk}`;
}

async function reserveWorkerRow(args: {
  runId: string;
  workerType: string;
  cwd: string;
  title: string;
  initialPrompt: string;
}) {
  const { workerId, workerNumber } = await allocateWorkerIdentity(args.runId);

  await db.insert(workers).values({
    id: workerId,
    runId: args.runId,
    type: args.workerType,
    status: "starting",
    cwd: args.cwd,
    workerNumber,
    title: args.title,
    initialPrompt: args.initialPrompt,
    outputLog: "",
    outputEntriesJson: "",
    currentText: "",
    lastText: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  notifyEventStreamSubscribers();

  return workerId;
}

function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isActiveWorkerStatus(status: string | null | undefined) {
  return ["starting", "working", "idle", "stuck"].includes(normalizeWorkerStatus(status));
}

function describesSeparatedAllocation(...values: Array<string | null | undefined>) {
  const text = values.join("\n").toLowerCase();
  const hasExplicitOnly = /\bonly\b/.test(text);
  const hasConcreteSlice = /\b(part\s+[a-z0-9]+|slice|component|module|file|area|phase|section)\b/.test(text);
  const reviewsExistingWorker = /\b(review|audit|validate|validator|validation)\b/.test(text)
    && /\b(worker|output|result|diff|patch)\b/.test(text);
  return (hasExplicitOnly && hasConcreteSlice) || reviewsExistingWorker;
}

async function findActiveMainWorker(runId: string) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  return runWorkers.find((worker) => {
    if (!isActiveWorkerStatus(worker.status)) {
      return false;
    }

    return !describesSeparatedAllocation(worker.title, worker.initialPrompt);
  }) ?? null;
}

async function persistWorkerOutput(workerId: string, output: string) {
  if (!output) {
    return;
  }

  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker) {
    return;
  }

  await db.update(workers).set({
    outputLog: appendWorkerOutput(worker.outputLog, output),
    updatedAt: new Date(),
  }).where(eq(workers.id, workerId));
  notifyEventStreamSubscribers();
}

async function deferBusyWorkerPrompt(runId: string, workerId: string, prompt: string, error: unknown): Promise<SupervisorRunResult> {
  const errorMessage = formatSupervisorError(error);
  const summary = `${workerId} is already busy; waiting before sending another prompt.`;

  await db.update(workers).set({
    status: "working",
    updatedAt: new Date(),
  }).where(eq(workers.id, workerId));
  await insertExecutionEvent(runId, "worker_prompt_deferred", {
    summary,
    prompt,
    error: errorMessage,
  }, workerId);

  return { state: "wait", delayMs: WORKER_BUSY_RETRY_DELAY_MS };
}

async function cancelRunWorkers(runId: string) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  for (const worker of runWorkers) {
    try {
      const snapshot = await bridge.getAgent(worker.id);
      await persistWorkerSnapshot(worker.id, snapshot);
    } catch {
      // best effort snapshot capture before shutdown
    }
    try {
      await bridge.cancelAgent(worker.id);
    } catch {
      // best effort shutdown
    }
    await db.update(workers).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
  }
}

export class Supervisor {
  private readonly runId: string;

  constructor(options: SupervisorOptions) {
    this.runId = options.runId;
  }

  private async createModel() {
    const allSettings = await db.select().from(settings);
    const { env: envParams, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
    const settingValues = new Map(allSettings.map((setting) => [setting.key, setting.value]));
    Object.entries(envParams).forEach(([key, value]) => {
      process.env[key] = value;
    });

    const llmConfig = getSupervisorModelConfig(process.env);
    validateSupervisorModelConfig(llmConfig, decryptionFailures);

    return {
      llmConfig,
      envParams,
      yoloModeEnabled: parseBooleanSettingValue(settingValues.get(WORKER_YOLO_MODE_SETTING), true),
    };
  }

  private async requestToolCalls(llmConfig: ReturnType<typeof getSupervisorModelConfig>, heartbeatCount: number) {
    const context = await buildSupervisorTurnContext(this.runId);
    const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
    if (!run) {
      throw new Error(`Run ${this.runId} not found`);
    }

    const promptBundle = buildSupervisorModelMessages({
      systemPrompt: SUPERVISOR_SYSTEM_PROMPT,
      context,
      heartbeatCount,
      runStatus: run.status,
    });

    if (promptBundle.stats.compacted) {
      await insertExecutionEvent(this.runId, "supervisor_context_compacted", {
        summary: "Compacted supervisor context before model request.",
        estimatedTokens: promptBundle.stats.estimatedTokens,
        budgetTokens: promptBundle.stats.budgetTokens,
        reason: promptBundle.stats.reason,
        memorySummary: promptBundle.stats.memorySummary,
      });
    }

    const agent = new Agent({
      id: "omniharness-supervisor",
      name: "OmniHarness Supervisor",
      instructions: SUPERVISOR_SYSTEM_PROMPT,
      model: buildMastraModelConfig(llmConfig),
      tools: buildSupervisorTools({
        preferredWorkerType: context.preferredWorkerType,
        allowedWorkerTypes: context.allowedWorkerTypes,
      }),
    });

    const completion = await retrySupervisorRequest(() => agent.generate(promptBundle.messages, {
      maxSteps: 1,
      toolChoice: "required",
      runId: `${this.runId}:heartbeat:${heartbeatCount}`,
    }));

    return completion.toolCalls;
  }

  private async loadActiveRun() {
    const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
    return isActiveImplementationRun(run) ? run : null;
  }

  private async cleanupWorkerAfterInactiveRun(workerId: string, snapshot?: bridge.AgentRecord | null) {
    try {
      await bridge.cancelAgent(workerId);
    } catch {
      // best-effort cleanup after another actor has terminally closed the run
    }

    await db.update(workers).set({
      status: "cancelled",
      ...(snapshot?.sessionId ? { bridgeSessionId: snapshot.sessionId } : {}),
      ...(snapshot?.sessionMode ? { bridgeSessionMode: snapshot.sessionMode } : {}),
      updatedAt: new Date(),
    }).where(eq(workers.id, workerId));
  }

  async run(): Promise<SupervisorRunResult> {
    const currentRun = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
    if (!isActiveImplementationRun(currentRun)) {
      return { state: "completed" };
    }

    const { llmConfig, envParams, yoloModeEnabled } = await this.createModel();

    if (!await this.loadActiveRun()) {
      return { state: "completed" };
    }

    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, this.runId));

    await drainQueuedImplementationMessages(this.runId);

    const pendingClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, this.runId));
    if (pendingClarifications.some((clarification) => clarification.status === "pending")) {
      if (!await this.loadActiveRun()) {
        return { state: "completed" };
      }
      await db.update(runs).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(runs.id, this.runId));
      return { state: "paused" };
    }

    const toolCalls = await this.requestToolCalls(llmConfig, 0);
    if (!await this.loadActiveRun()) {
      return { state: "completed" };
    }

    const action = parseSupervisorToolCallFromMastra(toolCalls);

    switch (action.name) {
        case "worker_spawn": {
          const requestedType = asString(action.args.type, "type");
          const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
          const allowedWorkerTypes = parseAllowedWorkerTypes(run?.allowedWorkerTypes);
          const workerType = selectSpawnableWorkerType(requestedType, envParams, allowedWorkerTypes);
          const cwd = resolveSupervisorWorkerCwd(asString(action.args.cwd, "cwd"), run?.projectPath);
          const title = asString(action.args.title, "title");
          const prompt = asString(action.args.prompt, "prompt");
          const mode = resolveWorkerSpawnMode(action.args.mode, yoloModeEnabled);
          const purpose = typeof action.args.purpose === "string" ? action.args.purpose.trim() : "";
          const skillRoots = asOptionalStringArray(action.args.skillRoots, "skillRoots");
          const mcpServers = asOptionalMcpServers(action.args.mcpServers, "mcpServers");
          const activeMainWorker = await findActiveMainWorker(this.runId);
          if (activeMainWorker && !describesSeparatedAllocation(title, purpose, prompt)) {
            await insertExecutionEvent(this.runId, "worker_spawn_blocked", {
              summary: `Blocked duplicate worker spawn because ${this.runId} already has active implementation worker ${activeMainWorker.id}.`,
              requestedTitle: title,
              requestedPurpose: purpose,
              activeWorkerId: activeMainWorker.id,
            });
            return { state: "wait", delayMs: 5_000 };
          }
          const workerId = await reserveWorkerRow({
            runId: this.runId,
            workerType: workerType.type,
            cwd,
            title,
            initialPrompt: prompt,
          });
          const preferredModel = run?.preferredWorkerModel ?? null;
          const preferredEffort = run?.preferredWorkerEffort ?? null;

          let spawnedWorker: bridge.AgentRecord;
          try {
            spawnedWorker = await bridge.spawnAgent({
              type: workerType.type,
              cwd,
              name: workerId,
              ...(mode ? { mode } : {}),
              env: envParams,
              ...(preferredModel ? { model: preferredModel } : {}),
              ...(preferredEffort ? { effort: preferredEffort } : {}),
              ...(skillRoots?.length ? { skillRoots } : {}),
              ...(mcpServers?.length ? { mcpServers } : {}),
            });
          } catch (error) {
            await db.update(workers).set({
              status: "error",
              updatedAt: new Date(),
            }).where(eq(workers.id, workerId));
            throw error;
          }

          if (!await this.loadActiveRun()) {
            await this.cleanupWorkerAfterInactiveRun(workerId, spawnedWorker);
            return { state: "completed" };
          }

          await db.update(workers).set({
            bridgeSessionId: spawnedWorker.sessionId ?? null,
            bridgeSessionMode: spawnedWorker.sessionMode ?? mode ?? null,
            updatedAt: new Date(),
          }).where(eq(workers.id, workerId));

          const fallbackNote =
            workerType.type !== workerType.requestedType
              ? `Fallback: requested ${workerType.requestedType}, used ${workerType.type} because ${workerType.fallbackReason}.`
              : "";
          const spawnSummary = buildWorkerSpawnSummary({
            workerId,
            workerType: workerType.type,
            title,
            model: preferredModel,
            effort: preferredEffort,
            mode,
            purpose,
            fallbackNote,
          });
          await insertExecutionEvent(this.runId, "worker_spawned", {
            summary: spawnSummary,
            purpose,
            mode,
            model: preferredModel,
            effort: preferredEffort,
            requestedType: workerType.requestedType,
            fallbackReason: workerType.fallbackReason,
          }, workerId);

          try {
            const response = await bridge.askAgent(workerId, prompt);
            if (!await this.loadActiveRun()) {
              await this.cleanupWorkerAfterInactiveRun(workerId, spawnedWorker);
              return { state: "completed" };
            }
            await persistWorkerOutput(workerId, response.response);

            await db.update(workers).set({
              status: purpose ? `${response.state}: ${purpose}` : response.state,
              updatedAt: new Date(),
            }).where(eq(workers.id, workerId));
          } catch (error) {
            if (isAgentBusyError(error)) {
              return deferBusyWorkerPrompt(this.runId, workerId, prompt, error);
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            await db.update(workers).set({
              status: "error",
              updatedAt: new Date(),
            }).where(eq(workers.id, workerId));
            await insertExecutionEvent(this.runId, "worker_prompt_failed", {
              summary: `Initial prompt failed for ${workerId}`,
              error: errorMessage,
            }, workerId);
            throw error;
          }

          return { state: "wait", delayMs: 5_000 };
        }

        case "worker_continue": {
          const workerId = asString(action.args.workerId, "workerId");
          const prompt = asString(action.args.prompt, "prompt");
          const interventionType = typeof action.args.interventionType === "string" ? action.args.interventionType : null;
          let response: Awaited<ReturnType<typeof bridge.askAgent>>;
          try {
            response = await bridge.askAgent(workerId, prompt);
          } catch (error) {
            if (isAgentBusyError(error)) {
              return deferBusyWorkerPrompt(this.runId, workerId, prompt, error);
            }

            throw error;
          }
          if (!await this.loadActiveRun()) {
            await this.cleanupWorkerAfterInactiveRun(workerId);
            return { state: "completed" };
          }
          await persistWorkerOutput(workerId, response.response);

          await db.update(workers).set({
            status: response.state,
            updatedAt: new Date(),
          }).where(eq(workers.id, workerId));

          await insertExecutionEvent(this.runId, "worker_prompted", {
            summary: `Sent follow-up to ${workerId}`,
            prompt,
          }, workerId);
          await recordSupervisorIntervention({
            runId: this.runId,
            workerId,
            prompt,
            summary: `Sent follow-up to ${workerId}`,
            interventionType,
          });
          return { state: "wait", delayMs: 5_000 };
        }

        case "worker_cancel": {
          const workerId = asString(action.args.workerId, "workerId");
          const reason = asString(action.args.reason, "reason");
          try {
            await bridge.cancelAgent(workerId);
          } catch (error) {
            if (!isMissingAgentError(error)) {
              throw error;
            }
          }
          await db.update(workers).set({
            status: "cancelled",
            updatedAt: new Date(),
          }).where(eq(workers.id, workerId));
          await insertExecutionEvent(this.runId, "worker_cancelled", {
            summary: `Cancelled ${workerId}`,
            reason,
          }, workerId);
          return { state: "wait", delayMs: 1_000 };
        }

        case "worker_set_mode": {
          const workerId = asString(action.args.workerId, "workerId");
          const mode = asString(action.args.mode, "mode");
          await bridge.setWorkerMode(workerId, mode);
          await insertExecutionEvent(this.runId, "worker_mode_changed", {
            summary: `Set ${workerId} mode to ${mode}`,
            mode,
          }, workerId);
          return { state: "wait", delayMs: 1_000 };
        }

        case "worker_approve": {
          const workerId = asString(action.args.workerId, "workerId");
          const reason = asString(action.args.reason, "reason");
          const optionId =
            typeof action.args.optionId === "string" && action.args.optionId.trim().length > 0
              ? action.args.optionId.trim()
              : undefined;
          await bridge.approvePermission(workerId, optionId);
          await insertExecutionEvent(this.runId, "worker_permission_approved", {
            summary: `Approved permission for ${workerId}`,
            reason,
            optionId,
          }, workerId);
          return { state: "wait", delayMs: 1_000 };
        }

        case "worker_deny": {
          const workerId = asString(action.args.workerId, "workerId");
          const reason = asString(action.args.reason, "reason");
          const optionId =
            typeof action.args.optionId === "string" && action.args.optionId.trim().length > 0
              ? action.args.optionId.trim()
              : undefined;
          await bridge.denyPermission(workerId, optionId);
          await insertExecutionEvent(this.runId, "worker_permission_denied", {
            summary: `Denied permission for ${workerId}`,
            reason,
            optionId,
          }, workerId);
          return { state: "wait", delayMs: 1_000 };
        }

        case "ask_user": {
          const question = asString(action.args.question, "question");
          const now = new Date();
          await db.insert(clarifications).values({
            id: randomUUID(),
            runId: this.runId,
            question,
            answer: null,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          });
          await db.update(runs).set({ status: "awaiting_user", updatedAt: now }).where(eq(runs.id, this.runId));
          await insertExecutionEvent(this.runId, "clarification_requested", {
            summary: question,
          });
          await insertRunMessage(this.runId, "supervisor", question, "clarification");
          return { state: "paused" };
        }

        case "read_file": {
          const requestedPath = asString(action.args.path, "path");
          const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
          const { absolutePath, content, truncated } = readSupervisorFile(requestedPath, run?.projectPath);
          const parsedPlan = requestedPath.endsWith(".md") || absolutePath.endsWith(".md")
            ? parsePlan(content)
            : null;
          await insertExecutionEvent(this.runId, "supervisor_file_read", {
            summary: `Read ${requestedPath} for supervisor context.`,
            path: requestedPath,
            absolutePath,
            content,
            truncated,
            parsedPlanItems: parsedPlan?.items.length ?? 0,
          });

          if (run && parsedPlan && parsedPlan.items.length > 0) {
            await syncPlanItems(run.planId, parsedPlan.items);
            await insertExecutionEvent(this.runId, "plan_items_synced", {
              summary: `Synced ${parsedPlan.items.length} checklist items from ${requestedPath}.`,
              path: requestedPath,
              itemCount: parsedPlan.items.length,
            });

            const readiness = await assessPlanReadiness(parsedPlan);
            if (!readiness.ready) {
              await pauseForClarifications(this.runId, readiness.questions);
              await insertRunMessage(
                this.runId,
                "supervisor",
                `I need clarification before implementation can continue:\n\n${readiness.questions.map((question) => `- ${question}`).join("\n")}`,
                "clarification",
              );
              return { state: "paused" };
            }
          }

          return { state: "wait", delayMs: 1_000 };
        }

        case "inspect_repo": {
          const command = asString(action.args.command, "command");
          const args = asStringArray(action.args.args, "args");
          const requestedCwd = asOptionalString(action.args.cwd, "cwd");
          const reason = asOptionalString(action.args.reason, "reason");
          const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
          const cwd = resolveSupervisorInspectionCwd(requestedCwd, run?.projectPath);
          const result = runSupervisorInspection(command, args, cwd);
          const displayCommand = [command, ...args].join(" ");
          const summary = `Inspected repository with ${displayCommand}${reason ? `: ${reason}` : "."}`;
          await insertExecutionEvent(this.runId, "supervisor_repo_inspected", {
            summary,
            command,
            args,
            cwd,
            reason,
            exitCode: result.exitCode,
            output: result.output,
            error: result.error,
          });
          return { state: "wait", delayMs: 1_000 };
        }

        case "wait_until": {
          const seconds = Math.max(1, Math.min(300, Math.round(asNumber(action.args.seconds, "seconds"))));
          const reason = asString(action.args.reason, "reason");
          await insertExecutionEvent(this.runId, "supervisor_wait", {
            summary: reason,
            seconds,
          });
          return { state: "wait", delayMs: seconds * 1000 };
        }

        case "mark_complete": {
          const summary = asString(action.args.summary, "summary");
          const validation = await validateRun(this.runId);
          if (!validation.ok) {
            const failureSummary = validation.failures.join("; ") || "Validation did not produce passing evidence.";
            await insertExecutionEvent(this.runId, "run_validation_failed", {
              summary: failureSummary,
              failures: validation.failures,
            });
            return { state: "wait", delayMs: 1_000 };
          }

          await cancelRunWorkers(this.runId);
          if (!await this.loadActiveRun()) {
            return { state: "completed" };
          }
          const interventions = await db
            .select()
            .from(supervisorInterventions)
            .where(eq(supervisorInterventions.runId, this.runId));
          const interventionSummary = interventions
            .map((intervention, index) => `${index + 1}. ${intervention.workerId ?? "worker"}: ${intervention.prompt}`)
            .join("\n");
          const completionSummary = interventionSummary
            ? `${summary}\n\nSupervisor interventions (${interventions.length}):\n${interventionSummary}`
            : summary;
          await db.update(runs).set({ status: "done", updatedAt: new Date() }).where(eq(runs.id, this.runId));
          await insertExecutionEvent(this.runId, "run_completed", {
            summary,
            interventionCount: interventions.length,
            interventions: interventions.map((intervention) => ({
              workerId: intervention.workerId,
              interventionType: intervention.interventionType,
              prompt: intervention.prompt,
              createdAt: intervention.createdAt.toISOString(),
            })),
          });
          await insertRunMessage(this.runId, "supervisor", completionSummary, "completion");
          return { state: "completed" };
        }

        case "mark_failed": {
          const reason = asString(action.args.reason, "reason");
          await cancelRunWorkers(this.runId);
          if (!await this.loadActiveRun()) {
            return { state: "completed" };
          }
          await insertExecutionEvent(this.runId, "run_failed", { reason });
          await persistRunFailure(this.runId, reason);
          return { state: "failed" };
        }

        default:
          throw new SupervisorProtocolError(`Unknown tool "${action.name}".`);
    }
  }
}
