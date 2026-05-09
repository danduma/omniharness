import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import type { RecoveryState } from "./recovery-state";

export const RECOVERY_POLICY_SETTING_KEY = "RECOVERY_POLICY";

export type RecoveryPolicy = {
  autoRecoverImplementationRuns: boolean;
  autoRecoverDirectRuns: boolean;
  maxAutoAttemptsPerIncident: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  sessionResumeFirst: boolean;
  restartFromCheckpointWhenSessionMissing: boolean;
  preserveQueuedMessages: boolean;
};

export type RecoveryPolicyDecision =
  | { action: "none"; reason: string }
  | { action: "resume_session"; reason: string }
  | { action: "restart_from_checkpoint"; reason: string }
  | { action: "wait_for_backoff"; reason: string; nextAttemptAt: Date }
  | { action: "needs_user"; reason: string }
  | { action: "mark_failed"; reason: string };

export const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
  autoRecoverImplementationRuns: true,
  autoRecoverDirectRuns: false,
  maxAutoAttemptsPerIncident: 3,
  baseBackoffMs: 5_000,
  maxBackoffMs: 60_000,
  sessionResumeFirst: true,
  restartFromCheckpointWhenSessionMissing: true,
  preserveQueuedMessages: true,
};

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asPositiveInteger(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

export function normalizeRecoveryPolicy(value: unknown): RecoveryPolicy {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    autoRecoverImplementationRuns: asBoolean(record.autoRecoverImplementationRuns, DEFAULT_RECOVERY_POLICY.autoRecoverImplementationRuns),
    autoRecoverDirectRuns: asBoolean(record.autoRecoverDirectRuns, DEFAULT_RECOVERY_POLICY.autoRecoverDirectRuns),
    maxAutoAttemptsPerIncident: asPositiveInteger(record.maxAutoAttemptsPerIncident, DEFAULT_RECOVERY_POLICY.maxAutoAttemptsPerIncident),
    baseBackoffMs: asPositiveInteger(record.baseBackoffMs, DEFAULT_RECOVERY_POLICY.baseBackoffMs),
    maxBackoffMs: asPositiveInteger(record.maxBackoffMs, DEFAULT_RECOVERY_POLICY.maxBackoffMs),
    sessionResumeFirst: asBoolean(record.sessionResumeFirst, DEFAULT_RECOVERY_POLICY.sessionResumeFirst),
    restartFromCheckpointWhenSessionMissing: asBoolean(record.restartFromCheckpointWhenSessionMissing, DEFAULT_RECOVERY_POLICY.restartFromCheckpointWhenSessionMissing),
    preserveQueuedMessages: asBoolean(record.preserveQueuedMessages, DEFAULT_RECOVERY_POLICY.preserveQueuedMessages),
  };
}

export async function getRecoveryPolicy() {
  const stored = await db.select().from(settings).where(eq(settings.key, RECOVERY_POLICY_SETTING_KEY)).get();
  if (!stored?.value) {
    return DEFAULT_RECOVERY_POLICY;
  }

  try {
    return normalizeRecoveryPolicy(JSON.parse(stored.value));
  } catch {
    return DEFAULT_RECOVERY_POLICY;
  }
}

export async function saveRecoveryPolicy(policy: RecoveryPolicy) {
  const normalized = normalizeRecoveryPolicy(policy);
  await db.insert(settings).values({
    key: RECOVERY_POLICY_SETTING_KEY,
    value: JSON.stringify(normalized),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: settings.key,
    set: {
      value: JSON.stringify(normalized),
      updatedAt: new Date(),
    },
  });
  return normalized;
}

export function computeRecoveryBackoff(args: {
  policy: RecoveryPolicy;
  attemptCount: number;
  nowMs?: number;
}) {
  const nowMs = args.nowMs ?? Date.now();
  const multiplier = Math.max(1, 2 ** Math.max(0, args.attemptCount - 1));
  const delay = Math.min(args.policy.maxBackoffMs, args.policy.baseBackoffMs * multiplier);
  return new Date(nowMs + delay);
}

export function decideRecoveryAction(args: {
  runMode?: string | null;
  recoveryState: RecoveryState;
  policy: RecoveryPolicy;
  autoAttemptCount: number;
  nowMs?: number;
  force?: boolean;
}): RecoveryPolicyDecision {
  const { recoveryState, policy } = args;
  if (recoveryState.kind === "healthy" || recoveryState.kind === "recovering") {
    return { action: "none", reason: recoveryState.message };
  }

  if (args.autoAttemptCount >= policy.maxAutoAttemptsPerIncident && !args.force) {
    return {
      action: "needs_user",
      reason: `Automatic recovery reached the ${policy.maxAutoAttemptsPerIncident} attempt limit.`,
    };
  }

  const implementationRun = args.runMode === "implementation";
  if (!args.force) {
    if (implementationRun && !policy.autoRecoverImplementationRuns) {
      return { action: "needs_user", reason: "Automatic recovery is disabled for implementation runs." };
    }
    if (!implementationRun && !policy.autoRecoverDirectRuns) {
      return { action: "needs_user", reason: "Automatic recovery is disabled for this conversation mode." };
    }
  }

  if (recoveryState.kind === "lost_worker_resumable" && policy.sessionResumeFirst) {
    return { action: "resume_session", reason: "A saved worker session is available." };
  }

  if (recoveryState.kind === "lost_worker_rerunnable" && implementationRun && policy.restartFromCheckpointWhenSessionMissing) {
    return { action: "restart_from_checkpoint", reason: "No saved session is available; latest checkpoint can restart the supervisor." };
  }

  if (recoveryState.kind === "queue_blocked") {
    return implementationRun
      ? { action: "restart_from_checkpoint", reason: "Queued message is blocked by a missing worker." }
      : { action: "needs_user", reason: "Queued message is blocked by a missing direct worker." };
  }

  return { action: "needs_user", reason: recoveryState.reason || recoveryState.message };
}
