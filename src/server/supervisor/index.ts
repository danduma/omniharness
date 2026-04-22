import { randomUUID } from "crypto";
import { TokenJS } from "token.js";
import { eq } from "drizzle-orm";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { clarifications, executionEvents, messages as dbMessages, runs, settings, workers } from "@/server/db/schema";
import { configureSupervisorModel, getSupervisorModelConfig, validateSupervisorModelConfig } from "@/server/supervisor/model-config";
import { SUPERVISOR_SYSTEM_PROMPT } from "@/server/supervisor/prompt";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { buildSupervisorTools } from "@/server/supervisor/tools";
import { buildSupervisorTurnContext } from "@/server/supervisor/context";
import { parseSupervisorToolCall, SupervisorProtocolError } from "@/server/supervisor/protocol";
import { retrySupervisorRequest } from "@/server/supervisor/retry";
import { selectSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { parseAllowedWorkerTypes, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";

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

function buildWorkerSpawnSummary({
  workerId,
  workerType,
  model,
  effort,
  mode,
  purpose,
  fallbackNote,
}: {
  workerId: string;
  workerType: keyof typeof WORKER_TYPE_LABELS;
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
}

async function cancelRunWorkers(runId: string) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  for (const worker of runWorkers) {
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
    const tokenjs = new TokenJS({
      apiKey: llmConfig.apiKey,
      baseURL: llmConfig.baseURL,
    });
    configureSupervisorModel(process.env, tokenjs);

    return {
      tokenjs,
      llmConfig,
      envParams,
      yoloModeEnabled: parseBooleanSettingValue(settingValues.get(WORKER_YOLO_MODE_SETTING), true),
    };
  }

  private async requestAction(tokenjs: TokenJS, llmConfig: ReturnType<typeof configureSupervisorModel>, heartbeatCount: number) {
    const context = await buildSupervisorTurnContext(this.runId);
    const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
    if (!run) {
      throw new Error(`Run ${this.runId} not found`);
    }

    const observationSummary = JSON.stringify({
      heartbeatCount,
      projectPath: context.projectPath,
      preferredWorkerType: context.preferredWorkerType,
      allowedWorkerTypes: context.allowedWorkerTypes,
      pendingClarifications: context.pendingClarifications,
      answeredClarifications: context.answeredClarifications,
      activeWorkers: context.activeWorkers,
      recentEvents: context.recentEvents,
      runStatus: run.status,
    }, null, 2);

    const completion = await retrySupervisorRequest(() => tokenjs.chat.completions.create({
      provider: llmConfig.provider as never,
      model: llmConfig.model as never,
      messages: [
        { role: "system", content: SUPERVISOR_SYSTEM_PROMPT },
        ...context.recentUserMessages.map((content) => ({ role: "user" as const, content })),
        {
          role: "system" as const,
          content: `Current supervision snapshot:\n\n${observationSummary}`,
        },
      ],
      tools: buildSupervisorTools({
        preferredWorkerType: context.preferredWorkerType,
        allowedWorkerTypes: context.allowedWorkerTypes,
      }),
      tool_choice: "required",
    }));

    return {
      context,
      action: parseSupervisorToolCall(completion.choices[0]?.message?.tool_calls),
    };
  }

  async run(): Promise<SupervisorRunResult> {
    const { tokenjs, llmConfig, envParams, yoloModeEnabled } = await this.createModel();

    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, this.runId));

    const currentRun = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
    if (!currentRun || currentRun.status === "done" || currentRun.status === "failed") {
      return { state: "completed" };
    }

    const pendingClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, this.runId));
    if (pendingClarifications.some((clarification) => clarification.status === "pending")) {
      await db.update(runs).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(runs.id, this.runId));
      return { state: "paused" };
    }

    const { action } = await this.requestAction(tokenjs, llmConfig, 0);

    switch (action.name) {
        case "worker_spawn": {
          const requestedType = asString(action.args.type, "type");
          const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
          const allowedWorkerTypes = parseAllowedWorkerTypes(run?.allowedWorkerTypes);
          const workerType = selectSpawnableWorkerType(requestedType, envParams, allowedWorkerTypes);
          const cwd = asString(action.args.cwd, "cwd");
          const prompt = asString(action.args.prompt, "prompt");
          const mode = resolveWorkerSpawnMode(action.args.mode, yoloModeEnabled);
          const purpose = typeof action.args.purpose === "string" ? action.args.purpose.trim() : "";
          const workerId = `worker-${Date.now()}`;
          const preferredModel = run?.preferredWorkerModel ?? null;
          const preferredEffort = run?.preferredWorkerEffort ?? null;

          const spawnedWorker = await bridge.spawnAgent({
            type: workerType.type,
            cwd,
            name: workerId,
            ...(mode ? { mode } : {}),
            env: envParams,
            ...(preferredModel ? { model: preferredModel } : {}),
            ...(preferredEffort ? { effort: preferredEffort } : {}),
          });

          await db.insert(workers).values({
            id: workerId,
            runId: this.runId,
            type: workerType.type,
            status: "starting",
            cwd,
            outputLog: "",
            bridgeSessionId: spawnedWorker.sessionId ?? null,
            bridgeSessionMode: spawnedWorker.sessionMode ?? mode ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const fallbackNote =
            workerType.type !== workerType.requestedType
              ? `Fallback: requested ${workerType.requestedType}, used ${workerType.type} because ${workerType.fallbackReason}.`
              : "";
          const spawnSummary = buildWorkerSpawnSummary({
            workerId,
            workerType: workerType.type,
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
          await insertRunMessage(
            this.runId,
            "system",
            spawnSummary,
            "supervisor_action",
          );

          try {
            const response = await bridge.askAgent(workerId, prompt);
            await persistWorkerOutput(workerId, response.response);

            await db.update(workers).set({
              status: purpose ? `${response.state}: ${purpose}` : response.state,
              updatedAt: new Date(),
            }).where(eq(workers.id, workerId));

            await insertRunMessage(
              this.runId,
              "worker",
              `Prompted ${workerId}:\n${prompt}\n\nInitial response:\n${response.response}`.slice(0, 4000),
              "worker_output",
              workerId,
            );
          } catch (error) {
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
          const response = await bridge.askAgent(workerId, prompt);
          await persistWorkerOutput(workerId, response.response);

          await db.update(workers).set({
            status: response.state,
            updatedAt: new Date(),
          }).where(eq(workers.id, workerId));

          await insertExecutionEvent(this.runId, "worker_prompted", {
            summary: `Sent follow-up to ${workerId}`,
            prompt,
          }, workerId);
          await insertRunMessage(this.runId, "worker", `Prompted ${workerId}:\n${prompt}\n\nResponse:\n${response.response}`.slice(0, 4000), "worker_output", workerId);
          return { state: "wait", delayMs: 5_000 };
        }

        case "worker_cancel": {
          const workerId = asString(action.args.workerId, "workerId");
          const reason = asString(action.args.reason, "reason");
          await bridge.cancelAgent(workerId);
          await db.delete(workers).where(eq(workers.id, workerId));
          await insertExecutionEvent(this.runId, "worker_cancelled", {
            summary: `Cancelled ${workerId}`,
            reason,
          }, workerId);
          await insertRunMessage(this.runId, "system", `Cancelled ${workerId}: ${reason}`, "supervisor_action");
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
          await insertRunMessage(this.runId, "system", `Set ${workerId} mode to ${mode}.`, "supervisor_action");
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
          await insertRunMessage(
            this.runId,
            "system",
            `Approved permission for ${workerId}: ${reason}${optionId ? ` (option: ${optionId})` : ""}`,
            "supervisor_action",
          );
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
          await insertRunMessage(
            this.runId,
            "system",
            `Denied permission for ${workerId}: ${reason}${optionId ? ` (option: ${optionId})` : ""}`,
            "supervisor_action",
          );
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

        case "wait_until": {
          const seconds = Math.max(1, Math.min(300, Math.round(asNumber(action.args.seconds, "seconds"))));
          const reason = asString(action.args.reason, "reason");
          await insertExecutionEvent(this.runId, "supervisor_wait", {
            summary: reason,
            seconds,
          });
          await insertRunMessage(this.runId, "system", `Waiting ${seconds}s before the next check: ${reason}`, "supervisor_action");
          return { state: "wait", delayMs: seconds * 1000 };
        }

        case "mark_complete": {
          const summary = asString(action.args.summary, "summary");
          await cancelRunWorkers(this.runId);
          await db.update(runs).set({ status: "done", updatedAt: new Date() }).where(eq(runs.id, this.runId));
          await insertExecutionEvent(this.runId, "run_completed", { summary });
          await insertRunMessage(this.runId, "supervisor", summary, "completion");
          return { state: "completed" };
        }

        case "mark_failed": {
          const reason = asString(action.args.reason, "reason");
          await cancelRunWorkers(this.runId);
          await db.update(runs).set({
            status: "failed",
            failedAt: new Date(),
            lastError: reason,
            updatedAt: new Date(),
          }).where(eq(runs.id, this.runId));
          await insertExecutionEvent(this.runId, "run_failed", { reason });
          await insertRunMessage(this.runId, "system", `Run failed: ${reason}`, "error");
          return { state: "failed" };
        }

        default:
          throw new SupervisorProtocolError(`Unknown tool "${action.name}".`);
    }
  }
}
