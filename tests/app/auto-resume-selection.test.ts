import { describe, expect, it, vi } from "vitest";
import {
  cancelInactiveAutoResumeTimers,
  isPermanentAutoResumeFailure,
  shouldFireAutoResumeTimer,
  shouldSelectRecoveredRunAfterSuccess,
} from "@/interface/home/auto-resume-selection";

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

  it("does not auto-resume permanent account and billing failures", () => {
    const timer = setTimeout(() => undefined, 10_000);
    const failureKey = ":The run cannot continue due to an API billing error (402 Runner billing required: cap_exceeded). Please check your billing status and try again.";
    const entries = new Map([
      ["failed-run", { failureKey, targetMessageId: "message-a", timerId: timer }],
    ]);

    try {
      expect(isPermanentAutoResumeFailure(failureKey)).toBe(true);
      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey,
        targetMessageId: "message-a",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);
    } finally {
      clearTimeout(timer);
    }
  });

  it("does not auto-resume dead credentials however the adapter words them", () => {
    // Reopening a run re-arms auto-resume. These accounts can never answer, so
    // firing again just replays the same failure every time the user looks at
    // the conversation.
    for (const failureKey of [
      ":Internal error: Failed to authenticate. API Error: 403 Account suspended",
      ":Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.",
      ":Spawn failed: authentication_failed",
    ]) {
      expect(isPermanentAutoResumeFailure(failureKey)).toBe(true);
    }
  });

  it("still auto-resumes transient connection failures", () => {
    expect(isPermanentAutoResumeFailure(":Ask failed: read ECONNRESET")).toBe(false);
    expect(isPermanentAutoResumeFailure(":Ask failed: API Error: 429 rate limit reached")).toBe(false);
  });

  it("does not auto-resume resource admission failures", () => {
    expect(isPermanentAutoResumeFailure(
      ":Cannot spawn worker because system resources are low (disk free 6912 MB, below 8192 MB). Free disk space before retrying.",
    )).toBe(true);
  });

  it("does not auto-resume Claude EDE diagnostics, while leaving explicit recovery available", () => {
    const timer = setTimeout(() => undefined, 10_000);
    const failureKey = ":Ask failed: Internal error: [ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null";
    const entries = new Map([
      ["failed-run", { failureKey, targetMessageId: "message-a", timerId: timer }],
    ]);

    try {
      expect(isPermanentAutoResumeFailure(failureKey)).toBe(true);
      expect(shouldFireAutoResumeTimer({
        entries,
        runId: "failed-run",
        failureKey,
        targetMessageId: "message-a",
        activeRunId: "failed-run",
        isAutoResumableConversation: true,
        selectedRunStatus: "failed",
        failedWorkerAvailabilityStatus: "ok",
        hasWorkerFailureDetail: false,
        recoverRunIsPending: false,
      })).toBe(false);
    } finally {
      clearTimeout(timer);
    }
  });
});
