import { randomUUID } from "node:crypto";
import type { DbClient } from "@/server/db";
import { dbClient } from "@/server/db";
import { emitNamedEvent, type NamedEvent } from "@/server/events/named-events";

export type GoalOutboxDrainResult = "idle" | "published" | "retryable" | "poisoned" | "stale_claim";

export interface GoalOutboxClaim {
  id: string;
  runId: string;
  goalId: string;
  leaseGeneration: number;
  revision: number;
  eventKey: string;
  eventKind: string;
  payloadJson: string;
  attemptCount: number;
  claimToken: string;
}

interface GoalOutboxOptions {
  emit?: (event: NamedEvent) => unknown;
  now?: () => number;
  randomId?: () => string;
  claimLeaseMs?: number;
  maxAttempts?: number;
  maximumBackoffMs?: number;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class GoalOutboxDispatcher {
  private readonly emit: (event: NamedEvent) => unknown;
  private readonly now: () => number;
  private readonly randomId: () => string;
  private readonly claimLeaseMs: number;
  private readonly maxAttempts: number;
  private readonly maximumBackoffMs: number;

  constructor(private readonly client: DbClient, options: GoalOutboxOptions = {}) {
    this.emit = options.emit ?? emitNamedEvent;
    this.now = options.now ?? Date.now;
    this.randomId = options.randomId ?? randomUUID;
    this.claimLeaseMs = options.claimLeaseMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.maximumBackoffMs = options.maximumBackoffMs ?? 60_000;
  }

  async claimNext(): Promise<GoalOutboxClaim | null> {
    let transaction: Awaited<ReturnType<DbClient["transaction"]>>;
    try {
      transaction = await this.client.transaction("write");
    } catch (error) {
      if (isBusyError(error)) return null;
      throw error;
    }
    const now = this.now();
    try {
      const selected = await transaction.execute({
        sql: `SELECT candidate.*
              FROM run_goal_outbox candidate
              WHERE (
                (candidate.status IN ('pending', 'retryable') AND candidate.next_attempt_at <= ?)
                OR (candidate.status = 'claimed' AND candidate.claim_expires_at <= ?)
              )
              AND NOT EXISTS (
                SELECT 1 FROM run_goal_outbox earlier
                WHERE earlier.run_id = candidate.run_id
                  AND earlier.revision < candidate.revision
                  AND earlier.status != 'published'
              )
              ORDER BY candidate.created_at ASC, candidate.run_id ASC, candidate.revision ASC
              LIMIT 1`,
        args: [now, now],
      });
      const row = selected.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        await transaction.commit();
        return null;
      }
      const claimToken = this.randomId();
      const updated = await transaction.execute({
        sql: `UPDATE run_goal_outbox
              SET status = 'claimed', claim_token = ?, claim_expires_at = ?, updated_at = ?
              WHERE id = ?
                AND (
                  (status IN ('pending', 'retryable') AND next_attempt_at <= ?)
                  OR (status = 'claimed' AND claim_expires_at <= ?)
                )`,
        args: [claimToken, now + this.claimLeaseMs, now, row.id, now, now],
      });
      if (updated.rowsAffected !== 1) {
        await transaction.rollback();
        return null;
      }
      await transaction.commit();
      return {
        id: String(row.id),
        runId: String(row.run_id),
        goalId: String(row.goal_id),
        leaseGeneration: Number(row.lease_generation),
        revision: Number(row.revision),
        eventKey: String(row.event_key),
        eventKind: String(row.event_kind),
        payloadJson: String(row.payload_json),
        attemptCount: Number(row.attempt_count ?? 0),
        claimToken,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  publishClaim(claim: GoalOutboxClaim) {
    const payload = JSON.parse(claim.payloadJson) as Record<string, unknown>;
    const snapshot = { ...payload };
    delete snapshot.eventKey;
    this.emit({
      kind: claim.eventKind,
      eventKey: claim.eventKey,
      runId: claim.runId,
      goalId: claim.goalId,
      revision: claim.revision,
      leaseGeneration: claim.leaseGeneration,
      snapshot,
    } as NamedEvent);
  }

  async drainOnce(): Promise<GoalOutboxDrainResult> {
    const claim = await this.claimNext();
    if (!claim) return "idle";
    try {
      this.publishClaim(claim);
      const acknowledged = await this.acknowledge(claim);
      return acknowledged ? "published" : "stale_claim";
    } catch (error) {
      return this.recordFailure(claim, error);
    }
  }

  async drainPending(limit = 100) {
    let publishedCount = 0;
    let poisonedCount = 0;
    for (let index = 0; index < limit; index += 1) {
      const result = await this.drainOnce();
      if (result === "idle") break;
      if (result === "published") publishedCount += 1;
      if (result === "poisoned") poisonedCount += 1;
      if (result === "retryable" || result === "stale_claim") break;
    }
    return { publishedCount, poisonedCount };
  }

  async recoverPoisoned(runId: string, goalId: string, revision: number) {
    const now = this.now();
    const result = await this.client.execute({
      sql: `UPDATE run_goal_outbox
            SET status = 'retryable', claim_token = NULL, claim_expires_at = NULL,
                next_attempt_at = ?, last_error = NULL, updated_at = ?
            WHERE run_id = ? AND goal_id = ? AND revision = ? AND status = 'poisoned'`,
      args: [now, now, runId, goalId, revision],
    });
    return result.rowsAffected === 1;
  }

  private async acknowledge(claim: GoalOutboxClaim) {
    const now = this.now();
    const result = await this.client.execute({
      sql: `UPDATE run_goal_outbox
            SET status = 'published', claim_token = NULL, claim_expires_at = NULL,
                published_at = ?, updated_at = ?
            WHERE id = ? AND run_id = ? AND goal_id = ? AND lease_generation = ?
              AND revision = ? AND claim_token = ? AND status = 'claimed'`,
      args: [
        now, now, claim.id, claim.runId, claim.goalId, claim.leaseGeneration,
        claim.revision, claim.claimToken,
      ],
    });
    return result.rowsAffected === 1;
  }

  private async recordFailure(claim: GoalOutboxClaim, error: unknown): Promise<GoalOutboxDrainResult> {
    const now = this.now();
    const attempt = claim.attemptCount + 1;
    const poisoned = attempt >= this.maxAttempts;
    const backoff = Math.min(this.maximumBackoffMs, 1_000 * (2 ** Math.max(0, attempt - 1)));
    const nextAttemptAt = now + backoff;
    const message = errorMessage(error);
    const result = await this.client.execute({
      sql: `UPDATE run_goal_outbox
            SET status = ?, claim_token = NULL, claim_expires_at = NULL,
                attempt_count = ?, next_attempt_at = ?, last_error = ?, updated_at = ?
            WHERE id = ? AND run_id = ? AND goal_id = ? AND lease_generation = ?
              AND revision = ? AND claim_token = ? AND status = 'claimed'`,
      args: [
        poisoned ? "poisoned" : "retryable", attempt, nextAttemptAt, message, now,
        claim.id, claim.runId, claim.goalId, claim.leaseGeneration, claim.revision, claim.claimToken,
      ],
    });
    if (result.rowsAffected !== 1) return "stale_claim";
    if (!poisoned) {
      this.emitDiagnostic({
        kind: "goal.outbox.retry_scheduled",
        runId: claim.runId,
        goalId: claim.goalId,
        revision: claim.revision,
        attempt,
        nextAttemptAt: new Date(nextAttemptAt).toISOString(),
      });
      return "retryable";
    }

    this.emitDiagnostic({
      kind: "goal.outbox.poisoned",
      runId: claim.runId,
      goalId: claim.goalId,
      revision: claim.revision,
      attempt,
      reason: message,
    });
    this.emit({
      kind: "error.surfaced",
      code: "goal.outbox.poisoned",
      message: `Goal event publication failed permanently: ${message}`,
      surface: "banner",
      runId: claim.runId,
      cause: error instanceof Error ? { name: error.name, message: error.message } : null,
    });
    return "poisoned";
  }

  private emitDiagnostic(event: NamedEvent) {
    try {
      this.emit(event);
    } catch (error) {
      console.error(`Failed to emit ${event.kind}:`, error);
    }
  }
}

export function createGoalOutboxDispatcher(client: DbClient, options: GoalOutboxOptions = {}) {
  return new GoalOutboxDispatcher(client, options);
}

export const goalOutboxDispatcher = createGoalOutboxDispatcher(dbClient);

export async function recoverGoalOutboxAtStartup() {
  const countResult = await dbClient.execute(
    "SELECT COUNT(*) AS count FROM run_goal_outbox WHERE status != 'published'",
  );
  const pendingCount = Number(countResult.rows[0]?.count ?? 0);
  if (pendingCount === 0) return { publishedCount: 0, poisonedCount: 0 };
  emitNamedEvent({ kind: "goal.outbox.recovery_started", pendingCount });
  const result = await goalOutboxDispatcher.drainPending(Math.min(1_000, pendingCount));
  emitNamedEvent({ kind: "goal.outbox.recovery_completed", ...result });
  return result;
}

function isBusyError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "SQLITE_BUSY" || (typeof candidate.message === "string" && candidate.message.includes("SQLITE_BUSY"));
}
