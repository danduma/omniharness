import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import {
  DEFAULT_RECOVERY_POLICY,
  RECOVERY_POLICY_SETTING_KEY,
  computeRecoveryBackoff,
  decideRecoveryAction,
  getRecoveryPolicy,
  saveRecoveryPolicy,
} from "@/server/runs/recovery-policy";

describe("recovery policy", () => {
  beforeEach(async () => {
    await db.delete(settings).where(eq(settings.key, RECOVERY_POLICY_SETTING_KEY));
  });

  it("loads defaults when no persisted policy exists", async () => {
    await expect(getRecoveryPolicy()).resolves.toEqual(DEFAULT_RECOVERY_POLICY);
  });

  it("normalizes legacy policies with quota defaults", async () => {
    const saved = await saveRecoveryPolicy({
      autoRecoverImplementationRuns: true,
      autoRecoverDirectRuns: false,
      maxAutoAttemptsPerIncident: 3,
      baseBackoffMs: 5_000,
      maxBackoffMs: 60_000,
      sessionResumeFirst: true,
      restartFromCheckpointWhenSessionMissing: true,
      preserveQueuedMessages: true,
    });

    expect(saved).toMatchObject({
      autoResumeAfterQuotaReset: true,
      quotaResetGraceMs: 1_000,
      maxQuotaWaitMs: 86_400_000,
      allowQuotaWaitWithoutParsedReset: false,
    });
  });

  it("persists normalized policy settings", async () => {
    const saved = await saveRecoveryPolicy({
      ...DEFAULT_RECOVERY_POLICY,
      autoRecoverImplementationRuns: false,
      maxAutoAttemptsPerIncident: 5,
    });

    expect(saved.autoRecoverImplementationRuns).toBe(false);
    await expect(getRecoveryPolicy()).resolves.toMatchObject({
      autoRecoverImplementationRuns: false,
      maxAutoAttemptsPerIncident: 5,
    });
  });

  it("chooses restart from checkpoint for implementation missing-session recovery", () => {
    const decision = decideRecoveryAction({
      runMode: "implementation",
      policy: DEFAULT_RECOVERY_POLICY,
      autoAttemptCount: 0,
      recoveryState: {
        kind: "lost_worker_rerunnable",
        status: "open",
        message: "missing",
        recommendedAction: "restart_from_checkpoint",
      },
    });

    expect(decision.action).toBe("restart_from_checkpoint");
  });

  it("resumes saved direct worker sessions even when direct reruns need manual recovery", () => {
    const decision = decideRecoveryAction({
      runMode: "direct",
      policy: { ...DEFAULT_RECOVERY_POLICY, autoRecoverDirectRuns: false },
      autoAttemptCount: 0,
      recoveryState: {
        kind: "lost_worker_resumable",
        status: "open",
        message: "missing",
        recommendedAction: "resume_session",
        workerId: "worker-1",
        sessionId: "session-1",
      },
    });

    expect(decision.action).toBe("resume_session");
  });

  it("replaces the worker instead of dead-ending a blocked direct queue", () => {
    // `needs_user` here was not a prompt but a dead end: Resume re-classified
    // the run, landed on `queue_blocked` again, and returned needs_user again.
    const decision = decideRecoveryAction({
      runMode: "direct",
      policy: DEFAULT_RECOVERY_POLICY,
      autoAttemptCount: 0,
      recoveryState: {
        kind: "queue_blocked",
        status: "needs_user",
        message: "blocked",
        recommendedAction: "manual_resume",
        workerId: "worker-1",
        queuedMessageId: "queue-1",
      },
    });

    expect(decision.action).toBe("restart_direct_worker");
  });

  it("lets a forced resume act on a blocked direct queue with auto-recovery disabled", () => {
    const decision = decideRecoveryAction({
      runMode: "direct",
      policy: { ...DEFAULT_RECOVERY_POLICY, autoRecoverDirectRuns: false },
      autoAttemptCount: 9,
      force: true,
      recoveryState: {
        kind: "queue_blocked",
        status: "needs_user",
        message: "blocked",
        recommendedAction: "manual_resume",
        workerId: "worker-1",
        queuedMessageId: "queue-1",
      },
    });

    expect(decision.action).toBe("restart_direct_worker");
  });

  it("stops automation when attempt budget is exhausted", () => {
    const decision = decideRecoveryAction({
      runMode: "implementation",
      policy: { ...DEFAULT_RECOVERY_POLICY, maxAutoAttemptsPerIncident: 1 },
      autoAttemptCount: 1,
      recoveryState: {
        kind: "lost_worker_rerunnable",
        status: "open",
        message: "missing",
        recommendedAction: "restart_from_checkpoint",
      },
    });

    expect(decision).toMatchObject({
      action: "needs_user",
    });
  });

  it("computes capped exponential backoff", () => {
    const next = computeRecoveryBackoff({
      policy: { ...DEFAULT_RECOVERY_POLICY, baseBackoffMs: 1_000, maxBackoffMs: 3_000 },
      attemptCount: 4,
      nowMs: 10_000,
    });

    expect(next.getTime()).toBe(13_000);
  });

  it("waits for quota reset without consuming normal recovery attempt budget", () => {
    const decision = decideRecoveryAction({
      runMode: "implementation",
      policy: { ...DEFAULT_RECOVERY_POLICY, maxAutoAttemptsPerIncident: 1 },
      autoAttemptCount: 99,
      recoveryState: {
        kind: "quota_waiting",
        status: "open",
        message: "Waiting for quota reset.",
        recommendedAction: "wait_for_quota_reset",
        resumeAt: "2026-05-10T18:00:01.000Z",
      },
    });

    expect(decision).toMatchObject({
      action: "wait_for_quota_reset",
      resumeAt: new Date("2026-05-10T18:00:01.000Z"),
    });
  });
});
