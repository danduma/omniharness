import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, executionEvents } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";

const ACTIVE_AUTH_STATUSES = new Set(["authenticating", "verifying"]);

/**
 * Make a credential that was independently proven dead unavailable to the
 * allocator. An in-flight replacement login owns the account state and must
 * not be overwritten by a stale worker failure.
 */
export async function markAccountLoginRequired(input: {
  accountId: string;
  workerType: string;
  reason: string;
  source: string;
  checkedAt?: Date;
}) {
  const account = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
  if (!account) return "missing" as const;
  if (ACTIVE_AUTH_STATUSES.has(account.status?.trim().toLowerCase() ?? "")) {
    return "auth_in_progress" as const;
  }
  if (!account.enabled && account.status === "login_required") {
    return "already_login_required" as const;
  }

  const checkedAt = input.checkedAt ?? new Date();
  await db.update(accounts).set({
    enabled: false,
    status: "login_required",
    statusCheckedAt: checkedAt,
    updatedAt: checkedAt,
  }).where(eq(accounts.id, input.accountId));
  emitNamedEvent({
    kind: "account.status_checked",
    accountId: input.accountId,
    workerType: input.workerType,
    previousStatus: account.status,
    status: "login_required",
    source: input.source,
    reason: input.reason,
  });
  return "updated" as const;
}

function parseVerificationDetails(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as {
      accountId?: unknown;
      liveness?: unknown;
      detail?: unknown;
    };
  } catch {
    return null;
  }
}

/**
 * One-time compatibility repair for releases that persisted the probe event
 * but did not update the account row. The newest credential verification per
 * account wins, and a newer explicit status check (including a successful
 * in-app login) fences the historical event.
 */
export async function repairAccountsFromCredentialVerificationHistory(now = new Date()) {
  const events = await db.select().from(executionEvents)
    .where(eq(executionEvents.eventType, "worker_credential_verified"))
    .orderBy(desc(executionEvents.createdAt), desc(executionEvents.id));
  const seenAccountIds = new Set<string>();
  let repaired = 0;

  for (const event of events) {
    const details = parseVerificationDetails(event.details ?? event.detailsPreview);
    const accountId = typeof details?.accountId === "string" ? details.accountId.trim() : "";
    if (!accountId || seenAccountIds.has(accountId)) continue;
    seenAccountIds.add(accountId);
    if (details?.liveness !== "dead" || !event.workerId) continue;

    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!account) continue;
    if (account.createdAt.getTime() >= event.createdAt.getTime()) continue;
    if (account.statusCheckedAt && account.statusCheckedAt.getTime() >= event.createdAt.getTime()) continue;

    const reason = typeof details.detail === "string"
      ? details.detail
      : "Persisted credential verification proved the account requires sign-in.";
    const result = await markAccountLoginRequired({
      accountId,
      workerType: account.cliType ?? "unknown",
      reason,
      source: "credential_verification_history",
      checkedAt: now,
    });
    if (result !== "updated") continue;

    emitNamedEvent({
      kind: "account.credential_verdict_recovered",
      accountId,
      runId: event.runId,
      workerId: event.workerId,
      workerType: account.cliType ?? "unknown",
      verdict: "dead",
      source: "execution_event",
    });
    emitNamedEvent({
      kind: "account.login_required",
      accountId,
      workerType: account.cliType ?? "unknown",
      reason,
    });
    repaired += 1;
  }

  return repaired;
}
