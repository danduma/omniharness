import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs } from "@/server/db/schema";

export async function persistRunFailure(runId: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const now = new Date();

  await db.update(runs).set({
    status: "failed",
    failedAt: now,
    lastError: errorMessage,
    updatedAt: now,
  }).where(eq(runs.id, runId));

  await db.insert(messages).values({
    id: randomUUID(),
    runId,
    role: "system",
    kind: "error",
    content: `Run failed: ${errorMessage}`,
    createdAt: now,
  });
}
