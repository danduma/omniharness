import { randomUUID } from "node:crypto";
import type { DbClient } from "@/server/db";
import { dbClient } from "@/server/db";
import { emitNamedEvent, type NamedEvent } from "@/server/events/named-events";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";

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
  onDiagnosticFailure?: (event: NamedEvent, error: unknown) => void;
}

function errorMessage(error: unknown) {
  return redactGoalErrorMessage(error);
}

export class GoalOutboxDispatcher {
  private readonly emit: (event: NamedEvent) => unknown;
  private readonly now: () => number;
  private readonly randomId: () => string;
  private readonly claimLeaseMs: number;
  private readonly maxAttempts: number;
  private readonly maximumBackoffMs: number;
  private readonly onDiagnosticFailure: (event: NamedEvent, error: unknown) => void;
  private autoDeliveryEnabled = false;
  private autoDeliveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly client: DbClient, options: GoalOutboxOptions = {}) {
    this.emit = options.emit ?? emitNamedEvent;
    this.now = options.now ?? Date.now;
    this.randomId = options.randomId ?? randomUUID;
    this.claimLeaseMs = options.claimLeaseMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.maximumBackoffMs = options.maximumBackoffMs ?? 60_000;
    this.onDiagnosticFailure = options.onDiagnosticFailure ?? ((event, error) => {
      console.error(`Failed to emit ${event.kind}:`, error);
    });
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
        args: [claimToken, now + this.claimLeaseMs, now, String(row.id), now, now],
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
    try {
      for (let index = 0; index < limit; index += 1) {
        const result = await this.drainOnce();
        if (result === "idle") break;
        if (result === "published") publishedCount += 1;
        if (result === "poisoned") poisonedCount += 1;
        if (result === "retryable" || result === "stale_claim") break;
      }
      return { publishedCount, poisonedCount };
    } finally {
      if (this.autoDeliveryEnabled) await this.scheduleNextAutoDelivery();
    }
  }

  async startAutoDelivery(limit = 1_000) {
    this.autoDeliveryEnabled = true;
    return this.drainPending(limit);
  }

  stopAutoDelivery() {
    this.autoDeliveryEnabled = false;
    if (this.autoDeliveryTimer) clearTimeout(this.autoDeliveryTimer);
    this.autoDeliveryTimer = null;
  }

  private async scheduleNextAutoDelivery() {
    if (!this.autoDeliveryEnabled) return;
    if (this.autoDeliveryTimer) clearTimeout(this.autoDeliveryTimer);
    this.autoDeliveryTimer = null;
    const selected = await this.client.execute({
      sql: `SELECT MIN(
              CASE WHEN candidate.status = 'claimed'
                THEN candidate.claim_expires_at
                ELSE candidate.next_attempt_at
              END
            ) AS wake_at
            FROM run_goal_outbox candidate
            WHERE candidate.status IN ('pending', 'retryable', 'claimed')
              AND NOT EXISTS (
                SELECT 1 FROM run_goal_outbox earlier
                WHERE earlier.run_id = candidate.run_id
                  AND earlier.revision < candidate.revision
                  AND earlier.status != 'published'
              )`,
      args: [],
    });
    const rawWakeAt = selected.rows[0]?.wake_at;
    if (!this.autoDeliveryEnabled || rawWakeAt === null || rawWakeAt === undefined) return;
    const wakeAt = Number(rawWakeAt);
    if (!Number.isFinite(wakeAt)) return;
    const delay = Math.max(0, wakeAt - this.now());
    this.autoDeliveryTimer = setTimeout(() => {
      this.autoDeliveryTimer = null;
      void this.drainPending(1_000).catch((error) => {
        console.error("Failed to drain the goal event outbox:", error);
      });
    }, Math.min(delay, 2_147_483_647));
    this.autoDeliveryTimer.unref?.();
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
      cause: error instanceof Error ? { name: error.name, message } : null,
    });
    return "poisoned";
  }

  private emitDiagnostic(event: NamedEvent) {
    try {
      this.emit(event);
    } catch (error) {
      this.onDiagnosticFailure(event, error);
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
  if (pendingCount === 0) {
    await goalOutboxDispatcher.startAutoDelivery(0);
    return { publishedCount: 0, poisonedCount: 0 };
  }
  emitNamedEvent({ kind: "goal.outbox.recovery_started", pendingCount });
  const result = await goalOutboxDispatcher.startAutoDelivery(Math.min(1_000, pendingCount));
  emitNamedEvent({ kind: "goal.outbox.recovery_completed", ...result });
  return result;
}

export function stopGoalOutboxDelivery() {
  goalOutboxDispatcher.stopAutoDelivery();
}

export async function compactGoalControlHistory(
  client: DbClient = dbClient,
  options: { now?: number; retentionMs?: number; emit?: (event: NamedEvent) => unknown } = {},
) {
  const now = options.now ?? Date.now();
  const retentionMs = options.retentionMs ?? 30 * 24 * 60 * 60 * 1_000;
  const cutoff = now - retentionMs;
  const outbox = await client.execute({
    sql: `DELETE FROM run_goal_outbox
          WHERE status = 'published' AND published_at IS NOT NULL AND published_at < ?
            AND EXISTS (
              SELECT 1 FROM runs retained_run
              WHERE retained_run.id = run_goal_outbox.run_id
                AND (retained_run.archived_at IS NOT NULL OR retained_run.status IN ('done', 'failed', 'cancelled', 'canceled', 'promoted'))
                AND retained_run.updated_at < ?
            )`,
    args: [cutoff, cutoff],
  });
  const operations = await client.execute({
    sql: `DELETE FROM run_goal_operations
          WHERE updated_at < ?
            AND EXISTS (
              SELECT 1 FROM runs retained_run
              WHERE retained_run.id = run_goal_operations.run_id
                AND (retained_run.archived_at IS NOT NULL OR retained_run.status IN ('done', 'failed', 'cancelled', 'canceled', 'promoted'))
                AND retained_run.updated_at < ?
            )
            AND NOT EXISTS (
              SELECT 1 FROM run_goal_outbox pending
              WHERE pending.run_id = run_goal_operations.run_id AND pending.status != 'published'
            )`,
    args: [cutoff, cutoff],
  });
  const result = { operationCount: operations.rowsAffected, outboxCount: outbox.rowsAffected };
  if (result.operationCount > 0 || result.outboxCount > 0) {
    (options.emit ?? emitNamedEvent)({
      kind: "goal.history.compacted",
      ...result,
      cutoff: new Date(cutoff).toISOString(),
    });
  }
  return result;
}

function isBusyError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "SQLITE_BUSY" || (typeof candidate.message === "string" && candidate.message.includes("SQLITE_BUSY"));
}
