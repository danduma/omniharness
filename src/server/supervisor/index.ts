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

    return { tokenjs, llmConfig, envParams };
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
      tools: buildSupervisorTools(),
      tool_choice: "required",
    }));

    return {
      context,
      action: parseSupervisorToolCall(completion.choices[0]?.message?.tool_calls),
    };
  }

  async run(): Promise<SupervisorRunResult> {
    const { tokenjs, llmConfig, envParams } = await this.createModel();

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
          const type = asString(action.args.type, "type");
          const cwd = asString(action.args.cwd, "cwd");
          const prompt = asString(action.args.prompt, "prompt");
          const mode = typeof action.args.mode === "string" ? action.args.mode : "auto";
          const purpose = typeof action.args.purpose === "string" ? action.args.purpose.trim() : "";
          const workerId = `worker-${Date.now()}`;

          await bridge.spawnAgent({
            type,
            cwd,
            name: workerId,
            mode,
            env: envParams,
          });
          const response = await bridge.askAgent(workerId, prompt);

          await db.insert(workers).values({
            id: workerId,
            runId: this.runId,
            type,
            status: purpose ? `${response.state}: ${purpose}` : response.state,
            cwd,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await insertExecutionEvent(this.runId, "worker_spawned", {
            summary: `Spawned ${type} worker ${workerId}`,
            purpose,
            mode,
          }, workerId);
          await insertRunMessage(this.runId, "system", `Spawned ${type} worker ${workerId}.${purpose ? ` Purpose: ${purpose}.` : ""}`, "supervisor_action");
          await insertRunMessage(this.runId, "worker", `Prompted ${workerId}:\n${prompt}\n\nInitial response:\n${response.response}`.slice(0, 4000), "worker_output", workerId);
          return { state: "wait", delayMs: 5_000 };
        }

        case "worker_continue": {
          const workerId = asString(action.args.workerId, "workerId");
          const prompt = asString(action.args.prompt, "prompt");
          const response = await bridge.askAgent(workerId, prompt);

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
          await bridge.approvePermission(workerId);
          await insertExecutionEvent(this.runId, "worker_permission_approved", {
            summary: `Approved permission for ${workerId}`,
            reason,
          }, workerId);
          await insertRunMessage(this.runId, "system", `Approved permission for ${workerId}: ${reason}`, "supervisor_action");
          return { state: "wait", delayMs: 1_000 };
        }

        case "worker_deny": {
          const workerId = asString(action.args.workerId, "workerId");
          const reason = asString(action.args.reason, "reason");
          await bridge.denyPermission(workerId);
          await insertExecutionEvent(this.runId, "worker_permission_denied", {
            summary: `Denied permission for ${workerId}`,
            reason,
          }, workerId);
          await insertRunMessage(this.runId, "system", `Denied permission for ${workerId}: ${reason}`, "supervisor_action");
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
