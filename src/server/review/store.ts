import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { codeReviewFindings, codeReviewRounds, codeReviews } from "@/server/db/schema";
import type { CodeReviewRecord } from "@/shared/code-review";

const LIST_LIMIT = 10;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

/** Recent code reviews for a run, newest first, with rounds and findings. */
export async function listCodeReviewsForRun(runId: string, limit = LIST_LIMIT): Promise<CodeReviewRecord[]> {
  const reviews = await db.select().from(codeReviews)
    .where(eq(codeReviews.runId, runId))
    .orderBy(desc(codeReviews.createdAt), desc(codeReviews.id))
    .limit(limit);
  if (reviews.length === 0) return [];
  const ids = reviews.map((review) => review.id);
  const [rounds, findings] = await Promise.all([
    db.select().from(codeReviewRounds).where(inArray(codeReviewRounds.reviewId, ids)).orderBy(asc(codeReviewRounds.roundNumber)),
    db.select().from(codeReviewFindings).where(inArray(codeReviewFindings.reviewId, ids)).orderBy(asc(codeReviewFindings.createdAt), asc(codeReviewFindings.id)),
  ]);
  return reviews.map((review) => ({
    id: review.id,
    runId: review.runId,
    implementerWorkerId: review.implementerWorkerId,
    implementerType: review.implementerType,
    reviewerType: review.reviewerType,
    status: review.status as CodeReviewRecord["status"],
    maxRounds: review.maxRounds,
    roundsCompleted: review.roundsCompleted,
    outcomeReason: review.outcomeReason,
    lastError: review.lastError,
    startedAt: review.startedAt.toISOString(),
    completedAt: iso(review.completedAt),
    rounds: rounds.filter((round) => round.reviewId === review.id).map((round) => ({
      roundNumber: round.roundNumber,
      reviewerWorkerId: round.reviewerWorkerId,
      verdict: (round.verdict ?? null) as CodeReviewRecord["rounds"][number]["verdict"],
      responseExcerpt: round.responseExcerpt,
      diffChars: round.diffChars,
      completedAt: iso(round.completedAt),
    })),
    findings: findings.filter((finding) => finding.reviewId === review.id).map((finding) => ({
      id: finding.id,
      roundNumber: finding.roundNumber,
      severity: finding.severity as CodeReviewRecord["findings"][number]["severity"],
      file: finding.file,
      line: finding.line,
      claim: finding.claim,
      evidence: finding.evidence,
      suggestedFix: finding.suggestedFix,
      status: finding.status as CodeReviewRecord["findings"][number]["status"],
      disputeReason: finding.disputeReason,
    })),
  }));
}
