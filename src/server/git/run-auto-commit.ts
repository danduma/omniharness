import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, runs } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { autoCommitMilestone, parseGitBaselineJson, type AutoCommitResult } from "./auto-commit";

type RunRecord = typeof runs.$inferSelect;

function sanitizeCommitSubject(value: string | null | undefined) {
  const normalized = (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]/g, " ")
    .trim();
  const title = normalized || "completed implementation run";
  return `OmniHarness: ${title.length > 64 ? `${title.slice(0, 61).trimEnd()}...` : title}`;
}

function buildCommitBody(run: RunRecord, summary: string) {
  return [
    summary.trim() ? summary.trim() : "Implementation run completed.",
    "",
    `Run: ${run.id}`,
    `Plan: ${run.planId}`,
    "Created by OmniHarness milestone auto-commit.",
    "No branch or worktree was created by this workflow.",
  ].join("\n");
}

async function insertCommitEvent(runId: string, eventType: string, details: Record<string, unknown>) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: null,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
  notifyEventStreamSubscribers();
}

function resultSummary(result: AutoCommitResult) {
  if (result.status === "created") {
    return `Auto-commit created: ${result.commitSha.slice(0, 12)} ${result.subject}`;
  }

  if (result.status === "skipped") {
    return `Auto-commit skipped: ${result.reason}`;
  }

  return `Auto-commit failed: ${result.reason}`;
}

export async function runMilestoneAutoCommit(runId: string, summary: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || run.mode !== "implementation" || !run.projectPath) {
    return null;
  }

  const result = autoCommitMilestone({
    cwd: run.projectPath,
    baseline: parseGitBaselineJson(run.gitBaselineJson),
    autoCommitMilestones: Boolean(run.autoCommitMilestones),
    pushOnCommit: Boolean(run.pushOnCommit),
    subject: sanitizeCommitSubject(run.title),
    body: buildCommitBody(run, summary),
  });

  if (result.status === "created") {
    await db.update(runs)
      .set({ completionCommitSha: result.commitSha, updatedAt: new Date() })
      .where(eq(runs.id, runId));
    await insertCommitEvent(runId, "auto_commit_created", {
      summary: resultSummary(result),
      commitSha: result.commitSha,
      shortSha: result.commitSha.slice(0, 12),
      subject: result.subject,
      pushStatus: result.pushStatus,
    });

    if (result.pushStatus === "pushed") {
      await insertCommitEvent(runId, "auto_commit_push_created", {
        summary: `Auto-commit pushed: ${result.commitSha.slice(0, 12)}`,
        commitSha: result.commitSha,
        shortSha: result.commitSha.slice(0, 12),
      });
    } else if (result.pushStatus === "failed") {
      await insertCommitEvent(runId, "auto_commit_push_failed", {
        summary: "Auto-commit push failed.",
        commitSha: result.commitSha,
        shortSha: result.commitSha.slice(0, 12),
        error: result.pushError,
      });
    }
    return result;
  }

  await insertCommitEvent(runId, result.status === "skipped" ? "auto_commit_skipped" : "auto_commit_failed", {
    summary: resultSummary(result),
    ...result,
  });
  return result;
}
