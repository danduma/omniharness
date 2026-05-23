import { describe, expect, test } from "vitest";
import {
  ownsConversationSideEffects,
  ownsOptimisticRunSelection,
  ownsSelectionFromMutationStart,
  mergeLoadedWorkerHistoryAgent,
  shouldSelectProjectMutationResult,
  shouldSelectSourceRunMutationResult,
  shouldRestoreSelectionAfterOptimisticRemovalError,
  shouldClearSubmittedComposer,
} from "@/app/home/useHomeMutations";

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
