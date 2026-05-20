import { desc, eq } from "drizzle-orm";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { messages, workers } from "@/server/db/schema";
import { listExecutionEventsForWorker } from "@/server/events/execution-event-store";
import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
import { normalizeWorkerType, type SupportedWorkerType } from "@/server/supervisor/worker-types";
import { parseHandoffReply, type HandoffReport } from "./parser";
import { HANDOFF_REQUEST_PROMPT } from "./render";

const DEFAULT_HANDOFF_TIMEOUT_MS = 60_000;

class HandoffTimeoutError extends Error {
  constructor(ms: number) {
    super(`Handoff request timed out after ${ms}ms`);
    this.name = "HandoffTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new HandoffTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type RequestHandoffArgs = {
  runId: string;
  workerId: string;
  reason: string;
  timeoutMs?: number;
};

export type RequestHandoffResult =
  | { ok: true; report: HandoffReport }
  | { ok: false; reason: "no_worker" | "timeout" | "quota" | "no_block" | "malformed" | "error"; error?: unknown };

/**
 * Ask the outgoing worker for a structured handoff report. Used by the
 * failover orchestrator before tearing down the worker. The caller is
 * expected to fall back to a synthetic handoff on any non-ok result.
 *
 * This is intentionally NOT a supervisor tool — failover is deterministic
 * recovery, and the model should not be able to skip it.
 */
export async function requestWorkerHandoff(args: RequestHandoffArgs): Promise<RequestHandoffResult> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_HANDOFF_TIMEOUT_MS;
  const worker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
  if (!worker) {
    return { ok: false, reason: "no_worker" };
  }
  if (!worker.bridgeSessionId) {
    return { ok: false, reason: "no_worker" };
  }

  const workerType = normalizeWorkerType(worker.type) as SupportedWorkerType;

  let response: Awaited<ReturnType<typeof bridge.askAgent>>;
  try {
    response = await withTimeout(bridge.askAgent(args.workerId, HANDOFF_REQUEST_PROMPT), timeoutMs);
  } catch (error) {
    if (error instanceof HandoffTimeoutError) {
      return { ok: false, reason: "timeout", error };
    }
    const quotaInfo = extractQuotaResetInfo(error);
    if (quotaInfo.isQuotaError) {
      return { ok: false, reason: "quota", error };
    }
    return { ok: false, reason: "error", error };
  }

  const parsed = parseHandoffReply({
    text: response.response,
    outgoingWorkerType: workerType,
    outgoingWorkerId: args.workerId,
    reason: args.reason,
  });
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason === "no_block" ? "no_block" : "malformed" };
  }
  return { ok: true, report: parsed.report };
}

/**
 * Build a best-effort handoff report from persisted state when the
 * outgoing worker can't (or won't) produce one. Uses the run's prompt,
 * the most recent assistant message for this worker, and the last few
 * execution events tied to the worker.
 */
export async function buildSyntheticHandoff(args: {
  runId: string;
  workerId: string;
  reason: string;
  originalPrompt: string;
}): Promise<HandoffReport> {
  const worker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
  const workerType = normalizeWorkerType(worker?.type ?? "codex") as SupportedWorkerType;

  const recentEvents = await listExecutionEventsForWorker(args.workerId, 10);

  const recentWorkerMessage = await db.select()
    .from(messages)
    .where(eq(messages.workerId, args.workerId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1)
    .get();

  const progressLines: string[] = [];
  if (worker?.currentText) {
    progressLines.push(worker.currentText.slice(-500).trim());
  } else if (worker?.lastText) {
    progressLines.push(worker.lastText.slice(-500).trim());
  }
  if (recentWorkerMessage?.content) {
    progressLines.push(`Last assistant message: ${recentWorkerMessage.content.slice(-400)}`);
  }
  if (recentEvents.length > 0) {
    progressLines.push(
      `Recent events: ${recentEvents
        .map((event) => event.eventType)
        .filter((eventType, index, all) => all.indexOf(eventType) === index)
        .slice(0, 8)
        .join(", ")}`,
    );
  }
  if (progressLines.length === 0) {
    progressLines.push("No worker activity captured before quota exhaustion.");
  }

  return {
    task: args.originalPrompt.slice(0, 280).trim() || "Continue the in-flight task.",
    progress: progressLines.join("\n").trim() || "Outgoing worker stopped before recording activity.",
    nextSteps: "Re-read the most recent files in the working directory, then continue the original task.",
    blockers: undefined,
    openQuestions: undefined,
    relevantFiles: undefined,
    source: "synthetic",
    outgoingWorkerType: workerType,
    outgoingWorkerId: args.workerId,
    reason: args.reason,
  };
}
