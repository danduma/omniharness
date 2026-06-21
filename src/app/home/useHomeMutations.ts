"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { mergeAppErrors, requestJson } from "@/lib/app-errors";
import { getManualCommitPrompt, getManualProjectCommitPrompt, type ManualCommitAction } from "@/lib/commit-workflow";
import { applyRunRecoveryOptimisticUpdate, type RecoverableConversationState } from "@/lib/run-recovery-state";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { useQueuedMessageMutations } from "./useQueuedMessageMutations";
import { uploadPendingChatAttachments } from "./upload-attachments";
import { shouldSelectRecoveredRunAfterSuccess } from "./auto-resume-selection";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { appearancePreferencesManager } from "./AppearancePreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "./GitWorkspaceManager";
import type { BusyMessageAction } from "./busy-message-behavior";
import type { PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
import {
  appendCreatedConversationSnapshot,
  appendSentConversationMessageSnapshot,
  buildOptimisticCreatedConversationSnapshot,
  buildConversationPath,
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
  ExecutionEventRecord,
  MessageRecord,
  RunRecord,
  WorkerType,
} from "./types";

function isOptimisticallyStoppableWorkerStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "starting" || normalized === "working" || normalized === "idle" || normalized === "stuck" || normalized === "recovering";
}

function createOptimisticExecutionEvent(args: {
  runId: string;
  workerId?: string | null;
  eventType: string;
  details: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `optimistic-${now}-${Math.random().toString(16).slice(2)}`,
    runId: args.runId,
    workerId: args.workerId ?? null,
    planItemId: null,
    eventType: args.eventType,
    details: JSON.stringify(args.details),
    createdAt: now,
  } satisfies ExecutionEventRecord;
}

function replaceBrowserConversationPath(selectedRunId: string | null, draftProjectPath: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = buildConversationPath(selectedRunId, draftProjectPath);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== nextPath) {
    window.history.replaceState(window.history.state, "", nextPath);
  }
}

export function ownsOptimisticRunSelection(args: {
  requestedRunId: string;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.requestedRunId;
}

export function ownsSelectionFromMutationStart(args: {
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.selectedRunIdAtStart;
}

export function shouldSelectProjectMutationResult(args: {
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
  resultRunId: string | null | undefined;
}) {
  return Boolean(args.resultRunId) && ownsSelectionFromMutationStart(args);
}

export function shouldSelectSourceRunMutationResult(args: {
  sourceRunId: string;
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
  resultRunId: string | null | undefined;
}) {
  return Boolean(args.resultRunId)
    && args.selectedRunIdAtStart === args.sourceRunId
    && args.currentSelectedRunId === args.sourceRunId;
}

export function shouldRestoreSelectionAfterOptimisticRemovalError(args: {
  removedRunId: string;
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
}) {
  return args.selectedRunIdAtStart === args.removedRunId
    && args.currentSelectedRunId === null;
}

export function ownsConversationSideEffects(args: {
  runId: string;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.runId;
}

export function shouldClearSubmittedComposer(args: {
  submittedContent: string;
  commandAtStart: string;
  currentCommand: string;
  attachmentsAtStart: PendingChatAttachment[];
  currentAttachments: PendingChatAttachment[];
}) {
  return args.commandAtStart === args.submittedContent
    && args.currentCommand === args.submittedContent
    && args.currentAttachments === args.attachmentsAtStart;
}

function timestampMs(value: string | undefined | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function mergeOutputEntries(
  current: AgentSnapshot["outputEntries"],
  loaded: AgentSnapshot["outputEntries"],
) {
  const byId = new Map<string, NonNullable<AgentSnapshot["outputEntries"]>[number]>();
  for (const entry of loaded ?? []) {
    byId.set(entry.id, entry);
  }
  for (const entry of current ?? []) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values()).sort((first, second) => {
    const timeDelta = timestampMs(first.timestamp) - timestampMs(second.timestamp);
    return timeDelta !== 0 ? timeDelta : first.id.localeCompare(second.id);
  });
}

export function mergeLoadedWorkerHistoryAgent(
  current: AgentSnapshot | undefined,
  loaded: AgentSnapshot,
): AgentSnapshot {
  if (!current) {
    return loaded;
  }

  const currentIsNewer = timestampMs(current.updatedAt) > timestampMs(loaded.updatedAt);
  const outputEntries = mergeOutputEntries(current.outputEntries, loaded.outputEntries);
  if (!currentIsNewer) {
    return {
      ...loaded,
      outputEntries,
    };
  }

  return {
    ...loaded,
    state: current.state,
    currentText: current.currentText,
    lastText: current.lastText,
    displayText: current.displayText,
    lastError: current.lastError,
    recentStderr: current.recentStderr,
    pendingPermissions: current.pendingPermissions,
    pendingElicitations: current.pendingElicitations,
    contextUsage: current.contextUsage,
    bridgeLastError: current.bridgeLastError,
    runLastError: current.runLastError,
    stderrBuffer: current.stderrBuffer,
    stopReason: current.stopReason,
    bridgeMissing: current.bridgeMissing,
    updatedAt: current.updatedAt,
    outputEntries,
  };
}

function applyStopWorkerOptimisticUpdate(current: EventStreamState, runId: string, workerId: string) {
  const now = new Date().toISOString();
  const run = current.runs.find((candidate) => candidate.id === runId) ?? null;
  // Only a supervised run cascades a stop across its workers; an Omni run still
  // in its planning phase has a single planner worker like a direct run.
  const isImplementationRun = run?.mode === "implementation" && run?.phase !== "planning";
  const stoppedWorkerIds = new Set<string>();

  const workers = (current.workers || []).map((worker) => {
    if (worker.runId !== runId) {
      return worker;
    }
    if (worker.id === workerId || (isImplementationRun && isOptimisticallyStoppableWorkerStatus(worker.status))) {
      stoppedWorkerIds.add(worker.id);
      return { ...worker, status: "cancelled", updatedAt: now };
    }
    return worker;
  });

  const hasActiveWorker = workers.some((worker) =>
    worker.runId === runId && isOptimisticallyStoppableWorkerStatus(worker.status),
  );
  const nextRunStatus = isImplementationRun
    ? "awaiting_user"
    : hasActiveWorker
      ? run?.status
      : "cancelled";

  return {
    ...current,
    runs: (current.runs || []).map((candidate) =>
      candidate.id === runId && nextRunStatus
        ? { ...candidate, status: nextRunStatus, updatedAt: now, failedAt: null, lastError: null }
        : candidate,
    ),
    workers,
    agents: (current.agents || []).map((agent) =>
      stoppedWorkerIds.has(agent.name)
        ? { ...agent, state: "cancelled", currentText: "", updatedAt: now }
        : agent,
    ),
    executionEvents: [
      createOptimisticExecutionEvent({
        runId,
        workerId,
        eventType: isImplementationRun ? "worker_stop_requested" : "worker_cancelled",
        details: {
          summary: isImplementationRun
            ? `Paused work because ${workerId} was stopped by the user.`
            : `Stopped ${workerId}`,
          reason: isImplementationRun ? "User stopped a worker." : "User stopped this worker.",
          userInitiated: true,
          stoppedWorkerId: workerId,
          optimistic: true,
        },
      }),
      ...(current.executionEvents || []),
    ],
  };
}

function applyStopSupervisorOptimisticUpdate(current: EventStreamState, runId: string) {
  const now = new Date().toISOString();
  const stoppedWorkerIds = new Set<string>();
  const workers = (current.workers || []).map((worker) => {
    if (worker.runId !== runId || !isOptimisticallyStoppableWorkerStatus(worker.status)) {
      return worker;
    }
    stoppedWorkerIds.add(worker.id);
    return { ...worker, status: "cancelled", updatedAt: now };
  });

  return {
    ...current,
    runs: (current.runs || []).map((run) =>
      run.id === runId
        ? { ...run, status: "cancelled", updatedAt: now, failedAt: null, lastError: null }
        : run,
    ),
    workers,
    agents: (current.agents || []).map((agent) =>
      stoppedWorkerIds.has(agent.name)
        ? { ...agent, state: "cancelled", currentText: "", updatedAt: now }
        : agent,
    ),
    executionEvents: [
      createOptimisticExecutionEvent({
        runId,
        eventType: "supervisor_stopped",
        details: {
          summary: "Stopped supervisor and cancelled active workers.",
          reason: "User stopped the supervisor.",
          userInitiated: true,
          optimistic: true,
        },
      }),
      ...(current.executionEvents || []),
    ],
  };
}

function applyElicitationOptimisticUpdate(current: EventStreamState, workerId: string, requestId: number) {
  return {
    ...current,
    agents: (current.agents || []).map((agent) =>
      agent.name === workerId
        ? {
            ...agent,
            pendingElicitations: (agent.pendingElicitations || []).filter((elicitation) => elicitation.requestId !== requestId),
          }
        : agent,
    ),
  };
}

function applyPermissionOptimisticUpdate(current: EventStreamState, workerId: string, requestId: number) {
  return {
    ...current,
    agents: (current.agents || []).map((agent) =>
      agent.name === workerId
        ? {
            ...agent,
            pendingPermissions: (agent.pendingPermissions || []).filter((permission) => permission.requestId !== requestId),
          }
        : agent,
    ),
  };
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
  renamingRunId: string | null;
  pendingDeletedRunIdsRef: React.RefObject<Set<string>>;
  pendingCreatedConversationSnapshotsRef: React.RefObject<Map<string, CreatedConversationSnapshot>>;
  pendingSentConversationMessagesRef: React.RefObject<Map<string, MessageRecord>>;
  loadingWorkerHistoryIdsRef: React.RefObject<Set<string>>;
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
    setMovingRunId,
    setMoveRunProjectPath,
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

  const moveRunToProject = useMutation({
    onMutate: (variables: { runId: string; projectPath: string }) => {
      const previousState = state;
      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).map((run: RunRecord) =>
          run.id === variables.runId ? { ...run, projectPath: variables.projectPath } : run,
        ),
      }));
      return { previousState };
    },
    mutationFn: async ({ runId, projectPath }: { runId: string; projectPath: string }) => requestJson<{ ok: true; runId: string; projectPath: string }>(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath }),
    }, {
      source: "Runs",
      action: "Move to project",
    }),
    onSuccess: (data, variables) => {
      const nextProjectPath = data.projectPath || variables.projectPath;
      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).map((run: RunRecord) =>
          run.id === variables.runId ? { ...run, projectPath: nextProjectPath } : run,
        ),
      }));
      setMovingRunId(null);
      setMoveRunProjectPath("");
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      setState(context.previousState);
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
      if (shouldRestoreSelectionAfterOptimisticRemovalError({
        removedRunId: variables.runId,
        selectedRunIdAtStart: context.previousSelectedRunId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      })) {
        setSelectedRunId(context.previousSelectedRunId);
      }
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
      if (shouldRestoreSelectionAfterOptimisticRemovalError({
        removedRunId: variables.runId,
        selectedRunIdAtStart: context.previousSelectedRunId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      })) {
        setSelectedRunId(context.previousSelectedRunId);
      }
      setRenamingRunId(context.previousRenamingRunId);
      setRenameValue(context.previousRenameValue);
      setRenameSource(context.previousRenameSource);
    },
  });

  const recoverRun = useMutation({
    mutationFn: async ({ runId, action, targetMessageId, content, gitWorkspaceLaunch }: {
      runId: string;
      action: "retry" | "edit" | "fork";
      targetMessageId: string;
      content?: string;
      gitWorkspaceLaunch?: GitWorkspaceLaunchRequest;
    }) => requestJson<{ runId?: string }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetMessageId, content, gitWorkspaceLaunch }),
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
    onSuccess: (data, variables) => {
      if (shouldSelectRecoveredRunAfterSuccess({
        action: variables.action,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
        requestedRunId: variables.runId,
        recoveredRunId: data.runId,
      })) {
        setSelectedRunId(data.runId ?? null);
      }
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
    mutationFn: async (payload: { content: string; attachments: PendingChatAttachment[]; projectPath: string | null; requestedRunId: string }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      const uploadedAttachments = await uploadPendingChatAttachments(payload.attachments);
      const workspaceState = payload.projectPath ? gitWorkspaceManager.getSnapshot() : null;
      const pendingWorkspaceLaunch = payload.projectPath
        ? workspaceState?.pendingLaunchByProject[payload.projectPath] ?? null
        : null;
      const selectedWorkspaceTarget = payload.projectPath && !pendingWorkspaceLaunch
        ? workspaceState?.selectedTargetsByProject[payload.projectPath] ?? null
        : null;
      return requestJson<{ runId?: string } & CreatedConversationSnapshot>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedConversationMode,
          command: payload.content,
          projectPath: payload.projectPath,
          requestedRunId: payload.requestedRunId,
          gitWorkspaceLaunch: pendingWorkspaceLaunch,
          gitWorkspaceTarget: selectedWorkspaceTarget,
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
    onMutate: (payload) => {
      const previousCommand = homeUiStateManager.getSnapshot().command;
      const previousCommandCursor = homeUiStateManager.getSnapshot().commandCursor;
      const previousSelectedRunId = homeUiStateManager.getSnapshot().selectedRunId;
      const previousDraftProjectPath = homeUiStateManager.getSnapshot().draftProjectPath;
      const requestedRunId = payload.requestedRunId;
      const previousPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.get(requestedRunId);
      const hadPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.has(requestedRunId);
      const optimisticSnapshot = buildOptimisticCreatedConversationSnapshot({
        runId: requestedRunId,
        content: payload.content,
        projectPath: payload.projectPath,
        mode: selectedConversationMode,
        preferredWorkerType: selectedCliAgent === "auto" ? autoSelectedWorkerType : selectedCliAgent,
      });
      pendingCreatedConversationSnapshotsRef.current.set(requestedRunId, optimisticSnapshot);
      setCommand("");
      homeUiSetters.setCommandCursor(0);
      setSelectedRunId(requestedRunId);
      replaceBrowserConversationPath(requestedRunId, null);
      setState((current) => appendCreatedConversationSnapshot(current, optimisticSnapshot));
      return {
        projectPath: payload.projectPath,
        requestedRunId,
        previousPendingCreatedSnapshot,
        hadPendingCreatedSnapshot,
        previousSelectedRunId,
        previousDraftProjectPath,
        previousCommand,
        previousCommandCursor,
      };
    },
    onSuccess: (data, variables) => {
      if (variables.projectPath) {
        gitWorkspaceManager.consumePendingLaunch(variables.projectPath);
      }
      const createdRunId = data.runId ?? data.run?.id ?? variables.requestedRunId;
      const ownsSelection = ownsOptimisticRunSelection({
        requestedRunId: variables.requestedRunId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      });
      if (ownsSelection) {
        clearAttachments();
      }
      if (createdRunId) {
        if (data.run) {
          pendingCreatedConversationSnapshotsRef.current.set(createdRunId, {
            plan: data.plan,
            run: data.run,
            message: data.message,
          });
          setState((current) => appendCreatedConversationSnapshot(current, data));
        }
        if (ownsSelection) {
          setSelectedRunId(createdRunId);
          replaceBrowserConversationPath(createdRunId, null);
        }
      }
    },
    onError: (_error, _variables, context) => {
      if (context) {
        if (context.hadPendingCreatedSnapshot && context.previousPendingCreatedSnapshot) {
          pendingCreatedConversationSnapshotsRef.current.set(context.requestedRunId, context.previousPendingCreatedSnapshot);
        } else {
          pendingCreatedConversationSnapshotsRef.current.delete(context.requestedRunId);
        }
        setState((current) => removeRunFromHomeState(current, context.requestedRunId));
      }
      const ownsSelection = context
        ? ownsOptimisticRunSelection({
          requestedRunId: context.requestedRunId,
          currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
        })
        : false;
      if (context && ownsSelection) {
        setSelectedRunId(context.previousSelectedRunId);
        replaceBrowserConversationPath(context.previousSelectedRunId, context.previousDraftProjectPath);
      }
      const snapshot = homeUiStateManager.getSnapshot();
      if (context && ownsSelection && !snapshot.command.trim()) {
        setCommand(context.previousCommand);
        homeUiSetters.setCommandCursor(context.previousCommandCursor);
      }
    },
  });

  const sendConversationMessage = useMutation({
    onMutate: () => ({
      commandAtStart: homeUiStateManager.getSnapshot().command,
      attachmentsAtStart: homeUiStateManager.getSnapshot().attachments,
    }),
    mutationFn: async (payload: {
      runId: string;
      content: string;
      attachments: PendingChatAttachment[];
      busyAction?: BusyMessageAction;
    }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const selectedWorkerType = isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent;
      const resolvedSelectedModel = selectedWorkerType
        ? resolveSelectedWorkerModel(selectedWorkerType as WorkerType, selectedModel)
        : null;
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
          preferredWorkerType: selectedWorkerType,
          preferredWorkerModel: isAutoWorkerSelection ? null : resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          allowedWorkerTypes: activeAllowedWorkerTypes,
        }),
      }, {
        source: "Conversations",
        action: "Send a conversation message",
      });
    },
    onSuccess: (data, variables, context) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
      }
      if (data.queuedMessage) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
      }
      setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      const snapshot = homeUiStateManager.getSnapshot();
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });
      if (ownsSideEffects && context && shouldClearSubmittedComposer({
        submittedContent: variables.content,
        commandAtStart: context.commandAtStart,
        currentCommand: snapshot.command,
        attachmentsAtStart: context.attachmentsAtStart,
        currentAttachments: snapshot.attachments,
      })) {
        setCommand("");
        clearAttachments();
      }
      if (ownsSideEffects) {
        scrollConversationToBottom();
      }
    },
  });

  const { cancelQueuedMessage, sendQueuedMessageNow, interruptQueuedMessage } = useQueuedMessageMutations({
    setState,
    pendingSentConversationMessagesRef,
    scrollConversationToBottom,
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
    onSuccess: (data, variables) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
      }
      setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      if (ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      })) {
        scrollConversationToBottom();
      }
    },
  });

  const autoCommitProject = useMutation({
    onMutate: () => ({
      selectedRunIdAtStart: homeUiStateManager.getSnapshot().selectedRunId,
      commandAtStart: homeUiStateManager.getSnapshot().command,
      attachmentsAtStart: homeUiStateManager.getSnapshot().attachments,
    }),
    mutationFn: async (payload: { projectPath: string; action: ManualCommitAction }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      return requestJson<{ runId?: string } & CreatedConversationSnapshot>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
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
    onSuccess: (data, _variables, context) => {
      const ownsSelection = shouldSelectProjectMutationResult({
        selectedRunIdAtStart: context?.selectedRunIdAtStart ?? null,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
        resultRunId: data.runId,
      });
      const snapshot = homeUiStateManager.getSnapshot();
      const composerStillOwned = ownsSelection
        && snapshot.command === context?.commandAtStart
        && snapshot.attachments === context?.attachmentsAtStart;
      if (composerStillOwned) {
        setCommand("");
        clearAttachments();
      }
      if (ownsSelection) {
        setMobileNavOpen(false);
      }
      if (data.runId) {
        if (data.run) {
          pendingCreatedConversationSnapshotsRef.current.set(data.runId, {
            plan: data.plan,
            run: data.run,
            message: data.message,
          });
          setState((current) => appendCreatedConversationSnapshot(current, data));
        }
        if (ownsSelection) {
          setSelectedRunId(data.runId);
          replaceBrowserConversationPath(data.runId, null);
        }
      }
    },
  });

  const stopSupervisor = useMutation({
    onMutate: ({ runId }: { runId: string }) => {
      const previousState = state;
      setState((current) => applyStopSupervisorOptimisticUpdate(current, runId));
      return { previousState };
    },
    mutationFn: async ({ runId }: { runId: string }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop_supervisor" }),
    }, {
      source: "Runs",
      action: "Stop supervisor",
    }),
    onError: (_error, _variables, context) => {
      if (context?.previousState) setState(context.previousState);
    },
  });

  const stopWorker = useMutation({
    onMutate: ({ runId, workerId }: { runId: string; workerId: string }) => {
      const previousState = state;
      setState((current) => applyStopWorkerOptimisticUpdate(current, runId, workerId));
      return { previousState };
    },
    mutationFn: async ({ runId, workerId }: { runId: string; workerId: string }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop_worker", workerId }),
    }, {
      source: "Runs",
      action: "Stop worker",
    }),
    onError: (_error, _variables, context) => {
      if (context?.previousState) setState(context.previousState);
    },
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

  const respondElicitation = useMutation({
    onMutate: (variables: {
      workerId: string;
      requestId: number;
      action: "accept" | "decline" | "cancel";
      content?: Record<string, string | number | boolean | string[]>;
    }) => {
      const previousState = state;
      setState((current) => applyElicitationOptimisticUpdate(current, variables.workerId, variables.requestId));
      return { previousState };
    },
    mutationFn: async ({ workerId, action, content }) => requestJson<{ ok: true }>(`/api/agents/${encodeURIComponent(workerId)}/elicitation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "accept" ? { action, content: content ?? {} } : { action }),
    }, {
      source: "Agent runtime",
      action: "Respond to worker question",
    }),
    onError: (error, _variables, context) => {
      if (context?.previousState) {
        setState(context.previousState);
      }
      setRuntimeErrors((current) => mergeAppErrors(current, [
        buildInlineError(error, {
          source: "Agent runtime",
          action: "Respond to worker question",
        }),
      ]));
    },
  });

  const respondPermission = useMutation({
    onMutate: (variables: {
      workerId: string;
      requestId: number;
      decision: "approve" | "deny";
      optionId?: string;
    }) => {
      const previousState = state;
      setState((current) => applyPermissionOptimisticUpdate(current, variables.workerId, variables.requestId));
      return { previousState };
    },
    mutationFn: async ({ workerId, decision, optionId }) => requestJson<{ ok: true }>(`/api/agents/${encodeURIComponent(workerId)}/permission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(optionId ? { decision, optionId } : { decision }),
    }, {
      source: "Agent runtime",
      action: "Respond to permission request",
    }),
    onError: (error, _variables, context) => {
      if (context?.previousState) {
        setState(context.previousState);
      }
      setRuntimeErrors((current) => mergeAppErrors(current, [
        buildInlineError(error, {
          source: "Agent runtime",
          action: "Respond to permission request",
        }),
      ]));
    },
  });

  const promotePlanningConversation = useMutation({
    onMutate: (_payload: { runId: string; planPath: string | null }) => ({
      selectedRunIdAtStart: homeUiStateManager.getSnapshot().selectedRunId,
    }),
    mutationFn: async (payload: { runId: string; planPath: string | null }) => requestJson<{ runId?: string }>(`/api/planning/${payload.runId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planPath: payload.planPath }),
    }, {
      source: "Planning",
      action: "Promote planning conversation",
    }),
    onSuccess: (data, variables, context) => {
      if (data.runId && shouldSelectSourceRunMutationResult({
        sourceRunId: variables.runId,
        selectedRunIdAtStart: context?.selectedRunIdAtStart ?? null,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
        resultRunId: data.runId,
      })) {
        setSelectedRunId(data.runId);
        replaceBrowserConversationPath(data.runId, null);
      }
    },
  });

  const startPlanningReview = useMutation({
    mutationFn: async (payload: { runId: string; agentSelection: PlanningReviewAgentSelection; rounds: number }) => requestJson<{ ok: true; reviewRunId: string }>(`/api/planning/${payload.runId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentSelection: payload.agentSelection, rounds: payload.rounds }),
    }, {
      source: "Planning",
      action: "Start planning review",
    }),
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
        agentsByName.set(agent.name, mergeLoadedWorkerHistoryAgent(agentsByName.get(agent.name), agent));
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
    moveRunToProject,
    deleteRun,
    archiveRun,
    recoverRun,
    resumeRunRecovery,
    runCommand,
    sendConversationMessage,
    cancelQueuedMessage,
    sendQueuedMessageNow,
    interruptQueuedMessage,
    autoCommitChat,
    autoCommitProject,
    stopSupervisor,
    stopWorker,
    stopWorkerTerminalProcess,
    respondElicitation,
    respondPermission,
    promotePlanningConversation,
    startPlanningReview,
    handleLoadWorkerHistory,
  };
}
