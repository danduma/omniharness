import path from "node:path";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/server/db";
import { conversationHandoffs, runs } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";

export class HandoffInProgressError extends Error {
  readonly code = "handoff_in_progress";
  readonly status = 409;
  constructor(readonly runId: string, readonly handoffId: string) {
    super("This conversation is stopped while a cross-CLI handoff is in progress.");
    this.name = "HandoffInProgressError";
  }
}

export async function assertRunNotHandoffFenced(runId: string) {
  const run = await db.select({ activeHandoffId: runs.activeHandoffId, projectPath: runs.projectPath }).from(runs).where(eq(runs.id, runId)).get();
  const activeStatuses = ["capturing", "ready", "launching", "needs_recovery"];
  const projectPath = run?.projectPath ? path.resolve(run.projectPath) : null;
  const durable = await db.select({ id: conversationHandoffs.id }).from(conversationHandoffs).where(and(
    inArray(conversationHandoffs.status, activeStatuses),
    or(
      eq(conversationHandoffs.sourceRunId, runId),
      ...(run?.activeHandoffId ? [eq(conversationHandoffs.id, run.activeHandoffId)] : []),
      ...(projectPath ? [eq(conversationHandoffs.normalizedProjectPath, projectPath)] : []),
    ),
  )).get();
  if (!durable) return;
  const error = new HandoffInProgressError(runId, durable.id);
  emitNamedEvent({ kind: "handoff.refused", runId, handoffId: durable.id, stage: "launch", code: error.code, reason: error.message });
  throw error;
}

export async function assertWorkspaceNotHandoffFenced(projectPath: string) {
  const normalizedProjectPath = path.resolve(projectPath);
  const durable = await db.select({ id: conversationHandoffs.id, sourceRunId: conversationHandoffs.sourceRunId }).from(conversationHandoffs).where(and(
    eq(conversationHandoffs.normalizedProjectPath, normalizedProjectPath),
    inArray(conversationHandoffs.status, ["capturing", "ready", "launching", "needs_recovery"]),
  )).get();
  if (!durable) return;
  const error = new HandoffInProgressError(durable.sourceRunId, durable.id);
  emitNamedEvent({ kind: "handoff.refused", runId: durable.sourceRunId, handoffId: durable.id, stage: "launch", code: error.code, reason: error.message });
  throw error;
}
