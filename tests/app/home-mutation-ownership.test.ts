import { describe, expect, test } from "vitest";
import {
  ownsConversationSideEffects,
  ownsOptimisticRunSelection,
  ownsSelectionFromMutationStart,
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
});
