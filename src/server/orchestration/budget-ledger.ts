import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, dbClient } from "@/server/db";
import { orchestrationBudgetLedger } from "@/server/db/schema";
import { withSqliteBusyRetry } from "@/server/db/retry";
import type { StageBudget } from "@/shared/orchestration-policy";

/**
 * Orchestration budget ledger.
 *
 * Authoritative for dispatch (the preflight estimator is advisory). Each
 * stage attempt has one reservation and at most one settlement:
 *
 *  - a reservation is admitted by a single INSERT…SELECT whose predicate
 *    re-reads the run's committed spend, so two concurrent reservations
 *    cannot both pass a cap;
 *  - committed spend per stage is its settled usage when the provider
 *    reported it, otherwise its full reservation — unknown usage never
 *    frees budget, so it can never bypass a hard cap;
 *  - settlement is insert-once (unique `(stage_id, entry_kind)`), so every
 *    terminal result settles the same reservation exactly once.
 */

type LedgerRow = typeof orchestrationBudgetLedger.$inferSelect;

export type ReserveStageBudgetArgs = {
  runId: string;
  stageId: string;
  stageBudget: StageBudget;
  runBudget: StageBudget;
  /** Defaults to the stage cap: the conservative estimate. */
  tokens?: number | null;
  costUsd?: number | null;
};

export type ReserveStageBudgetResult =
  | { ok: true; reservationId: string; tokens: number | null; costUsd: number | null; duplicate: boolean }
  | { ok: false; reason: "stage_cap" | "run_cap"; committedTokens: number; committedCostUsd: number };

export type StageUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
};

export type SettleStageBudgetResult = { settled: boolean; duplicate: boolean; usageUnknown: boolean };

export type RunBudgetSummary = {
  reservedTokens: number;
  reservedCostUsd: number;
  settledTokens: number;
  settledCostUsd: number;
  /** Spend that counts against caps: settled where known, reserved otherwise. */
  committedTokens: number;
  committedCostUsd: number;
  unsettledStages: number;
  unknownUsageStages: number;
};

function exceeds(value: number | null | undefined, cap: number | null) {
  return cap !== null && value !== null && value !== undefined && value > cap;
}

const COMMITTED_TOKENS_SQL = `
  SELECT COALESCE(SUM(CASE WHEN s.id IS NOT NULL AND s.usage_unknown = 0 THEN COALESCE(s.tokens, 0) ELSE COALESCE(r.tokens, 0) END), 0)
  FROM orchestration_budget_ledger r
  LEFT JOIN orchestration_budget_ledger s ON s.stage_id = r.stage_id AND s.entry_kind = 'settlement'
  WHERE r.run_id = ? AND r.entry_kind = 'reservation'`;

const COMMITTED_COST_SQL = `
  SELECT COALESCE(SUM(CASE WHEN s.id IS NOT NULL AND s.usage_unknown = 0 AND s.cost_usd IS NOT NULL THEN s.cost_usd ELSE COALESCE(r.cost_usd, 0) END), 0)
  FROM orchestration_budget_ledger r
  LEFT JOIN orchestration_budget_ledger s ON s.stage_id = r.stage_id AND s.entry_kind = 'settlement'
  WHERE r.run_id = ? AND r.entry_kind = 'reservation'`;

export async function reserveStageBudget(args: ReserveStageBudgetArgs): Promise<ReserveStageBudgetResult> {
  const tokens = args.tokens === undefined ? args.stageBudget.maxTokens : args.tokens;
  const costUsd = args.costUsd === undefined ? args.stageBudget.maxCostUsd : args.costUsd;

  const existing = await db.select().from(orchestrationBudgetLedger).where(and(
    eq(orchestrationBudgetLedger.stageId, args.stageId),
    eq(orchestrationBudgetLedger.entryKind, "reservation"),
  )).get();
  if (existing) {
    return { ok: true, reservationId: existing.id, tokens: existing.tokens, costUsd: existing.costUsd, duplicate: true };
  }

  if (exceeds(tokens, args.stageBudget.maxTokens) || exceeds(costUsd, args.stageBudget.maxCostUsd)) {
    const summary = await getRunBudgetSummary(args.runId);
    return { ok: false, reason: "stage_cap", committedTokens: summary.committedTokens, committedCostUsd: summary.committedCostUsd };
  }

  const id = randomUUID();
  const runTokenCap = args.runBudget.maxTokens;
  const runCostCap = args.runBudget.maxCostUsd;
  const result = await withSqliteBusyRetry(() => dbClient.execute({
    sql: `INSERT INTO orchestration_budget_ledger (id, run_id, stage_id, entry_kind, tokens, cost_usd, usage_unknown, created_at)
      SELECT ?, ?, ?, 'reservation', ?, ?, 0, ?
      WHERE (? IS NULL OR (${COMMITTED_TOKENS_SQL}) + ? <= ?)
        AND (? IS NULL OR (${COMMITTED_COST_SQL}) + ? <= ?)
      ON CONFLICT(stage_id, entry_kind) DO NOTHING`,
    args: [
      id, args.runId, args.stageId, tokens, costUsd, Math.floor(Date.now() / 1000),
      runTokenCap, args.runId, tokens ?? 0, runTokenCap,
      runCostCap, args.runId, costUsd ?? 0, runCostCap,
    ],
  }));
  if (result.rowsAffected === 1) {
    return { ok: true, reservationId: id, tokens, costUsd, duplicate: false };
  }
  const raced = await db.select().from(orchestrationBudgetLedger).where(and(
    eq(orchestrationBudgetLedger.stageId, args.stageId),
    eq(orchestrationBudgetLedger.entryKind, "reservation"),
  )).get();
  if (raced) {
    return { ok: true, reservationId: raced.id, tokens: raced.tokens, costUsd: raced.costUsd, duplicate: true };
  }
  const summary = await getRunBudgetSummary(args.runId);
  return { ok: false, reason: "run_cap", committedTokens: summary.committedTokens, committedCostUsd: summary.committedCostUsd };
}

/**
 * Settle a stage's reservation once. `usage` null (or with no token
 * numbers) records `usageUnknown`; nothing is invented.
 */
export async function settleStageBudget(args: { runId: string; stageId: string; usage: StageUsage | null }): Promise<SettleStageBudgetResult> {
  const input = args.usage?.inputTokens ?? null;
  const output = args.usage?.outputTokens ?? null;
  const usageUnknown = input === null && output === null;
  const tokens = usageUnknown ? null : (input ?? 0) + (output ?? 0);
  const result = await withSqliteBusyRetry(() => dbClient.execute({
    sql: `INSERT INTO orchestration_budget_ledger (id, run_id, stage_id, entry_kind, tokens, cost_usd, input_tokens, output_tokens, usage_unknown, created_at)
      VALUES (?, ?, ?, 'settlement', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stage_id, entry_kind) DO NOTHING`,
    args: [randomUUID(), args.runId, args.stageId, tokens, args.usage?.costUsd ?? null, input, output, usageUnknown ? 1 : 0, Math.floor(Date.now() / 1000)],
  }));
  return { settled: result.rowsAffected === 1, duplicate: result.rowsAffected !== 1, usageUnknown };
}

export async function getRunBudgetSummary(runId: string): Promise<RunBudgetSummary> {
  const rows: LedgerRow[] = await db.select().from(orchestrationBudgetLedger).where(eq(orchestrationBudgetLedger.runId, runId));
  const settlements = new Map<string, LedgerRow>(rows.filter((row) => row.entryKind === "settlement").map((row) => [row.stageId, row]));
  const summary: RunBudgetSummary = {
    reservedTokens: 0,
    reservedCostUsd: 0,
    settledTokens: 0,
    settledCostUsd: 0,
    committedTokens: 0,
    committedCostUsd: 0,
    unsettledStages: 0,
    unknownUsageStages: 0,
  };
  for (const reservation of rows.filter((row) => row.entryKind === "reservation")) {
    const reservedTokens = reservation.tokens ?? 0;
    const reservedCost = reservation.costUsd ?? 0;
    summary.reservedTokens += reservedTokens;
    summary.reservedCostUsd += reservedCost;
    const settlement = settlements.get(reservation.stageId);
    if (!settlement) {
      summary.unsettledStages += 1;
      summary.committedTokens += reservedTokens;
      summary.committedCostUsd += reservedCost;
      continue;
    }
    if (settlement.usageUnknown) {
      summary.unknownUsageStages += 1;
      summary.committedTokens += reservedTokens;
      summary.committedCostUsd += settlement.costUsd ?? reservedCost;
      if (settlement.costUsd !== null) summary.settledCostUsd += settlement.costUsd;
      continue;
    }
    summary.settledTokens += settlement.tokens ?? 0;
    summary.settledCostUsd += settlement.costUsd ?? 0;
    summary.committedTokens += settlement.tokens ?? 0;
    summary.committedCostUsd += settlement.costUsd ?? reservedCost;
  }
  return summary;
}

export async function getStageLedger(stageId: string) {
  const rows = await db.select().from(orchestrationBudgetLedger).where(eq(orchestrationBudgetLedger.stageId, stageId));
  return {
    reservation: rows.find((row) => row.entryKind === "reservation") ?? null,
    settlement: rows.find((row) => row.entryKind === "settlement") ?? null,
  };
}

