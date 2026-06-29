import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountUsageSnapshots,
  accounts,
  recoveryIncidents,
  workerCredentialAllocations,
} from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { RuntimeHttpError } from "@/server/agent-runtime/types";
import { runAccountInventoryMigration } from "@/server/accounts/migration";

type AccountRow = typeof accounts.$inferSelect;
type AccountUsageSnapshotRow = typeof accountUsageSnapshots.$inferSelect;
type EnvLike = Record<string, string | undefined>;
const OPEN_QUOTA_INCIDENT_STATUSES = ["open", "waiting", "quota_waiting", "recovering", "needs_user"] as const;

export type AccountAllocationStrategy =
  | "manual"
  | "priority"
  | "round_robin"
  | "quota_balanced"
  | "subscription_then_api"
  | "wait_for_reset";

export type AccountAllocationInput = {
  workerType: string;
  runId?: string | null;
  workerId?: string | null;
  explicitAccountId?: string | null;
  strategy?: AccountAllocationStrategy | null;
  env?: EnvLike;
  now?: Date;
};

export type AccountAllocation = {
  account: AccountRow | null;
  strategy: AccountAllocationStrategy;
  explicit: boolean;
  reason: string;
};

function normalizeWorkerType(value: string) {
  return value.trim().toLowerCase();
}

function normalizeStrategy(value: AccountAllocationStrategy | null | undefined): AccountAllocationStrategy {
  return value || "priority";
}

function isUsable(account: AccountRow) {
  if (!account.enabled) return false;
  const status = account.status?.trim().toLowerCase();
  return status !== "quota_exhausted" && status !== "login_required" && status !== "disabled";
}

function envKeyFromAuthRef(authRef: string) {
  const trimmed = authRef.trim();
  if (trimmed.startsWith("setting:")) return trimmed.slice("setting:".length).trim();
  return trimmed;
}

function hasAvailableAutomaticCredential(account: AccountRow, env: EnvLike | undefined) {
  if (account.authMode !== "api_key") {
    return true;
  }
  const envKey = envKeyFromAuthRef(account.authRef);
  return Boolean(envKey && env?.[envKey]?.trim());
}

function parseIncidentDetails(details: string | null): Record<string, unknown> {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function incidentResumeAt(details: Record<string, unknown>) {
  const value = details.resumeAt;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

async function quotaBlockedAccountIds(now: Date) {
  const rows = await db.select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.kind, "quota_exhausted"),
      inArray(recoveryIncidents.status, [...OPEN_QUOTA_INCIDENT_STATUSES]),
    ));
  const result = new Set<string>();
  for (const row of rows) {
    const details = parseIncidentDetails(row.details);
    const accountId = typeof details.accountId === "string" ? details.accountId.trim() : "";
    const resumeAt = incidentResumeAt(details);
    if (accountId && (!resumeAt || resumeAt.getTime() > now.getTime())) {
      result.add(accountId);
    }
  }
  return result;
}

function accountMatchesWorkerType(account: AccountRow, workerType: string) {
  return !account.cliType || normalizeWorkerType(account.cliType) === normalizeWorkerType(workerType);
}

function sortByPriority(a: AccountRow, b: AccountRow) {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function latestUsableCapacity(snapshot: AccountUsageSnapshotRow | undefined) {
  if (!snapshot) return Number.NEGATIVE_INFINITY;
  return snapshot.remainingTokens ?? Math.max(0, snapshot.usedTokens * -1);
}

async function listCandidateAccounts(workerType: string) {
  const rows = await db.select().from(accounts);
  return rows.filter((account) => accountMatchesWorkerType(account, workerType));
}

async function countAllocationsByAccount(workerType: string) {
  const rows = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerType, workerType));
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1);
  }
  return counts;
}

async function latestSnapshotsByAccount(workerType: string) {
  const rows = await db
    .select()
    .from(accountUsageSnapshots)
    .where(eq(accountUsageSnapshots.workerType, workerType));
  const latest = new Map<string, AccountUsageSnapshotRow>();
  for (const row of rows) {
    const current = latest.get(row.accountId);
    if (!current || row.updatedAt.getTime() > current.updatedAt.getTime()) {
      latest.set(row.accountId, row);
    }
  }
  return latest;
}

async function persistAllocation(input: AccountAllocationInput, allocation: AccountAllocation) {
  if (!allocation.account || !input.runId || !input.workerId) return;
  const now = input.now ?? new Date();
  await db.insert(workerCredentialAllocations).values({
    id: randomUUID(),
    runId: input.runId,
    workerId: input.workerId,
    workerType: normalizeWorkerType(input.workerType),
    accountId: allocation.account.id,
    strategy: allocation.strategy,
    selectionReason: allocation.reason,
    explicit: allocation.explicit,
    createdAt: now,
    updatedAt: now,
  });
}

function emitSelection(input: AccountAllocationInput, allocation: AccountAllocation) {
  if (!allocation.account) return;
  emitNamedEvent({
    kind: "account.credential_selected",
    accountId: allocation.account.id,
    runId: input.runId ?? undefined,
    workerId: input.workerId ?? undefined,
    workerType: normalizeWorkerType(input.workerType),
    strategy: allocation.strategy,
    explicit: allocation.explicit,
    reason: allocation.reason,
  });
}

async function chooseAutomaticAccount(
  workerType: string,
  strategy: AccountAllocationStrategy,
  candidates: AccountRow[],
  env: EnvLike | undefined,
): Promise<{ account: AccountRow | null; reason: string }> {
  const usable = candidates.filter((account) => isUsable(account) && hasAvailableAutomaticCredential(account, env));
  if (usable.length === 0) return { account: null, reason: "no usable automatic account inventory row" };

  if (strategy === "subscription_then_api") {
    const subscription = usable.filter((account) => account.type === "subscription").sort(sortByPriority)[0];
    if (subscription) return { account: subscription, reason: "selected highest-priority subscription account" };
    const api = usable.filter((account) => account.type === "api").sort(sortByPriority)[0];
    return { account: api ?? null, reason: api ? "selected API account after subscription options were unavailable" : "no subscription or API account was usable" };
  }

  if (strategy === "round_robin") {
    const counts = await countAllocationsByAccount(normalizeWorkerType(workerType));
    const account = [...usable].sort((a, b) => {
      const byCount = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
      return byCount || sortByPriority(a, b);
    })[0];
    return { account, reason: "selected least-used enabled account" };
  }

  if (strategy === "quota_balanced") {
    const snapshots = await latestSnapshotsByAccount(normalizeWorkerType(workerType));
    const account = [...usable].sort((a, b) => {
      const byRemaining = latestUsableCapacity(snapshots.get(b.id)) - latestUsableCapacity(snapshots.get(a.id));
      return byRemaining || sortByPriority(a, b);
    })[0];
    return { account, reason: "selected account with most remaining quota" };
  }

  const account = [...usable].sort(sortByPriority)[0];
  return { account, reason: strategy === "wait_for_reset" ? "selected priority account for wait policy" : "selected highest-priority enabled account" };
}

export async function allocateWorkerAccount(input: AccountAllocationInput): Promise<AccountAllocation> {
  const workerType = normalizeWorkerType(input.workerType);
  const strategy = normalizeStrategy(input.strategy);
  await runAccountInventoryMigration();
  const candidates = await listCandidateAccounts(workerType);

  if (input.explicitAccountId?.trim()) {
    const account = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, input.explicitAccountId.trim())))
      .get();
    if (!account) {
      throw new RuntimeHttpError(400, `Account "${input.explicitAccountId}" was not found.`);
    }
    if (!accountMatchesWorkerType(account, workerType)) {
      throw new RuntimeHttpError(400, `Account "${account.id}" cannot be used for ${workerType} workers.`);
    }
    if (!isUsable(account)) {
      throw new RuntimeHttpError(400, `Account "${account.id}" is not currently usable.`);
    }
    const blockedAccountIds = await quotaBlockedAccountIds(input.now ?? new Date());
    if (blockedAccountIds.has(account.id)) {
      throw new RuntimeHttpError(400, `Account "${account.id}" is quota blocked.`);
    }
    const allocation = {
      account,
      strategy: "manual" as const,
      explicit: true,
      reason: "explicit run account preference",
    };
    await persistAllocation(input, allocation);
    emitSelection(input, allocation);
    return allocation;
  }

  if (candidates.length === 0) {
    return {
      account: null,
      strategy,
      explicit: false,
      reason: "no account inventory exists for worker type",
    };
  }

  const blockedAccountIds = await quotaBlockedAccountIds(input.now ?? new Date());
  const { account, reason } = await chooseAutomaticAccount(
    workerType,
    strategy,
    candidates.filter((account) => !blockedAccountIds.has(account.id)),
    input.env,
  );
  if (!account) {
    return {
      account: null,
      strategy,
      explicit: false,
      reason,
    };
  }

  const allocation = {
    account,
    strategy,
    explicit: false,
    reason,
  };
  await persistAllocation(input, allocation);
  emitSelection(input, allocation);
  return allocation;
}
