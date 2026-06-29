import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { emitNamedEvent } from "@/server/events/named-events";

const LEASE_TTL_MS = 15 * 60_000;
const LEASE_KEY_PREFIX = "SUPERVISOR_WAKE_LEASE:";

type SupervisorWakeLease = {
  leaseId: string;
  expiresAt: number;
};

function leaseKey(runId: string) {
  return `${LEASE_KEY_PREFIX}${runId}`;
}

function parseLease(value: string): SupervisorWakeLease | null {
  try {
    const parsed = JSON.parse(value) as Partial<SupervisorWakeLease>;
    return typeof parsed.leaseId === "string" && typeof parsed.expiresAt === "number"
      ? { leaseId: parsed.leaseId, expiresAt: parsed.expiresAt }
      : null;
  } catch {
    return null;
  }
}

export async function acquireSupervisorWakeLease(runId: string, now = Date.now()) {
  const key = leaseKey(runId);
  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
  const existingLease = existing ? parseLease(existing.value) : null;
  if (existingLease && existingLease.expiresAt > now) {
    emitNamedEvent({ kind: "supervisor.wake_lease_blocked", runId, reason: "active_lease" });
    return null;
  }

  const lease: SupervisorWakeLease = {
    leaseId: randomUUID(),
    expiresAt: now + LEASE_TTL_MS,
  };
  const value = JSON.stringify(lease);

  if (!existing) {
    try {
      await withSqliteBusyRetry(() => db.insert(settings).values({ key, value, updatedAt: new Date(now) }));
      emitNamedEvent({ kind: "supervisor.wake_lease_acquired", runId, source: "insert" });
      return lease.leaseId;
    } catch {
      emitNamedEvent({ kind: "supervisor.wake_lease_blocked", runId, reason: "insert_conflict" });
      return null;
    }
  }

  const replaceSource = existingLease ? "replace_expired" : "replace_malformed";
  await withSqliteBusyRetry(() => db.update(settings)
    .set({ value, updatedAt: new Date(now) })
    .where(and(eq(settings.key, key), eq(settings.value, existing.value))));

  const claimed = await db.select().from(settings).where(eq(settings.key, key)).get();
  if (claimed?.value === value) {
    emitNamedEvent({ kind: "supervisor.wake_lease_acquired", runId, source: replaceSource });
    return lease.leaseId;
  }
  emitNamedEvent({ kind: "supervisor.wake_lease_blocked", runId, reason: "claim_race" });
  return null;
}

export async function releaseSupervisorWakeLease(runId: string, leaseId: string) {
  const key = leaseKey(runId);
  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
  if (!existing) {
    emitNamedEvent({ kind: "supervisor.wake_lease_release_skipped", runId, reason: "missing" });
    return;
  }

  const existingLease = existing ? parseLease(existing.value) : null;
  if (!existingLease) {
    emitNamedEvent({ kind: "supervisor.wake_lease_release_skipped", runId, reason: "malformed" });
    return;
  }

  if (existingLease.leaseId !== leaseId) {
    emitNamedEvent({ kind: "supervisor.wake_lease_release_skipped", runId, reason: "not_owner" });
    return;
  }

  await withSqliteBusyRetry(() => db.delete(settings).where(and(eq(settings.key, key), eq(settings.value, existing.value))));
  emitNamedEvent({ kind: "supervisor.wake_lease_released", runId });
}

export async function clearSupervisorWakeLease(runId: string) {
  await withSqliteBusyRetry(() => db.delete(settings).where(eq(settings.key, leaseKey(runId))));
}
