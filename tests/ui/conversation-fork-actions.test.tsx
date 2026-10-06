import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeApiProvider, createDefaultWebRuntimeAPIs } from "@/runtime-api/provider";
import { useConversationActions, type UseConversationActionsParams } from "@/interface/home/useConversationActions";
import { gitWorkspaceManager } from "@/interface/home/GitWorkspaceManager";

function renderActions() {
  vi.stubGlobal("React", React);
  const mutate = vi.fn();
  const mutation = { mutate, isPending: false, error: null };
  const params: UseConversationActionsParams = {
    mutations: {
      renameRun: mutation, moveRunToProject: mutation, deleteRun: mutation,
      archiveRun: mutation, recoverRun: mutation, resumeRunRecovery: mutation,
      autoCommitChat: mutation, runPresetCommand: mutation,
      commitWorkflowSettings: mutation, cancelQueuedMessage: mutation,
    },
    selectedRunId: "source-run",
    currentProjectScope: "/project",
    explicitProjects: ["/project"],
    runs: [],
    latestUserCheckpoint: { id: "last-user-message", content: "old request" } as UseConversationActionsParams["latestUserCheckpoint"],
    apiKeys: {},
    commandInputRef: { current: null },
  };
  let actions!: ReturnType<typeof useConversationActions>;
  function Harness() {
    actions = useConversationActions(params);
    return null;
  }
  renderToStaticMarkup(<RuntimeApiProvider apis={createDefaultWebRuntimeAPIs()}><Harness /></RuntimeApiProvider>);
  return { actions, mutate };
}

afterEach(() => {
  gitWorkspaceManager.setKey("activeDialog", null);
  vi.unstubAllGlobals();
});

describe("conversation fork actions", () => {
  it("forks an assistant reply immediately without asking for a continuation", () => {
    const prompt = vi.fn(() => null);
    vi.stubGlobal("window", { prompt });
    const { actions, mutate } = renderActions();
    actions.handleForkMessage({ id: "assistant-reply", content: "answer" });
    expect(prompt).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledExactlyOnceWith({ runId: "source-run", action: "fork", targetMessageId: "assistant-reply" });
  });

  it("forks the whole session without replaying its last user message", () => {
    const { actions, mutate } = renderActions();
    actions.handleForkSession();
    expect(mutate).toHaveBeenCalledExactlyOnceWith({ runId: "source-run", action: "fork", targetMessageId: "" });
  });

  it("asks only for workspace configuration when forking into a worktree", () => {
    const prompt = vi.fn(() => null);
    vi.stubGlobal("window", { prompt });
    const { actions, mutate } = renderActions();
    actions.handleForkMessageIntoWorktree({ id: "assistant-reply", content: "answer" });
    expect(prompt).not.toHaveBeenCalled();
    expect(gitWorkspaceManager.getSnapshot().activeDialog).toEqual({ kind: "fork_message_worktree", projectPath: "/project", runId: "source-run", targetMessageId: "assistant-reply" });
    actions.handleForkSessionIntoWorktree();
    expect(gitWorkspaceManager.getSnapshot().activeDialog).toEqual({ kind: "fork_session_worktree", projectPath: "/project", runId: "source-run", targetMessageId: "" });
    actions.handleConfirmForkMessageIntoWorktree({ runId: "source-run", targetMessageId: "assistant-reply", mode: "new_worktree", projectPath: "/project", newBranchName: "fork", checkoutPath: "/fork", expectedHeadSha: null, expectedStatusFingerprint: "status" });
    expect(mutate.mock.calls[0]?.[0]).not.toHaveProperty("content");
  });
});
