import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { formatErrorMessage } from "@/server/error-format";
import { isTerminalRunStatus, normalizeRunStatus } from "@/server/runs/status";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent, type ErrorSurface, type SurfacedErrorCode } from "@/server/events/named-events";

export { formatErrorMessage };

export type PersistRunFailureSurface = {
  code: SurfacedErrorCode;
  surface?: ErrorSurface;
  workerId?: string | null;
};

export type PersistRunFailureOptions = {
  surface?: PersistRunFailureSurface;
};

export async function persistRunFailure(
  runId: string,
  error: unknown,
  options: PersistRunFailureOptions = {},
) {
  const errorMessage = formatErrorMessage(error);
  const now = new Date();
  const content = `Run failed: ${errorMessage}`;
  const currentRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!currentRun || (isTerminalRunStatus(currentRun.status) && normalizeRunStatus(currentRun.status) !== "failed")) {
    return;
  }

  const previousStatus = normalizeRunStatus(currentRun.status);
  const isFirstTransitionToFailed = previousStatus !== "failed";

  await db.update(runs).set({
    status: "failed",
    failedAt: now,
    lastError: errorMessage,
    updatedAt: now,
  }).where(eq(runs.id, runId));
  notifyEventStreamSubscribers();

  // Emit error.surfaced once, on the actual transition into the failed
  // state. Skip re-emission on duplicate calls so retries / fall-through
  // safety nets don't double-toast the user.
  if (options.surface && isFirstTransitionToFailed) {
    const cause = error instanceof Error ? error : new Error(errorMessage);
    emitNamedEvent({
      kind: "error.surfaced",
      code: options.surface.code,
      message: errorMessage,
      surface: options.surface.surface ?? "toast",
      runId,
      ...(options.surface.workerId ? { workerId: options.surface.workerId } : {}),
      cause: { name: cause.name, message: cause.message },
    });
  }

  const latestMessage = await db.select().from(messages)
    .where(eq(messages.runId, runId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .get();

  if (
    latestMessage?.role === "system"
    && latestMessage.kind === "error"
    && latestMessage.content === content
  ) {
    return;
  }

  const workerId = options.surface?.workerId ?? null;
  const eventWorkerId = workerId
    ? (await db.select({ id: workers.id }).from(workers).where(eq(workers.id, workerId)).get())?.id ?? null
    : null;
  await recordExecutionEvent({
    runId,
    workerId: eventWorkerId,
    eventType: "run_failed",
    details: {
      summary: errorMessage,
      error: errorMessage,
      code: options.surface?.code ?? null,
      surface: options.surface?.surface ?? null,
    },
    createdAt: now,
  });

  await db.insert(messages).values({
    id: randomUUID(),
    runId,
    role: "system",
    kind: "error",
    content,
    createdAt: now,
  });
  notifyEventStreamSubscribers();
}
