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
});
