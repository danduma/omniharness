import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { codeReviewFindings, codeReviewRounds, codeReviews, planItems, runs, workers } from "@/server/db/schema";
import { askAgent, cancelAgent, getAgent, spawnAgent } from "@/server/bridge-client";
import { emitNamedEvent, type CodeReviewOutcome, type CodeReviewRefusalReason } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { redactHandoffText } from "@/server/handoff/redaction";
import { parseGitBaselineJson } from "@/server/git/auto-commit";
import { isWorkerTypeQuotaBlocked, resolvePlanningReviewWorkerType } from "@/server/planning/review-agent-selection";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import type { SupportedWorkerType } from "@/shared/worker-types";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { normalizeWorkerType, parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { appendSupervisorInputOnDelivery } from "@/server/workers/stream-writer";
import { CODE_REVIEW_DEFAULT_ROUNDS, CODE_REVIEW_MAX_ROUNDS } from "@/shared/code-review";
import { collectReviewDiff } from "./diff";
import {
  buildCodeReviewerPrompt,
  buildEvidenceRequestPrompt,
  buildImplementerFixPrompt,
  parseCodeReviewVerdict,
  parseImplementerDisputes,
  verdictHasEvidence,
  type CodeReviewVerdict,
  type PreviousFinding,
} from "./prompts";

/**
 * Code cross-review (rollout B4): a worker of a *different* agent type
 * reviews the implementer's changes in rounds.
 *
 *  - Roles: the implementer is the run's worker that made the change; the
 *    reviewer is a fresh, read-only helper agent of a different type each
 *    round (Codex reviews Claude and vice versa). Same-type review is refused.
 *    The reviewer is not a worker of the conversation: direct conversations
 *    are pinned to one CLI type by a database invariant (HANDOFF_REQUIRED),
 *    so it runs like the handoff summarizer, and each round stores the
 *    reviewer's final reply (redacted, capped) for transparency.
 *  - Handover: diff against the run's git baseline, changed-file stat,
 *    untracked files, the task, and the implementer's own (unverified)
 *    summary. Never the implementer's reasoning.
 *  - Verdict: strict JSON (approve / request_changes / blocked, findings with
 *    file:line). An approval must show evidence (files inspected or tests run);
 *    the reviewer gets one chance to add it.
 *  - Loop: at most CODE_REVIEW_MAX_ROUNDS. The implementer fixes what it
 *    agrees with and disputes the rest; a disputed finding the reviewer keeps
 *    open is escalated to the user. Models never break ties.
 *  - Nothing is merged, committed, or approved on the user's behalf.
 */

const processBootTime = new Date();
const IMPLEMENTER_SUMMARY_CHARS = 2_000;
/** The reviewer's final reply is kept per round for transparency, capped. */
const REVIEWER_REPLY_CHARS = 8_000;
const TASK_CHARS = 4_000;
const BLOCKING_SEVERITIES = new Set(["blocker", "major"]);
const EXCLUDED_IMPLEMENTER_ROLES = new Set(["plan_review", "code_review"]);
const UNUSABLE_IMPLEMENTER_STATUSES = new Set(["cancelled", "canceled", "error", "failed", "lost", "stopped"]);

export class CodeReviewRefusedError extends Error {
  constructor(readonly reason: CodeReviewRefusalReason, message: string) {
    super(message);
    this.name = "CodeReviewRefusedError";
  }
}

/**
 * The deepest cause's message. Query failures wrap the SQLite error in a
 * message that repeats the full statement and parameters (including prompts),
 * which hides the actual reason and bloats the stored error.
 */
function describeRootCause(error: unknown): string {
  let current: unknown = error;
  for (let depth = 0; depth < 8; depth += 1) {
    const cause = current instanceof Error ? (current as Error & { cause?: unknown }).cause : undefined;
    if (!(cause instanceof Error)) break;
    current = cause;
  }
  return current instanceof Error ? current.message : String(current);
}

function isAgentBusy(error: unknown) {
  return /\bagent is busy\b/i.test(error instanceof Error ? error.message : String(error));
}

function refuse(runId: string, reason: CodeReviewRefusalReason, message: string): never {
  emitNamedEvent({ kind: "code_review.refused", runId, reason });
  emitNamedEvent({ kind: "error.surfaced", code: "review.code.refused", message, surface: "toast", runId });
  throw new CodeReviewRefusedError(reason, message);
}

/** Running reviews from before this process started can never finish; close them honestly. */
export async function reconcileOrphanedCodeReviews(runId: string) {
  const orphans = await db.select().from(codeReviews).where(and(
    eq(codeReviews.runId, runId),
    eq(codeReviews.status, "running"),
    lt(codeReviews.startedAt, processBootTime),
  ));
  for (const orphan of orphans) {
    await finishReview(orphan.id, runId, "failed", "interrupted_by_restart", "Interrupted by a server restart before it finished.");
  }
}

async function resolveImplementer(runId: string, requestedWorkerId: string | null | undefined) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId)).orderBy(desc(workers.updatedAt));
  if (requestedWorkerId) {
    return runWorkers.find((worker) => worker.id === requestedWorkerId) ?? null;
  }
  const candidates = runWorkers.filter((worker) => (
    !EXCLUDED_IMPLEMENTER_ROLES.has(worker.workerRole ?? "")
    && !UNUSABLE_IMPLEMENTER_STATUSES.has(worker.status.toLowerCase())
  ));
  return candidates.find((worker) => worker.workerRole === "implementation") ?? candidates[0] ?? null;
}

/**
 * Reviewer launch overrides for reviews started by specialist orchestration
 * (the policy's exact binding instead of auto selection). Process-local on
 * purpose: a review never survives a restart (see reconcileOrphanedCodeReviews).
 */
const reviewerLaunchOverrides = new Map<string, { model: string | null; effort: string | null }>();

export type CodeReviewerBinding = { workerType: string; model: string | null; effort: string | null };

export async function startCodeReview(args: { runId: string; implementerWorkerId?: string | null; maxRounds?: number; reviewer?: CodeReviewerBinding | null }) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) throw new Error("Conversation not found.");
  await reconcileOrphanedCodeReviews(run.id);

  const running = await db.select({ id: codeReviews.id }).from(codeReviews)
    .where(and(eq(codeReviews.runId, run.id), eq(codeReviews.status, "running"))).get();
  if (running) refuse(run.id, "already_running", "A code review is already running for this conversation.");

  const implementer = await resolveImplementer(run.id, args.implementerWorkerId);
  if (!implementer) refuse(run.id, "no_implementer", "There is no worker whose changes can be reviewed.");

  let liveState: string | null = null;
  try {
    liveState = ((await getAgent(implementer.id)) as { state?: string }).state ?? null;
  } catch {
    refuse(run.id, "no_implementer", "The worker that made the changes is not running. Send it a message to resume it, then start the review again.");
  }
  if (liveState === "working" || liveState === "starting") {
    refuse(run.id, "implementer_busy", "The worker is still busy. Start the review when its turn has finished.");
  }

  let reviewerType: string;
  if (args.reviewer) {
    // Pinned by an orchestration policy: no auto selection, but the same
    // installation and quota health checks, and still never the same CLI.
    reviewerType = normalizeWorkerType(args.reviewer.workerType);
    if (!isSpawnableWorkerType(reviewerType).ok || await isWorkerTypeQuotaBlocked(reviewerType as SupportedWorkerType)) {
      refuse(run.id, "no_independent_reviewer", `The configured reviewer "${reviewerType}" is not available.`);
    }
  } else try {
    const selection = await resolvePlanningReviewWorkerType({
      agentSelection: "auto",
      allowedWorkerTypes: parseAllowedWorkerTypes(run.allowedWorkerTypes),
      plannerWorkerType: implementer.type,
    });
    reviewerType = selection.workerType;
  } catch {
    refuse(run.id, "no_independent_reviewer", "No other agent type is available to review this work.");
  }
  if (normalizeWorkerType(reviewerType) === normalizeWorkerType(implementer.type)) {
    // An agent reviewing its own type's work tends to agree with itself.
    refuse(run.id, "no_independent_reviewer", "Cross-review needs a different agent type than the one that wrote the code; only the same type is available.");
  }

  const baseline = parseGitBaselineJson(run.gitBaselineJson);
  const firstDiff = collectReviewDiff(implementer.cwd, baseline?.status === "ok" ? baseline.headSha : null);
  if (!firstDiff.ok) refuse(run.id, "not_git", "Cross-review needs the project to be a git repository.");
  if (!firstDiff.diff.trim() && firstDiff.untracked.length === 0) {
    refuse(run.id, "no_changes", "There are no changes to review yet.");
  }

  const maxRounds = Math.min(CODE_REVIEW_MAX_ROUNDS, Math.max(1, Math.floor(args.maxRounds ?? CODE_REVIEW_DEFAULT_ROUNDS)));
  const reviewId = randomUUID();
  const now = new Date();
  await db.insert(codeReviews).values({
    id: reviewId,
    runId: run.id,
    implementerWorkerId: implementer.id,
    implementerType: implementer.type,
    reviewerType,
    status: "running",
    maxRounds,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  if (args.reviewer) {
    reviewerLaunchOverrides.set(reviewId, { model: args.reviewer.model, effort: args.reviewer.effort });
  }
  emitNamedEvent({
    kind: "code_review.started",
    runId: run.id,
    reviewId,
    implementerWorkerId: implementer.id,
    implementerType: implementer.type,
    reviewerType,
    maxRounds,
  });
  notifyEventStreamSubscribers();

  // Background orchestration; every outcome is persisted and evented.
  void orchestrateCodeReview(reviewId).catch((error) => {
    void finishReview(reviewId, run.id, "failed", "orchestration_error", describeRootCause(error));
  });
  return { reviewId, status: "running" as const, reviewerType, implementerWorkerId: implementer.id };
}

async function finishReview(reviewId: string, runId: string, outcome: CodeReviewOutcome, reason: string, detail: string | null = null) {
  const now = new Date();
  const updated = await db.update(codeReviews).set({
    status: outcome,
    outcomeReason: reason,
    lastError: detail ? redactHandoffText(detail, 1_000) : null,
    completedAt: now,
    updatedAt: now,
  }).where(and(eq(codeReviews.id, reviewId), eq(codeReviews.status, "running"))).returning({ id: codeReviews.id });
  if (updated.length === 0) return;
  reviewerLaunchOverrides.delete(reviewId);
  emitNamedEvent({ kind: "code_review.finished", runId, reviewId, outcome, reason });
  if (outcome === "escalated" || outcome === "cap_reached") {
    emitNamedEvent({
      kind: "error.surfaced",
      code: "review.code.needs_user",
      message: outcome === "escalated"
        ? "Cross-review needs your decision: the reviewer and the implementer disagree, or the reviewer could not show its work."
        : "Cross-review reached its round limit with findings still open. Review them before continuing.",
      surface: "banner",
      runId,
    });
  } else if (outcome === "failed") {
    emitNamedEvent({
      kind: "error.surfaced",
      code: "review.code.failed",
      message: redactHandoffText(`Cross-review failed: ${detail ?? reason}`, 600),
      surface: "toast",
      runId,
    });
  }
  notifyEventStreamSubscribers();
}

async function loadPreviousFindings(reviewId: string): Promise<PreviousFinding[]> {
  const rows = await db.select().from(codeReviewFindings).where(eq(codeReviewFindings.reviewId, reviewId));
  return rows.map((row) => ({
    id: row.id,
    severity: row.severity as PreviousFinding["severity"],
    file: row.file,
    line: row.line,
    claim: row.claim,
    status: row.status,
    disputeReason: row.disputeReason,
  }));
}

async function readTask(run: typeof runs.$inferSelect) {
  const items = await db.select({ title: planItems.title }).from(planItems).where(eq(planItems.planId, run.planId));
  const parts = [run.title ?? "", ...items.map((item) => `- ${item.title}`)].filter(Boolean);
  return redactHandoffText(parts.join("\n"), TASK_CHARS);
}

type ReviewerAnswer = { verdict: CodeReviewVerdict | null; reason: string | null; lastResponse: string };

async function askReviewerForVerdict(reviewerId: string, prompt: string): Promise<ReviewerAnswer> {
  const first = await askAgent(reviewerId, prompt);
  let lastResponse = first.response;
  let parsed = parseCodeReviewVerdict(first.response);
  if (!parsed.ok) {
    const retry = await askAgent(reviewerId, "Reply with only your verdict as a JSON block fenced with ```json, in the format requested.");
    lastResponse = retry.response;
    parsed = parseCodeReviewVerdict(retry.response);
    if (!parsed.ok) return { verdict: null, reason: "invalid_verdict", lastResponse };
  }
  if (!verdictHasEvidence(parsed.verdict)) {
    const evidence = await askAgent(reviewerId, buildEvidenceRequestPrompt());
    lastResponse = evidence.response;
    const reparsed = parseCodeReviewVerdict(evidence.response);
    if (!reparsed.ok || !verdictHasEvidence(reparsed.verdict)) return { verdict: null, reason: "no_evidence", lastResponse };
    return { verdict: reparsed.verdict, reason: null, lastResponse };
  }
  return { verdict: parsed.verdict, reason: null, lastResponse };
}

async function runRound(review: typeof codeReviews.$inferSelect, run: typeof runs.$inferSelect, round: number): Promise<"continue" | "done"> {
  const implementer = await db.select().from(workers).where(eq(workers.id, review.implementerWorkerId)).get();
  if (!implementer) {
    await finishReview(review.id, run.id, "failed", "implementer_missing", "The implementing worker no longer exists.");
    return "done";
  }
  const baseline = parseGitBaselineJson(run.gitBaselineJson);
  const diff = collectReviewDiff(implementer.cwd, baseline?.status === "ok" ? baseline.headSha : null);
  if (!diff.ok) {
    await finishReview(review.id, run.id, "failed", diff.reason, diff.detail);
    return "done";
  }

  const previous = await loadPreviousFindings(review.id);
  const prompt = buildCodeReviewerPrompt({
    round,
    maxRounds: review.maxRounds,
    task: await readTask(run),
    implementerType: implementer.type,
    diff: diff.diff,
    stat: diff.stat,
    untracked: diff.untracked,
    truncated: diff.truncated,
    implementerSummary: redactHandoffText((implementer.lastText || "").slice(-IMPLEMENTER_SUMMARY_CHARS), IMPLEMENTER_SUMMARY_CHARS),
    previousFindings: previous.filter((finding) => finding.status !== "resolved" && finding.status !== "withdrawn"),
  });

  const roundId = randomUUID();
  await db.insert(codeReviewRounds).values({
    id: roundId,
    reviewId: review.id,
    runId: run.id,
    roundNumber: round,
    diffChars: diff.chars,
    createdAt: new Date(),
  });

  // Helper agent id, unique per review round; not a row in `workers`.
  const reviewerId = `code-review-${review.id}-r${round}`;
  await db.update(codeReviewRounds).set({ reviewerWorkerId: reviewerId }).where(eq(codeReviewRounds.id, roundId));
  emitNamedEvent({
    kind: "worker.review_started",
    runId: run.id,
    reviewerWorkerId: reviewerId,
    subjectWorkerId: implementer.id,
    reviewKind: "code",
    round,
  });
  notifyEventStreamSubscribers();

  let verdictResult: ReviewerAnswer;
  try {
    const { env } = await readRuntimeEnvFromSettings();
    // Same read-only session mode the handoff summarizer uses; the prompt also
    // forbids edits, since enforcement depends on each ACP adapter.
    const override = reviewerLaunchOverrides.get(review.id);
    await spawnAgent({
      type: review.reviewerType,
      cwd: implementer.cwd,
      name: reviewerId,
      mode: "read-only",
      env,
      ...(override?.model ? { model: override.model } : {}),
      ...(override?.effort ? { effort: override.effort } : {}),
    });
    verdictResult = await askReviewerForVerdict(reviewerId, prompt);
  } finally {
    await cancelAgent(reviewerId).catch(() => undefined);
  }

  const verdict = verdictResult.verdict;
  const now = new Date();
  await db.update(codeReviewRounds).set({
    responseExcerpt: redactHandoffText(verdictResult.lastResponse, REVIEWER_REPLY_CHARS),
    verdict: verdict?.verdict ?? "inconclusive",
    evidenceJson: verdict ? JSON.stringify({ filesInspected: verdict.filesInspected, testsRun: verdict.testsRun, confidence: verdict.confidence ?? null }) : null,
    completedAt: now,
  }).where(eq(codeReviewRounds.id, roundId));
  await db.update(codeReviews).set({ roundsCompleted: round, updatedAt: now }).where(eq(codeReviews.id, review.id));

  if (!verdict) {
    emitNamedEvent({ kind: "worker.review_finished", runId: run.id, reviewerWorkerId: reviewerId, subjectWorkerId: implementer.id, reviewKind: "code", outcome: "failed" });
    emitNamedEvent({ kind: "code_review.round_finished", runId: run.id, reviewId: review.id, round, verdict: "inconclusive", blockers: 0, majors: 0, evidenceOk: false });
    await finishReview(review.id, run.id, "escalated", verdictResult.reason ?? "invalid_verdict");
    return "done";
  }

  // Apply the reviewer's statuses for earlier findings.
  let disagreement = false;
  const previousById = new Map(previous.map((finding) => [finding.id, finding]));
  for (const update of verdict.previousFindings) {
    const existing = previousById.get(update.id);
    if (!existing) continue;
    const nextStatus = update.status === "open" && existing.status === "disputed" ? "escalated" : update.status;
    if (nextStatus === "escalated") disagreement = true;
    await db.update(codeReviewFindings).set({ status: nextStatus, updatedAt: now }).where(eq(codeReviewFindings.id, existing.id));
  }
  if (verdict.findings.length > 0) {
    await db.insert(codeReviewFindings).values(verdict.findings.map((finding) => ({
      id: randomUUID(),
      reviewId: review.id,
      runId: run.id,
      roundNumber: round,
      severity: finding.severity,
      file: finding.file ? redactHandoffText(finding.file, 500) : null,
      line: finding.line ?? null,
      claim: redactHandoffText(finding.claim, 2_000),
      evidence: finding.evidence ? redactHandoffText(finding.evidence, 2_000) : null,
      suggestedFix: finding.suggestedFix ? redactHandoffText(finding.suggestedFix, 2_000) : null,
      status: "open",
      createdAt: now,
      updatedAt: now,
    })));
  }

  const open = (await loadPreviousFindings(review.id)).filter((finding) => finding.status === "open" || finding.status === "disputed");
  const blocking = open.filter((finding) => BLOCKING_SEVERITIES.has(finding.severity));
  emitNamedEvent({
    kind: "worker.review_finished",
    runId: run.id,
    reviewerWorkerId: reviewerId,
    subjectWorkerId: implementer.id,
    reviewKind: "code",
    outcome: open.length > 0 ? "findings" : "no_findings",
  });
  emitNamedEvent({
    kind: "code_review.round_finished",
    runId: run.id,
    reviewId: review.id,
    round,
    verdict: verdict.verdict,
    blockers: open.filter((finding) => finding.severity === "blocker").length,
    majors: open.filter((finding) => finding.severity === "major").length,
    evidenceOk: true,
  });
  notifyEventStreamSubscribers();

  if (disagreement) {
    await finishReview(review.id, run.id, "escalated", "disagreement");
    return "done";
  }
  if (verdict.verdict === "approve" && blocking.length === 0) {
    await finishReview(review.id, run.id, "approved", open.length > 0 ? "approved_with_minor_findings" : "approved");
    return "done";
  }
  if (round >= review.maxRounds) {
    await finishReview(review.id, run.id, "cap_reached", "round_limit");
    return "done";
  }

  // Hand the open findings back to the implementer.
  const fixPrompt = buildImplementerFixPrompt({ round, reviewerType: review.reviewerType, findings: open });
  let fixResponse: string;
  try {
    const response = await askAgent(implementer.id, fixPrompt);
    fixResponse = response.response;
  } catch (error) {
    await finishReview(review.id, run.id, "failed", isAgentBusy(error) ? "implementer_busy" : "implementer_failed",
      describeRootCause(error));
    return "done";
  }
  // Prompt after the ask resolves so the stream reads input -> agent output
  // even when the bridge streams while the turn is in flight.
  await appendSupervisorInputOnDelivery({ runId: run.id, workerId: implementer.id, text: fixPrompt, deliveredAt: new Date() });
  try {
    await persistWorkerSnapshot(implementer.id, await getAgent(implementer.id));
  } catch {
    // Transcript detail only.
  }
  const openIds = new Set(open.map((finding) => finding.id));
  const disputes = parseImplementerDisputes(fixResponse).filter((dispute) => openIds.has(dispute.id));
  if (disputes.length > 0) {
    for (const dispute of disputes) {
      await db.update(codeReviewFindings).set({
        status: "disputed",
        disputeReason: redactHandoffText(dispute.reason, 2_000),
        updatedAt: new Date(),
      }).where(eq(codeReviewFindings.id, dispute.id));
    }
    emitNamedEvent({ kind: "code_review.findings_disputed", runId: run.id, reviewId: review.id, round, count: disputes.length });
  }
  return "continue";
}

async function orchestrateCodeReview(reviewId: string) {
  const review = await db.select().from(codeReviews).where(eq(codeReviews.id, reviewId)).get();
  if (!review) return;
  const run = await db.select().from(runs).where(eq(runs.id, review.runId)).get();
  if (!run) {
    await finishReview(reviewId, review.runId, "failed", "run_missing");
    return;
  }
  for (let round = 1; round <= review.maxRounds; round += 1) {
    const current = await db.select().from(codeReviews).where(eq(codeReviews.id, reviewId)).get();
    if (!current || current.status !== "running") return;
    if ((await runRound(current, run, round)) === "done") return;
  }
}

/** Test/debug helper: reviews still marked running for the given runs. */
export async function listRunningCodeReviewIds(runIds: string[]) {
  if (runIds.length === 0) return [];
  const rows = await db.select({ id: codeReviews.id }).from(codeReviews)
    .where(and(inArray(codeReviews.runId, runIds), eq(codeReviews.status, "running")));
  return rows.map((row) => row.id);
}
