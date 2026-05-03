import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

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
    return null;
  }

  const lease: SupervisorWakeLease = {
    leaseId: randomUUID(),
    expiresAt: now + LEASE_TTL_MS,
  };
  const value = JSON.stringify(lease);

  if (!existing) {
    try {
      await db.insert(settings).values({ key, value, updatedAt: new Date(now) });
      return lease.leaseId;
    } catch {
      return null;
    }
  }

  await db.update(settings)
    .set({ value, updatedAt: new Date(now) })
    .where(and(eq(settings.key, key), eq(settings.value, existing.value)));

  const claimed = await db.select().from(settings).where(eq(settings.key, key)).get();
  return claimed?.value === value ? lease.leaseId : null;
}

export async function releaseSupervisorWakeLease(runId: string, leaseId: string) {
  const key = leaseKey(runId);
  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
  if (!existing) {
    return;
  }

  const existingLease = existing ? parseLease(existing.value) : null;
  if (existingLease?.leaseId !== leaseId) {
    return;
  }

  await db.delete(settings).where(and(eq(settings.key, key), eq(settings.value, existing.value)));
}

export async function clearSupervisorWakeLease(runId: string) {
  await db.delete(settings).where(eq(settings.key, leaseKey(runId)));
}
