import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { recoveryIncidents, runs, workers } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { autoCommitMilestone, parseGitBaselineJson, type AutoCommitResult } from "./auto-commit";

type RunRecord = typeof runs.$inferSelect;

const OPEN_INCIDENT_STATUSES = new Set(["open", "recovering", "needs_user"]);

function sanitizeCommitSubject(value: string | null | undefined) {
  const normalized = (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]/g, " ")
    .trim();
  const title = normalized || "completed implementation run";
  return title.length > 72 ? `${title.slice(0, 69).trimEnd()}...` : title;
}

function buildCommitBody(run: RunRecord, summary: string) {
  return [
    summary.trim() ? summary.trim() : "Implementation run completed.",
    "",
    `Run: ${run.id}`,
    `Plan: ${run.planId}`,
    "Created by milestone auto-commit.",
    "No branch or worktree was created by this workflow.",
  ].join("\n");
}

async function insertCommitEvent(runId: string, eventType: string, details: Record<string, unknown>) {
  await recordExecutionEvent({
    runId,
    workerId: null,
    planItemId: null,
    eventType,
    details,
  });
  notifyEventStreamSubscribers();
}

const UNHEALTHY_RUN_STATUSES = new Set([
  "failed",
  "needs_recovery",
  "cancelled",
  "canceled",
  "quota_waiting",
]);
const UNHEALTHY_WORKER_STATUSES = new Set(["error", "cancelled", "canceled", "stopped"]);

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

/**
 * Only a live, healthy conversation may commit and push.
 *
 * A run whose credentials died can still reach a "done" turn — auto-resume
 * replays it, the replay produces terminal-looking output, and the milestone
 * commit fires. That is how a suspended-account run swept an entire dirty
 * working tree into a commit and pushed it. Committing is an outward-facing
 * action, so it needs an affirmatively healthy conversation behind it, not
 * merely the absence of an objection.
 */
async function blockedAutoCommitReason(run: RunRecord): Promise<string | null> {
  const runStatus = normalizeStatus(run.status);
  if (UNHEALTHY_RUN_STATUSES.has(runStatus)) {
    return `the conversation is ${runStatus}`;
  }

  if (run.failedAt) {
    return "the conversation has an unresolved failure";
  }

  const lastError = run.lastError?.trim();
  if (lastError && !isTransientSupervisorError(new Error(lastError))) {
    return `the conversation stopped with an unrecoverable error (${lastError.slice(0, 120)})`;
  }

  const openIncident = (await db
    .select({ kind: recoveryIncidents.kind, status: recoveryIncidents.status })
    .from(recoveryIncidents)
    .where(eq(recoveryIncidents.runId, run.id)))
    .find((incident) => OPEN_INCIDENT_STATUSES.has(normalizeStatus(incident.status)));
  if (openIncident) {
    return `recovery is still open for this conversation (${openIncident.kind})`;
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, run.id));
  if (runWorkers.length > 0 && runWorkers.every((worker) => UNHEALTHY_WORKER_STATUSES.has(normalizeStatus(worker.status)))) {
    return "no healthy worker is driving this conversation";
  }

  return null;
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
  if (!run || (run.mode !== "implementation" && run.mode !== "direct") || !run.projectPath) {
    return null;
  }

  // Nothing below this line is silent: whether we commit, push, decline to, or
  // fail, the conversation gets an inline event saying so.
  const blockedReason = await blockedAutoCommitReason(run);
  if (blockedReason) {
    await insertCommitEvent(runId, "auto_commit_skipped", {
      summary: `Auto-commit skipped: ${blockedReason}`,
      status: "skipped",
      reason: blockedReason,
      wouldHavePushed: Boolean(run.pushOnCommit),
    });
    return { status: "skipped", reason: "unhealthy_conversation", details: blockedReason } as const;
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
    } else if (run.pushOnCommit) {
      // Push was configured but the commit path did not attempt one. Saying
      // nothing here reads as "pushed" in the conversation.
      await insertCommitEvent(runId, "auto_commit_push_failed", {
        summary: "Auto-commit did not push: the commit path did not attempt a push.",
        commitSha: result.commitSha,
        shortSha: result.commitSha.slice(0, 12),
        error: "push_not_attempted",
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
