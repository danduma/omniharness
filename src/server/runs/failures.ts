import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs } from "@/server/db/schema";
import { formatErrorMessage } from "@/server/error-format";
import { isTerminalRunStatus, normalizeRunStatus } from "@/server/runs/status";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

export { formatErrorMessage };

export async function persistRunFailure(runId: string, error: unknown) {
  const errorMessage = formatErrorMessage(error);
  const now = new Date();
  const content = `Run failed: ${errorMessage}`;
  const currentRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!currentRun || (isTerminalRunStatus(currentRun.status) && normalizeRunStatus(currentRun.status) !== "failed")) {
    return;
  }

  await db.update(runs).set({
    status: "failed",
    failedAt: now,
    lastError: errorMessage,
    updatedAt: now,
  }).where(eq(runs.id, runId));
  notifyEventStreamSubscribers();

  const latestMessage = await db.select().from(messages)
    .where(eq(messages.runId, runId))
    .orderBy(desc(messages.createdAt))
    .get();

  if (
    latestMessage?.role === "system"
    && latestMessage.kind === "error"
    && latestMessage.content === content
  ) {
    return;
  }

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
