import { describe, expect, it } from "vitest";
import {
  isMutationPendingForSelectedRun,
  resolveDirectControlPendingAssistantStatus,
  resolvePendingConversationWorkerId,
  shouldShowDirectControlPendingAssistant,
} from "@/app/home/direct-control-activity";

describe("shouldShowDirectControlPendingAssistant", () => {
  it("does not show Thinking from a stale running run when the worker is idle with durable output", () => {
    expect(shouldShowDirectControlPendingAssistant({
      isDirectConversation: true,
      pendingConversationWorkerId: null,
      busyConversationWorkerId: null,
      selectedRunStatus: "running",
      workerStatuses: ["idle"],
      agentStates: ["idle"],
      hasAgentCurrentText: false,
    })).toBe(false);
  });

  it("shows Thinking while direct worker work is actually active", () => {
    const args = {
      isDirectConversation: true,
      pendingConversationWorkerId: null,
      busyConversationWorkerId: "run-1-worker-1",
      selectedRunStatus: "running",
      workerStatuses: ["working"],
      agentStates: ["working"],
      hasAgentCurrentText: true,
    };

    expect(shouldShowDirectControlPendingAssistant(args)).toBe(true);
    expect(resolveDirectControlPendingAssistantStatus(args)).toBe("working");
  });

  it("does not show Working while the direct worker is waiting on human input", () => {
    expect(resolveDirectControlPendingAssistantStatus({
      isDirectConversation: true,
      pendingConversationWorkerId: null,
      busyConversationWorkerId: "run-1-worker-1",
      selectedRunStatus: "running",
      workerStatuses: ["working"],
      agentStates: ["working"],
      hasAgentCurrentText: true,
      hasPendingHumanInput: true,
    })).toBe(null);
  });

  it("labels pending direct-send handoff as connecting before the worker starts", () => {
    expect(resolveDirectControlPendingAssistantStatus({
      isDirectConversation: true,
      pendingConversationWorkerId: "run-1-worker-1",
      busyConversationWorkerId: null,
      selectedRunStatus: "running",
      workerStatuses: ["idle"],
      agentStates: ["idle"],
      hasAgentCurrentText: false,
    })).toBe("connecting");
  });

  it("labels live assistant text without a working status as thinking", () => {
    expect(resolveDirectControlPendingAssistantStatus({
      isDirectConversation: true,
      pendingConversationWorkerId: null,
      busyConversationWorkerId: null,
      selectedRunStatus: "running",
      workerStatuses: ["idle"],
      agentStates: ["idle"],
      hasAgentCurrentText: true,
    })).toBe("thinking");
  });

  it("does not show Thinking for a terminal direct run even if stale worker text remains", () => {
    expect(shouldShowDirectControlPendingAssistant({
      isDirectConversation: true,
      pendingConversationWorkerId: null,
      busyConversationWorkerId: null,
      selectedRunStatus: "done",
      workerStatuses: ["idle"],
      agentStates: ["idle"],
      hasAgentCurrentText: true,
    })).toBe(false);
  });

  it("scopes pending mutations to the selected run", () => {
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "run-a",
      selectedRunId: "run-a",
    })).toBe(true);

    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "run-a",
      selectedRunId: "run-b",
    })).toBe(false);
  });

  it("does not report send-message pending when the user has switched off the run that owns the send", () => {
    // Replays the actual race: user fires send on run-a, then switches
    // selection to run-b before the mutation resolves. The composer for
    // run-b must not show pending/stop UI driven by run-a's send.
    const isSendingForCurrentSelection = isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "run-a",
      selectedRunId: "run-b",
    });
    expect(isSendingForCurrentSelection).toBe(false);
  });

  it("does not report planning-promotion pending when the user has switched off the source run", () => {
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "planning-run-a",
      selectedRunId: "planning-run-b",
    })).toBe(false);
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "planning-run-a",
      selectedRunId: "planning-run-a",
    })).toBe(true);
  });

  it("does not report recoverRun pending when the user has switched off the run being recovered", () => {
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "failed-run",
      selectedRunId: "different-run",
    })).toBe(false);
  });

  it("does not report resumeRunRecovery pending when the user has switched off the run being resumed", () => {
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "resuming-run",
      selectedRunId: "other-run",
    })).toBe(false);
  });

  it("returns false when no mutationRunId has been recorded (mutation never started against any run)", () => {
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: undefined,
      selectedRunId: "run-a",
    })).toBe(false);
  });

  it("returns false when no run is currently selected, even if a mutation is pending", () => {
    expect(isMutationPendingForSelectedRun({
      isPending: true,
      mutationRunId: "run-a",
      selectedRunId: null,
    })).toBe(false);
  });

  it("does not expose a pending direct-send worker after selection changes", () => {
    expect(resolvePendingConversationWorkerId({
      isPending: true,
      mutationRunId: "run-a",
      selectedRunId: "run-b",
      isImplementationConversation: false,
      selectedWorkerIds: ["run-b-worker-1"],
    })).toBeNull();

    expect(resolvePendingConversationWorkerId({
      isPending: true,
      mutationRunId: "run-a",
      selectedRunId: "run-a",
      isImplementationConversation: false,
      selectedWorkerIds: ["run-a-worker-1"],
    })).toBe("run-a-worker-1");
  });
});
