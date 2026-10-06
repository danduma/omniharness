import { describe, expect, test } from "vitest";
import { INITIAL_EVENT_STREAM_STATE } from "@/interface/home/HomeUiStateManager";
import { restoreRunSlice } from "@/interface/home/utils";
import {
  ownsConversationSideEffects,
  ownsOptimisticRunSelection,
  ownsSelectionFromMutationStart,
  mergeLoadedWorkerHistoryAgent,
  shouldSelectProjectMutationResult,
  shouldSelectSourceRunMutationResult,
  shouldRestoreSelectionAfterOptimisticRemovalError,
  shouldClearSubmittedComposer,
  resolveQueuedMessageRowAfterSend,
} from "@/interface/home/useHomeMutations";

describe("home mutation ownership guards", () => {
  test("keeps create-run success handlers scoped to their optimistic run", () => {
    expect(ownsOptimisticRunSelection({
      requestedRunId: "run-new",
      currentSelectedRunId: "run-new",
    })).toBe(true);

    expect(ownsOptimisticRunSelection({
      requestedRunId: "run-new",
      currentSelectedRunId: "run-other",
    })).toBe(false);
  });

  test("prevents mutation success navigation after the user selects another conversation", () => {
    expect(ownsSelectionFromMutationStart({
      selectedRunIdAtStart: "run-a",
      currentSelectedRunId: "run-a",
    })).toBe(true);

    expect(ownsSelectionFromMutationStart({
      selectedRunIdAtStart: "run-a",
      currentSelectedRunId: "run-b",
    })).toBe(false);
  });

  test("allows project-created conversations to select only when the original selection is unchanged", () => {
    expect(shouldSelectProjectMutationResult({
      selectedRunIdAtStart: null,
      currentSelectedRunId: null,
      resultRunId: "commit-run",
    })).toBe(true);

    expect(shouldSelectProjectMutationResult({
      selectedRunIdAtStart: "run-a",
      currentSelectedRunId: "run-a",
      resultRunId: "commit-run",
    })).toBe(true);

    expect(shouldSelectProjectMutationResult({
      selectedRunIdAtStart: null,
      currentSelectedRunId: "run-b",
      resultRunId: "commit-run",
    })).toBe(false);

    expect(shouldSelectProjectMutationResult({
      selectedRunIdAtStart: "run-a",
      currentSelectedRunId: "run-b",
      resultRunId: "commit-run",
    })).toBe(false);
  });

  test("requires source-run ownership before a promotion result can navigate", () => {
    expect(shouldSelectSourceRunMutationResult({
      sourceRunId: "planning-run",
      selectedRunIdAtStart: "planning-run",
      currentSelectedRunId: "planning-run",
      resultRunId: "implementation-run",
    })).toBe(true);

    expect(shouldSelectSourceRunMutationResult({
      sourceRunId: "planning-run",
      selectedRunIdAtStart: null,
      currentSelectedRunId: "planning-run",
      resultRunId: "implementation-run",
    })).toBe(false);

    expect(shouldSelectSourceRunMutationResult({
      sourceRunId: "planning-run",
      selectedRunIdAtStart: "planning-run",
      currentSelectedRunId: "other-run",
      resultRunId: "implementation-run",
    })).toBe(false);
  });

  test("restores removed selection only while the optimistic removal still owns it", () => {
    expect(shouldRestoreSelectionAfterOptimisticRemovalError({
      removedRunId: "run-a",
      selectedRunIdAtStart: "run-a",
      currentSelectedRunId: null,
    })).toBe(true);

    expect(shouldRestoreSelectionAfterOptimisticRemovalError({
      removedRunId: "run-a",
      selectedRunIdAtStart: "run-a",
      currentSelectedRunId: "run-b",
    })).toBe(false);

    expect(shouldRestoreSelectionAfterOptimisticRemovalError({
      removedRunId: "run-a",
      selectedRunIdAtStart: "run-b",
      currentSelectedRunId: "run-b",
    })).toBe(false);
  });

  test("restores only the failed removal's run slice and preserves newer unrelated state", () => {
    const captured = {
      ...INITIAL_EVENT_STREAM_STATE,
      runs: [
        { id: "run-a", planId: "plan-a", status: "done", projectPath: null, title: "A", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "run-b", planId: "plan-b", status: "done", projectPath: null, title: "B before", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      plans: [
        { id: "plan-a", path: "/workspace/a", status: "done", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "plan-b", path: "/workspace/b", status: "done", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    };
    const current = {
      ...captured,
      runs: [{ ...captured.runs[1]!, title: "B after" }],
      frontendErrors: [{ message: "newer unrelated state" }],
    };

    const restored = restoreRunSlice(current, captured, "run-a");

    expect(restored.runs.find((run) => run.id === "run-a")?.title).toBe("A");
    expect(restored.runs.find((run) => run.id === "run-b")?.title).toBe("B after");
    expect(restored.frontendErrors).toEqual([{ message: "newer unrelated state" }]);
  });

  test("keeps message-send side effects scoped to the submitted conversation", () => {
    expect(ownsConversationSideEffects({
      runId: "run-a",
      currentSelectedRunId: "run-a",
    })).toBe(true);

    expect(ownsConversationSideEffects({
      runId: "run-a",
      currentSelectedRunId: "run-b",
    })).toBe(false);
  });

  test("does not clear a newer composer draft when an older send resolves", () => {
    const attachments: never[] = [];

    expect(shouldClearSubmittedComposer({
      submittedContent: "first",
      commandAtStart: "first",
      currentCommand: "first",
      attachmentsAtStart: attachments,
      currentAttachments: attachments,
    })).toBe(true);

    expect(shouldClearSubmittedComposer({
      submittedContent: "first",
      commandAtStart: "first",
      currentCommand: "second",
      attachmentsAtStart: attachments,
      currentAttachments: attachments,
    })).toBe(false);

    expect(shouldClearSubmittedComposer({
      submittedContent: "first",
      commandAtStart: "first",
      currentCommand: "first",
      attachmentsAtStart: attachments,
      currentAttachments: [],
    })).toBe(false);
  });

  test("merges loaded worker history without erasing newer live agent state", () => {
    const merged = mergeLoadedWorkerHistoryAgent({
      name: "worker-1",
      type: "codex",
      state: "working",
      currentText: "new live output",
      lastText: "latest durable text",
      updatedAt: "2026-05-20T10:00:02.000Z",
      outputEntries: [{
        id: "entry-live",
        type: "message",
        text: "new live entry",
        timestamp: "2026-05-20T10:00:02.000Z",
      }],
    }, {
      name: "worker-1",
      type: "codex",
      state: "idle",
      currentText: "",
      lastText: "older text",
      updatedAt: "2026-05-20T10:00:01.000Z",
      outputEntries: [{
        id: "entry-history",
        type: "message",
        text: "older history entry",
        timestamp: "2026-05-20T10:00:01.000Z",
      }],
    });

    expect(merged).toMatchObject({
      name: "worker-1",
      state: "working",
      currentText: "new live output",
      lastText: "latest durable text",
    });
    expect(merged.outputEntries?.map((entry) => entry.id)).toEqual(["entry-history", "entry-live"]);
  });
});

describe("queued message row ownership after a send settles", () => {
  test("hides the queue row when the server also delivered a transcript message", () => {
    // Both surfaces would otherwise render the same text: the message row in
    // the transcript and the queue row it was released from in the drawer.
    expect(resolveQueuedMessageRowAfterSend({
      message: { id: "message-1" },
      queuedMessage: { id: "message-1" },
    })).toBe("hide");
  });

  // The old guard was `busyAction === "steer" && data.message`, so a stale-idle
  // prediction — which sends no busyAction at all — fell to the else branch and
  // left both the transcript bubble and the drawer row rendering. busyAction is
  // deliberately not a parameter here: the delivered message row decides.

  test("keeps the queue row when the message was queued rather than delivered", () => {
    expect(resolveQueuedMessageRowAfterSend({
      queuedMessage: { id: "message-1" },
    })).toBe("upsert");
  });

  test("does nothing when the server returned no queue row", () => {
    expect(resolveQueuedMessageRowAfterSend({
      message: { id: "message-1" },
    })).toBe("none");
    expect(resolveQueuedMessageRowAfterSend({})).toBe("none");
  });
});
