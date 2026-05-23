import { describe, expect, it, vi } from "vitest";
import {
  cancelInactiveAutoResumeTimers,
  shouldFireAutoResumeTimer,
  shouldSelectRecoveredRunAfterSuccess,
} from "@/app/home/auto-resume-selection";

describe("auto-resume selection guards", () => {
  it("does not select a recovered retry when the user has moved to another run", () => {
    expect(shouldSelectRecoveredRunAfterSuccess({
      action: "retry",
      currentSelectedRunId: "new-direct-run",
      requestedRunId: "old-failed-run",
      recoveredRunId: "old-failed-run",
    })).toBe(false);
  });

  it("selects recovered retry output only while the original run is still selected", () => {
    expect(shouldSelectRecoveredRunAfterSuccess({
      action: "retry",
      currentSelectedRunId: "old-failed-run",
      requestedRunId: "old-failed-run",
      recoveredRunId: "old-failed-run",
    })).toBe(true);
  });

  it("still selects explicit forks because they are user-requested navigation", () => {
    expect(shouldSelectRecoveredRunAfterSuccess({
      action: "fork",
      currentSelectedRunId: "current-run",
      requestedRunId: "source-run",
      recoveredRunId: "forked-run",
    })).toBe(true);
  });

  it("cancels scheduled auto-resume timers for runs that are no longer selected", () => {
    const activeTimer = setTimeout(() => undefined, 10_000);
    const staleTimer = setTimeout(() => undefined, 10_000);
    const clearTimer = vi.fn((timerId: ReturnType<typeof setTimeout>) => clearTimeout(timerId));
    const entries = new Map([
      ["active-run", { timerId: activeTimer }],
      ["stale-run", { timerId: staleTimer }],
      ["already-fired-run", { timerId: null }],
    ]);

    const cancelled = cancelInactiveAutoResumeTimers(entries, "active-run", clearTimer);
    clearTimeout(activeTimer);

    expect(cancelled).toBe(1);
    expect(clearTimer).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalledWith(staleTimer);
    expect([...entries.keys()]).toEqual(["active-run"]);
  });

  it("rechecks selected run and failure generation before a delayed auto-resume fires", () => {
    const timer = setTimeout(() => undefined, 10_000);
    const entries = new Map([
      ["failed-run", { failureKey: "failure-a", targetMessageId: "message-a", timerId: timer }],
    ]);

    try {
      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey: "failure-a",
        targetMessageId: "message-a",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(true);

      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey: "failure-a",
        targetMessageId: "message-a",
        activeRunId: "other-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);

      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey: "failure-b",
        targetMessageId: "message-a",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);

      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey: "failure-a",
        targetMessageId: "message-b",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);

      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey: "failure-a",
        targetMessageId: "message-a",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "blocked",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);

      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey: "failure-a",
        targetMessageId: "message-a",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "running",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);
    } finally {
      clearTimeout(timer);
    }
  });
});
