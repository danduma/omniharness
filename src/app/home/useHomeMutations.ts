"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { ChatAttachment } from "@/lib/chat-attachments";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { mergeAppErrors, requestJson } from "@/lib/app-errors";
import { getManualCommitPrompt, getManualProjectCommitPrompt, type ManualCommitAction } from "@/lib/commit-workflow";
import { applyRunRecoveryOptimisticUpdate, type RecoverableConversationState } from "@/lib/run-recovery-state";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { appearancePreferencesManager } from "./AppearancePreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import type { BusyMessageAction } from "./busy-message-behavior";
import {
  appendCreatedConversationSnapshot,
  appendSentConversationMessageSnapshot,
  buildInlineError,
  removeRunFromHomeState,
  resolveSelectedWorkerModel,
  type CreatedConversationSnapshot,
} from "./utils";
import type {
  AgentSnapshot,
  ComposerWorkerOption,
  ConversationModeOption,
  EventStreamState,
  MessageRecord,
  RunRecord,
} from "./types";

async function uploadPendingChatAttachments(attachments: PendingChatAttachment[]): Promise<ChatAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const formData = new FormData();
  attachments.forEach((attachment) => formData.append("files", attachment.file, attachment.name));
  const response = await requestJson<{ ok: true; attachments: ChatAttachment[] }>("/api/attachments", {
    method: "POST",
    body: formData,
  }, {
    source: "Attachments",
    action: "Upload attachments",
  });

  return response.attachments;
}

export interface UseHomeMutationsParams {
  state: EventStreamState;
  setState: React.Dispatch<React.SetStateAction<EventStreamState>>;
  selectedRunId: string | null;
  selectedCliAgent: ComposerWorkerOption;
  selectedConversationMode: ConversationModeOption;
  selectedModel: string;
  selectedEffort: string;
  autoSelectedWorkerType: string | null;
  activeAllowedWorkerTypes: string[];
  currentProjectScope: string | null;
  renamingRunId: string | null;
  pendingDeletedRunIdsRef: React.MutableRefObject<Set<string>>;
  pendingCreatedConversationSnapshotsRef: React.MutableRefObject<Map<string, CreatedConversationSnapshot>>;
  pendingSentConversationMessagesRef: React.MutableRefObject<Map<string, MessageRecord>>;
  loadingWorkerHistoryIdsRef: React.MutableRefObject<Set<string>>;
  scrollConversationToBottom: () => void;
  sessionQueryRefetch: () => Promise<unknown>;
}

export function useHomeMutations({
  state,
  setState,
  selectedRunId,
  selectedCliAgent,
  selectedConversationMode,
  selectedModel,
  selectedEffort,
  autoSelectedWorkerType,
  activeAllowedWorkerTypes,
  currentProjectScope,
  renamingRunId,
  pendingDeletedRunIdsRef,
  pendingCreatedConversationSnapshotsRef,
  pendingSentConversationMessagesRef,
  loadingWorkerHistoryIdsRef,
  scrollConversationToBottom,
  sessionQueryRefetch,
}: UseHomeMutationsParams) {
  const {
    setCommand,
    setAuthError,
    setRuntimeErrors,
    setPairRedeemError,
    setRenamingRunId,
    setRenameValue,
    setRenameSource,
    setEditingMessageId,
    setEditingMessageValue,
    setSelectedRunId,
    setApiKeys,
    setShowSettings,
    setMobileNavOpen,
    clearAttachments,
  } = homeUiSetters;

  const loginMutation = useMutation({
    mutationFn: async (password: string) => requestJson<{ ok: true }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, label: "Browser session" }),
    }, {
      source: "Auth",
      action: "Log in",
    }),
    onSuccess: async () => {
      setAuthError(null);
      await sessionQueryRefetch();
    },
    onError: (error) => {
      setAuthError(error instanceof Error ? error.message : String(error));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => requestJson<{ ok: true }>("/api/auth/logout", {
      method: "POST",
    }, {
      source: "Auth",
      action: "Log out",
    }),
    onSuccess: () => {
      window.location.replace("/");
    },
    onError: (error) => {
      setRuntimeErrors((current) => mergeAppErrors(current, [
        buildInlineError(error, { source: "Auth", action: "Log out" }),
      ]));
    },
  });

  const redeemPairMutation = useMutation({
    mutationFn: async (pairToken: string) => requestJson<{ ok: true; targetPath: string }>("/api/auth/pair/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairToken }),
    }, {
      source: "Auth",
      action: "Redeem pairing token",
    }),
    onSuccess: (payload) => {
      setPairRedeemError(null);
      window.location.replace(payload.targetPath || "/");
    },
    onError: (error) => {
      setPairRedeemError(error instanceof Error ? error.message : String(error));
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const payload = settingsDraftManager.getSavePayload();
      await requestJson<{ ok: true }>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, {
        source: "Settings",
        action: "Save settings",
      });
    },
    onSuccess: () => {
      const savedSettings = settingsDraftManager.getSnapshot().draft;
      appearancePreferencesManager.saveDraft();
      settingsDraftManager.markSaved(savedSettings);
      setApiKeys((current) => ({ ...current, ...savedSettings }));
      setShowSettings(false);
    },
  });

  const commitWorkflowSettings = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await requestJson<{ ok: true }>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }, {
        source: "Settings",
        action: "Save commit workflow settings",
      });
      return { key, value };
    },
    onMutate: ({ key, value }) => {
      const previousValue = homeUiStateManager.getSnapshot().apiKeys[key] ?? "";
      setApiKeys((current) => ({ ...current, [key]: value }));
      settingsDraftManager.setField(key, value);
      return { key, previousValue };
    },
    onSuccess: ({ key, value }) => {
      settingsDraftManager.markFieldsSaved({ [key]: value });
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      setApiKeys((current) => ({ ...current, [context.key]: context.previousValue }));
      settingsDraftManager.setField(context.key, context.previousValue);
    },
  });

  const renameRun = useMutation({
    mutationFn: async ({ runId, title }: { runId: string; title: string }) => requestJson(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }, {
      source: "Runs",
      action: "Rename",
    }),
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).map((run: RunRecord) =>
          run.id === variables.runId ? { ...run, title: variables.title } : run,
        ),
      }));
      setRenamingRunId(null);
      setRenameValue("");
      setRenameSource(null);
    },
  });

  const deleteRun = useMutation({
    onMutate: (variables: { runId: string }) => {
      const snap = homeUiStateManager.getSnapshot();
      const previousState = state;
      const previousSelectedRunId = selectedRunId;
      const previousRenamingRunId = renamingRunId;
      const previousRenameValue = snap.renameValue;
      const previousRenameSource = snap.renameSource;
      const previousPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.get(variables.runId);
      const hadPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.has(variables.runId);

      pendingDeletedRunIdsRef.current.add(variables.runId);
      pendingCreatedConversationSnapshotsRef.current.delete(variables.runId);
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));

      if (selectedRunId === variables.runId) setSelectedRunId(null);
      if (renamingRunId === variables.runId) {
        setRenamingRunId(null);
        setRenameValue("");
        setRenameSource(null);
      }

      return {
        previousState,
        previousSelectedRunId,
        previousRenamingRunId,
        previousRenameValue,
        previousRenameSource,
        previousPendingCreatedSnapshot,
        hadPendingCreatedSnapshot,
      };
    },
    mutationFn: async ({ runId }: { runId: string }) => requestJson(`/api/runs/${runId}`, {
      method: "DELETE",
    }, {
      source: "Runs",
      action: "Delete",
    }),
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));
    },
    onError: (_error, variables, context) => {
      if (!context) return;
      pendingDeletedRunIdsRef.current.delete(variables.runId);
      if (context.hadPendingCreatedSnapshot && context.previousPendingCreatedSnapshot) {
        pendingCreatedConversationSnapshotsRef.current.set(variables.runId, context.previousPendingCreatedSnapshot);
      }
      setState(context.previousState);
      setSelectedRunId(context.previousSelectedRunId);
      setRenamingRunId(context.previousRenamingRunId);
      setRenameValue(context.previousRenameValue);
      setRenameSource(context.previousRenameSource);
    },
  });

  const archiveRun = useMutation({
    onMutate: (variables: { runId: string }) => {
      const snap = homeUiStateManager.getSnapshot();
      const previousState = state;
      const previousSelectedRunId = selectedRunId;
      const previousRenamingRunId = renamingRunId;
      const previousRenameValue = snap.renameValue;
      const previousRenameSource = snap.renameSource;
      const previousPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.get(variables.runId);
      const hadPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.has(variables.runId);

      pendingDeletedRunIdsRef.current.add(variables.runId);
      pendingCreatedConversationSnapshotsRef.current.delete(variables.runId);
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));

      if (selectedRunId === variables.runId) setSelectedRunId(null);
      if (renamingRunId === variables.runId) {
        setRenamingRunId(null);
        setRenameValue("");
        setRenameSource(null);
      }

      return {
        previousState,
        previousSelectedRunId,
        previousRenamingRunId,
        previousRenameValue,
        previousRenameSource,
        previousPendingCreatedSnapshot,
        hadPendingCreatedSnapshot,
      };
    },
    mutationFn: async ({ runId }: { runId: string }) => requestJson(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    }, {
      source: "Runs",
      action: "Archive",
    }),
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));
    },
    onError: (_error, variables, context) => {
      pendingDeletedRunIdsRef.current.delete(variables.runId);
      if (!context) return;
      if (context.hadPendingCreatedSnapshot && context.previousPendingCreatedSnapshot) {
        pendingCreatedConversationSnapshotsRef.current.set(variables.runId, context.previousPendingCreatedSnapshot);
      }
      setState(context.previousState);
      setSelectedRunId(context.previousSelectedRunId);
      setRenamingRunId(context.previousRenamingRunId);
      setRenameValue(context.previousRenameValue);
      setRenameSource(context.previousRenameSource);
    },
  });

  const recoverRun = useMutation({
    mutationFn: async ({ runId, action, targetMessageId, content }: {
      runId: string;
      action: "retry" | "edit" | "fork";
      targetMessageId: string;
      content?: string;
    }) => requestJson<{ runId?: string }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetMessageId, content }),
    }, {
      source: "Runs",
      action: "Recover conversation",
    }),
    onMutate: async (variables) => {
      const previousState = state;
      if (variables.action !== "fork") {
        setState((current) => applyRunRecoveryOptimisticUpdate(
          current as RecoverableConversationState,
          variables,
        ) as typeof current);
      }

      return { previousState };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousState) setState(context.previousState);
    },
    onSuccess: (data) => {
      if (data.runId) setSelectedRunId(data.runId);
      setEditingMessageId(null);
      setEditingMessageValue("");
    },
  });

  const resumeRunRecovery = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => requestJson<{ ok: true; runId: string; recovery?: unknown }>(`/api/runs/${runId}/resume`, {
      method: "POST",
    }, {
      source: "Runs",
      action: "Resume run",
    }),
  });

  const runCommand = useMutation({
    mutationFn: async (payload: { content: string; attachments: PendingChatAttachment[] }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      const uploadedAttachments = await uploadPendingChatAttachments(payload.attachments);
      return requestJson<{ runId?: string } & CreatedConversationSnapshot>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedConversationMode,
          command: payload.content,
          projectPath: currentProjectScope,
          preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent,
          preferredWorkerModel: resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent],
          attachments: uploadedAttachments,
        }),
      }, {
        source: "Supervisor",
        action: "Start a run",
      });
    },
    onSuccess: (data) => {
      setCommand("");
      clearAttachments();
      if (data.runId) {
        if (data.run) {
          pendingCreatedConversationSnapshotsRef.current.set(data.runId, {
            plan: data.plan,
            run: data.run,
            message: data.message,
          });
          setState((current) => appendCreatedConversationSnapshot(current, data));
        }
        setSelectedRunId(data.runId);
      }
    },
  });

  const sendConversationMessage = useMutation({
    mutationFn: async (payload: {
      runId: string;
      content: string;
      attachments: PendingChatAttachment[];
      busyAction?: BusyMessageAction;
    }) => {
      const uploadedAttachments = await uploadPendingChatAttachments(payload.attachments);
      return requestJson<{
        ok: true;
        message?: MessageRecord;
        queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
      }>(`/api/conversations/${payload.runId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: payload.content,
          attachments: uploadedAttachments,
          busyAction: payload.busyAction,
        }),
      }, {
        source: "Conversations",
        action: "Send a conversation message",
      });
    },
    onSuccess: (data) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
      }
      if (data.queuedMessage) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
      }
      setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      setCommand("");
      clearAttachments();
      scrollConversationToBottom();
    },
  });

  const cancelQueuedMessage = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<{ ok: true }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
      method: "DELETE",
    }, {
      source: "Conversations",
      action: "Cancel queued message",
    }),
    onMutate: ({ messageId }) => {
      busyMessageQueueManager.markCancelling(messageId);
    },
    onSuccess: (_data, variables) => {
      busyMessageQueueManager.hideQueuedMessage(variables.messageId);
    },
    onError: (_error, variables) => {
      busyMessageQueueManager.unmarkCancelling(variables.messageId);
    },
  });

  const sendQueuedMessageNow = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<{
      ok: true;
      message?: MessageRecord;
      queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
    }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
      method: "PATCH",
    }, {
      source: "Conversations",
      action: "Send queued message now",
    }),
    onMutate: ({ messageId }) => {
      busyMessageQueueManager.markCancelling(messageId);
    },
    onSuccess: (data, variables) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
        setState((current) => appendSentConversationMessageSnapshot(current, data.message));
        scrollConversationToBottom();
      }

      if (data.queuedMessage && (data.queuedMessage.status === "pending" || data.queuedMessage.status === "delivering")) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
        busyMessageQueueManager.unmarkCancelling(variables.messageId);
        return;
      }

      busyMessageQueueManager.hideQueuedMessage(variables.messageId);
    },
    onError: (_error, variables) => {
      busyMessageQueueManager.unmarkCancelling(variables.messageId);
    },
  });

  const autoCommitChat = useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: ManualCommitAction }) => requestJson<{ ok: true; message?: MessageRecord }>(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: getManualCommitPrompt(action) }),
    }, {
      source: "Conversations",
      action: "Commit chat",
    }),
    onSuccess: (data) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
      }
      setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      scrollConversationToBottom();
    },
  });

  const autoCommitProject = useMutation({
    mutationFn: async (payload: { projectPath: string; action: ManualCommitAction }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      return requestJson<{ runId?: string } & CreatedConversationSnapshot>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "direct",
          command: getManualProjectCommitPrompt(payload.action),
          projectPath: payload.projectPath,
          preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent,
          preferredWorkerModel: resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent],
        }),
      }, {
        source: "Conversations",
        action: "Commit project",
      });
    },
    onSuccess: (data) => {
      setCommand("");
      clearAttachments();
      setMobileNavOpen(false);
      if (data.runId) {
        if (data.run) {
          pendingCreatedConversationSnapshotsRef.current.set(data.runId, {
            plan: data.plan,
            run: data.run,
            message: data.message,
          });
          setState((current) => appendCreatedConversationSnapshot(current, data));
        }
        setSelectedRunId(data.runId);
      }
    },
  });

  const stopSupervisor = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop_supervisor" }),
    }, {
      source: "Runs",
      action: "Stop supervisor",
    }),
  });

  const stopWorker = useMutation({
    mutationFn: async ({ runId, workerId }: { runId: string; workerId: string }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop_worker", workerId }),
    }, {
      source: "Runs",
      action: "Stop worker",
    }),
  });

  const stopWorkerTerminalProcess = useMutation({
    mutationFn: async ({ runId, workerId, terminalProcess }: {
      runId: string;
      workerId: string;
      terminalProcess: WorkerTerminalProcess;
    }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "stop_worker_terminal",
        workerId,
        terminalProcessId: terminalProcess.id,
        processId: terminalProcess.processId,
      }),
    }, {
      source: "Runs",
      action: "Stop worker terminal",
    }),
  });

  const promotePlanningConversation = useMutation({
    mutationFn: async (payload: { runId: string; planPath: string | null }) => requestJson<{ runId?: string }>(`/api/planning/${payload.runId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planPath: payload.planPath }),
    }, {
      source: "Planning",
      action: "Promote planning conversation",
    }),
    onSuccess: (data) => {
      if (data.runId) setSelectedRunId(data.runId);
    },
  });

  const handleLoadWorkerHistory = async (workerId: string) => {
    const normalizedWorkerId = workerId.trim();
    if (!normalizedWorkerId || loadingWorkerHistoryIdsRef.current.has(normalizedWorkerId)) {
      return;
    }

    loadingWorkerHistoryIdsRef.current.add(normalizedWorkerId);
    try {
      const agent = await requestJson<AgentSnapshot>(
        `/api/agents/${encodeURIComponent(normalizedWorkerId)}?history=full`,
        undefined,
        {
          source: "Agent runtime",
          action: "Load worker history",
        },
      );

      setState((current: typeof state) => {
        const agentsByName = new Map(
          (current.agents || []).map((candidate: AgentSnapshot) => [candidate.name, candidate]),
        );
        agentsByName.set(agent.name, agent);
        return { ...current, agents: Array.from(agentsByName.values()) };
      });
    } catch (error) {
      setRuntimeErrors((current) => mergeAppErrors(current, [
        buildInlineError(error, {
          source: "Agent runtime",
          action: "Load worker history",
          suggestion: "The live stream can continue, but older worker output could not be hydrated. Try again after the agent runtime responds.",
        }),
      ]));
    } finally {
      loadingWorkerHistoryIdsRef.current.delete(normalizedWorkerId);
    }
  };

  return {
    loginMutation,
    logoutMutation,
    redeemPairMutation,
    saveSettings,
    commitWorkflowSettings,
    renameRun,
    deleteRun,
    archiveRun,
    recoverRun,
    resumeRunRecovery,
    runCommand,
    sendConversationMessage,
    cancelQueuedMessage,
    sendQueuedMessageNow,
    autoCommitChat,
    autoCommitProject,
    stopSupervisor,
    stopWorker,
    stopWorkerTerminalProcess,
    promotePlanningConversation,
    handleLoadWorkerHistory,
  };
}
