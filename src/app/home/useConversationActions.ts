"use client";

import type React from "react";
import { useCallback } from "react";
import type { ProjectFileReference } from "@/lib/project-file-links";
import {
  GIT_AUTO_COMMIT_MILESTONES_SETTING,
  GIT_PUSH_ON_COMMIT_SETTING,
  parseBooleanSetting,
  serializeBooleanSetting,
  type ManualCommitAction,
} from "@/lib/commit-workflow";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { sideWindowManager } from "./SideWindowManager";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "./GitWorkspaceManager";
import { shouldOpenMobileSideWindow } from "./side-window-viewport";
import type { MessageRecord, RunRecord, SidebarRun } from "./types";
import { parseProjectList, reorderExplicitProjectPaths, type ProjectDropPlacement } from "./utils";

type MutationsRef = {
  renameRun: { mutate: (vars: { runId: string; title: string }) => void };
  moveRunToProject: { mutate: (vars: { runId: string; projectPath: string }) => void };
  deleteRun: { mutate: (vars: { runId: string }) => void };
  archiveRun: { mutate: (vars: { runId: string }) => void };
  recoverRun: {
    mutate: (vars: { runId: string; action: "retry" | "edit" | "fork"; targetMessageId: string; content?: string; gitWorkspaceLaunch?: GitWorkspaceLaunchRequest }, opts?: { onError?: (err: unknown) => void }) => void;
    isPending: boolean;
  };
  resumeRunRecovery: { mutate: (vars: { runId: string }) => void };
  autoCommitChat: { mutate: (vars: { runId: string; action: ManualCommitAction }) => void; isPending: boolean };
  autoCommitProject: { mutate: (vars: { projectPath: string; action: ManualCommitAction }) => void; isPending: boolean };
  commitWorkflowSettings: { mutate: (vars: { key: string; value: string }) => void; error: Error | null };
  cancelQueuedMessage: { mutate: (vars: { runId: string; messageId: string }) => void };
};

export interface UseConversationActionsParams {
  mutations: MutationsRef;
  selectedRunId: string | null;
  currentProjectScope: string | null;
  explicitProjects: string[];
  runs: RunRecord[];
  latestUserCheckpoint: MessageRecord | null;
  renamingRunId?: string | null;
  apiKeys: Record<string, string>;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useConversationActions({
  mutations,
  selectedRunId,
  currentProjectScope,
  explicitProjects,
  runs,
  latestUserCheckpoint,
  apiKeys,
  commandInputRef,
}: UseConversationActionsParams) {
  const {
    setSelectedRunId,
    setDraftProjectPath,
    setCommand,
    setCommandCursor,
    clearAttachments,
    setMobileNavOpen,
    setRenamingRunId,
    setRenameValue,
    setRenameSource,
    setMovingRunId,
    setMoveRunProjectPath,
    setEditingMessageId,
    setEditingMessageValue,
    setExpandedDirectMessageIds,
    setProjectExpanded,
    revealMoreProjectSessions,
    setRightSidebarOpen,
    setMobileWorkersOpen,
    setApiKeys,
    setSelectedConversationMode,
  } = homeUiSetters;

  const autoCommitMilestonesEnabled = parseBooleanSetting(apiKeys[GIT_AUTO_COMMIT_MILESTONES_SETTING], false);
  const pushOnCommitEnabled = parseBooleanSetting(apiKeys[GIT_PUSH_ON_COMMIT_SETTING], false);

  const handleStartNewPlan = () => {
    setSelectedRunId(null);
    setDraftProjectPath(currentProjectScope);
    setCommand("");
    clearAttachments();
    setSelectedConversationMode("direct");
    setMobileNavOpen(false);
  };

  const handleAddProject = (newPath: string) => {
    if (!explicitProjects.includes(newPath)) {
      const newProjects = [...explicitProjects, newPath];
      const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
      setApiKeys(updatedKeys);
      void fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedKeys),
      });
    }
  };

  const handleRemoveProject = (pathToRemove: string) => {
    const newProjects = explicitProjects.filter((p: string) => p !== pathToRemove);
    const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
    setApiKeys(updatedKeys);
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedKeys),
    });
  };

  const handleReorderProjects = (
    draggedPath: string,
    targetPath: string,
    placement: ProjectDropPlacement,
  ) => {
    const currentKeys = homeUiStateManager.getSnapshot().apiKeys;
    const currentProjects = parseProjectList(currentKeys.PROJECTS);
    const newProjects = reorderExplicitProjectPaths(currentProjects, {
      draggedPath,
      targetPath,
      placement,
    });
    if (newProjects === currentProjects) {
      return;
    }

    const updatedKeys = { ...currentKeys, PROJECTS: JSON.stringify(newProjects) };
    setApiKeys(updatedKeys);
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedKeys),
    });
  };

  const updateCommitWorkflowSetting = (key: string, value: boolean) => {
    mutations.commitWorkflowSettings.mutate({ key, value: serializeBooleanSetting(value) });
  };

  const handleManualCommitChat = (action: ManualCommitAction = pushOnCommitEnabled ? "commit-push" : "commit") => {
    if (!selectedRunId) return;
    mutations.autoCommitChat.mutate({ runId: selectedRunId, action });
  };

  const handleManualCommitProject = (projectPath: string, action: ManualCommitAction = "commit") => {
    mutations.autoCommitProject.mutate({ projectPath, action });
  };

  const beginConversationInProject = (projectPath: string) => {
    setSelectedRunId(null);
    setDraftProjectPath(projectPath);
    setCommand("");
    clearAttachments();
    setSelectedConversationMode("direct");
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(0, 0);
    });
  };

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setDraftProjectPath(null);
    setMobileNavOpen(false);
  };

  const handleStartRenamingRun = (run: SidebarRun) => {
    setRenamingRunId(run.id);
    setRenameValue(run.title);
    setRenameSource("sidebar");
  };

  const handleStartTopBarRenamingRun = (run: SidebarRun) => {
    setRenamingRunId(run.id);
    setRenameValue(run.title);
    setRenameSource("topbar");
  };

  const handleCancelRenamingRun = () => {
    setRenamingRunId(null);
    setRenameValue("");
    setRenameSource(null);
  };

  const handleCommitRenamingRun = (runId: string, currentRenameValue: string, state: { runs?: RunRecord[] }) => {
    const nextTitle = currentRenameValue.trim().replace(/\s+/g, " ");
    const existingRun = (state.runs || []).find((run: RunRecord) => run.id === runId);
    if (!nextTitle || nextTitle === (existingRun?.title || "New conversation")) {
      handleCancelRenamingRun();
      return;
    }

    mutations.renameRun.mutate({ runId, title: nextTitle });
  };

  const handleStartMovingRun = (run: SidebarRun) => {
    setMovingRunId(run.id);
    setMoveRunProjectPath("");
  };

  const handleCancelMovingRun = () => {
    setMovingRunId(null);
    setMoveRunProjectPath("");
  };

  const handleConfirmMoveRunToProject = () => {
    const snap = homeUiStateManager.getSnapshot();
    const runId = snap.movingRunId;
    const projectPath = snap.moveRunProjectPath.trim();
    if (!runId || !projectPath || !explicitProjects.includes(projectPath)) {
      return;
    }
    const existingRun = runs.find((run: RunRecord) => run.id === runId);
    if (existingRun?.projectPath === projectPath) {
      handleCancelMovingRun();
      return;
    }
    mutations.moveRunToProject.mutate({ runId, projectPath });
  };

  const handleDeleteRun = (run: SidebarRun) => {
    if (!window.confirm(`Delete "${run.title}"? This cannot be undone.`)) {
      return;
    }

    mutations.deleteRun.mutate({ runId: run.id });
  };

  const handleArchiveRun = (run: SidebarRun) => {
    mutations.archiveRun.mutate({ runId: run.id });
  };

  const handleRetryMessage = (messageId: string) => {
    if (!selectedRunId) return;
    mutations.recoverRun.mutate({ runId: selectedRunId, action: "retry", targetMessageId: messageId });
  };

  const handleResumeRunRecovery = () => {
    if (!selectedRunId) return;
    mutations.resumeRunRecovery.mutate({ runId: selectedRunId });
  };

  const handleStartEditingMessage = (message: Pick<MessageRecord, "id" | "content">) => {
    setEditingMessageId(message.id);
    setEditingMessageValue(message.content);
  };

  const handleCancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingMessageValue("");
  };

  const handleSaveEditedMessage = (messageId: string, editingMessageValue: string) => {
    if (!selectedRunId) return;
    const content = editingMessageValue.trim();
    if (!content) return;
    setEditingMessageId(null);
    setEditingMessageValue("");
    mutations.recoverRun.mutate(
      { runId: selectedRunId, action: "edit", targetMessageId: messageId, content },
      {
        onError: () => {
          setEditingMessageId(messageId);
          setEditingMessageValue(content);
        },
      },
    );
  };

  const handleForkMessage = (message: Pick<MessageRecord, "id" | "content">) => {
    if (!selectedRunId) return;
    const content = window.prompt("Fork with this prompt:", message.content)?.trim();
    if (!content) return;
    mutations.recoverRun.mutate({ runId: selectedRunId, action: "fork", targetMessageId: message.id, content });
  };

  const handleForkMessageIntoWorktree = (message: Pick<MessageRecord, "id" | "content">) => {
    if (!selectedRunId) return;
    const selectedRun = runs.find((run) => run.id === selectedRunId);
    const projectPath = selectedRun?.projectPath || currentProjectScope;
    if (!projectPath) return;
    gitWorkspaceManager.requestForkMessageWorktree(projectPath, selectedRunId, message.id, message.content);
  };

  const handleForkSessionIntoWorktree = () => {
    if (!selectedRunId || !latestUserCheckpoint) return;
    const selectedRun = runs.find((run) => run.id === selectedRunId);
    const projectPath = selectedRun?.projectPath || currentProjectScope;
    if (!projectPath) return;
    gitWorkspaceManager.requestForkSessionWorktree(projectPath, selectedRunId, latestUserCheckpoint.id, latestUserCheckpoint.content);
  };

  const handleForkSession = () => {
    if (!selectedRunId || !latestUserCheckpoint) return;
    mutations.recoverRun.mutate({
      runId: selectedRunId,
      action: "fork",
      targetMessageId: latestUserCheckpoint.id,
      content: latestUserCheckpoint.content,
    });
  };

  const handleConfirmForkMessageIntoWorktree = (request: GitWorkspaceLaunchRequest & {
    runId: string;
    targetMessageId: string;
    content: string;
  }) => {
    mutations.recoverRun.mutate({
      runId: request.runId,
      action: "fork",
      targetMessageId: request.targetMessageId,
      content: request.content,
      gitWorkspaceLaunch: request,
    });
    gitWorkspaceManager.setKey("activeDialog", null);
  };

  const handleEditQueuedMessage = (message: { id: string; runId: string; content: string }) => {
    const nextCommand = message.content;
    setCommand(nextCommand);
    setCommandCursor(nextCommand.length);
    clearAttachments();
    mutations.cancelQueuedMessage.mutate({ runId: message.runId, messageId: message.id });
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(nextCommand.length, nextCommand.length);
    });
  };

  const handleOpenProjectFile = useCallback((filePathOrReference: string | ProjectFileReference) => {
    const file = typeof filePathOrReference === "string"
      ? currentProjectScope
        ? { root: currentProjectScope, relativePath: filePathOrReference }
        : null
      : filePathOrReference;

    if (!file?.root || !file.relativePath) return;

    if (!sideWindowManager.openFile(file)) return;
    if (shouldOpenMobileSideWindow()) {
      setMobileWorkersOpen(true);
      return;
    }

    setRightSidebarOpen(true);
  }, [currentProjectScope, setMobileWorkersOpen, setRightSidebarOpen]);

  const handleProjectOpenChange = (projectPath: string, open: boolean) => {
    homeUiStateManager.resetProjectSessionDisplayLimit(projectPath);
    setProjectExpanded(projectPath, open);
  };

  const handleShowMoreProjectSessions = (projectPath: string) => {
    revealMoreProjectSessions(projectPath);
  };

  const toggleDirectMessageExpansion = (messageId: string) => {
    setExpandedDirectMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  return {
    autoCommitMilestonesEnabled,
    pushOnCommitEnabled,
    handleStartNewPlan,
    handleAddProject,
    handleRemoveProject,
    handleReorderProjects,
    updateCommitWorkflowSetting,
    handleManualCommitChat,
    handleManualCommitProject,
    beginConversationInProject,
    handleSelectRun,
    handleStartRenamingRun,
    handleStartTopBarRenamingRun,
    handleCancelRenamingRun,
    handleCommitRenamingRun,
    handleStartMovingRun,
    handleCancelMovingRun,
    handleConfirmMoveRunToProject,
    handleDeleteRun,
    handleArchiveRun,
    handleRetryMessage,
    handleResumeRunRecovery,
    handleStartEditingMessage,
    handleCancelEditingMessage,
    handleSaveEditedMessage,
    handleForkMessage,
    handleForkMessageIntoWorktree,
    handleForkSessionIntoWorktree,
    handleForkSession,
    handleConfirmForkMessageIntoWorktree,
    handleEditQueuedMessage,
    handleOpenProjectFile,
    handleProjectOpenChange,
    handleShowMoreProjectSessions,
    toggleDirectMessageExpansion,
  };
}
