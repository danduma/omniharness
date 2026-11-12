// Shared shapes for code cross-review (rollout B4).

export type CodeReviewStatus = "running" | "approved" | "escalated" | "cap_reached" | "failed";
export type CodeReviewFindingStatus = "open" | "resolved" | "disputed" | "escalated" | "withdrawn";
export type CodeReviewVerdictLabel = "approve" | "request_changes" | "blocked" | "inconclusive";

export const CODE_REVIEW_DEFAULT_ROUNDS = 3;
export const CODE_REVIEW_MAX_ROUNDS = 3;

export type CodeReviewRecord = {
  id: string;
  runId: string;
  implementerWorkerId: string;
  implementerType: string;
  reviewerType: string;
  status: CodeReviewStatus;
  maxRounds: number;
  roundsCompleted: number;
  /** Stable reason id, e.g. "disagreement", "no_evidence"; translated at render time. */
  outcomeReason: string | null;
  lastError: string | null;
  startedAt: string;
  completedAt: string | null;
  rounds: Array<{
    roundNumber: number;
    reviewerWorkerId: string | null;
    verdict: CodeReviewVerdictLabel | null;
    /** The reviewer's final reply for this round, redacted and capped. */
    responseExcerpt: string | null;
    diffChars: number;
    completedAt: string | null;
  }>;
  findings: Array<{
    id: string;
    roundNumber: number;
    severity: "blocker" | "major" | "minor" | "nit";
    file: string | null;
    line: number | null;
    claim: string;
    evidence: string | null;
    suggestedFix: string | null;
    status: CodeReviewFindingStatus;
    disputeReason: string | null;
  }>;
};

export type CodeReviewListResponse = { reviews: CodeReviewRecord[] };

export type CodeReviewRefusal =
  | "already_running"
  | "no_implementer"
  | "implementer_busy"
  | "no_independent_reviewer"
  | "not_git"
  | "no_changes";

export type CodeReviewStartResponse =
  | { ok: true; reviewId: string; status: "running"; reviewerType: string; implementerWorkerId: string }
  | { ok: false; refused: CodeReviewRefusal };

/** Named events that change what the code review panel shows. */
export const CODE_REVIEW_EVENT_TYPES = [
  "code_review.started",
  "code_review.round_finished",
  "code_review.findings_disputed",
  "code_review.finished",
  "code_review.refused",
] as const;
