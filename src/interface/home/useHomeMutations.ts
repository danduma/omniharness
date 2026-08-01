"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { mergeAppErrors } from "@/lib/app-errors";
import { useRuntimeAPIs } from "@/runtime-api/provider";
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
import type { PlanningReviewAgentSelection } from "@/shared/planning-review";
import {
  appendCreatedConversationSnapshot,
  appendSentConversationMessageSnapshot,
  buildOptimisticCreatedConversationSnapshot,
  buildOptimisticSentConversationMessage,
  buildInlineError,
  removeRunFromHomeState,
  resolveOptimisticSentConversationMessage,
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
  WorkerType,
} from "./types";
import {
  applyElicitationOptimisticUpdate,
  applyPermissionOptimisticUpdate,
  applyStopSupervisorOptimisticUpdate,
  applyStopWorkerOptimisticUpdate,
  isAlreadyResolvedHumanInputError,
  mergeLoadedWorkerHistoryAgent,
  ownsConversationSideEffects,
  ownsOptimisticRunSelection,
  replaceBrowserConversationPath,
  shouldClearSubmittedComposer,
  shouldRestoreSelectionAfterOptimisticRemovalError,
  shouldSelectProjectMutationResult,
  shouldSelectSourceRunMutationResult,
} from "./mutations/optimistic-state";

export {
  mergeLoadedWorkerHistoryAgent,
  ownsConversationSideEffects,
  ownsOptimisticRunSelection,
  ownsSelectionFromMutationStart,
  shouldClearSubmittedComposer,
  shouldRestoreSelectionAfterOptimisticRemovalError,
  shouldSelectProjectMutationResult,
  shouldSelectSourceRunMutationResult,
} from "./mutations/optimistic-state";


export interface UseHomeMutationsParams {
  state: EventStreamState;
  setState: React.Dispatch<React.SetStateAction<EventStreamState>>;
  selectedRunId: string | null;
  selectedCliAgent: ComposerWorkerOption;
  selectedWorkerAccountId: string;
  selectedConversationMode: ConversationModeOption;
  selectedModel: string;
  selectedEffort: string;
  autoSelectedWorkerType: string | null;
  activeAllowedWorkerTypes: string[];
  renamingRunId: string | null;
  pendingDeletedRunIdsRef: React.RefObject<Set<string>>;
  pendingCreatedConversationSnapshotsRef: React.RefObject<Map<string, CreatedConversationSnapshot>>;
  pendingSentConversationMessagesRef: React.RefObject<Map<string, MessageRecord>>;
  /**
   * Ids of user messages this client sent itself. Threaded to the Terminal
   * as `ungatedUserMessageIds` so a just-sent bubble bypasses the stream
   * fallback gate and never flickers while the stream catches up.
   */
  locallySentMessageIdsRef: React.RefObject<Set<string>>;
  /** Ids of optimistic user messages whose send request is still in flight. */
  sendingMessageIdsRef: React.RefObject<Set<string>>;
  loadingWorkerHistoryIdsRef: React.RefObject<Set<string>>;
  scrollConversationToBottom: () => void;
  sessionQueryRefetch: () => Promise<unknown>;
}

export function useHomeMutations({
  state,
  setState,
  selectedRunId,
  selectedCliAgent,
  selectedWorkerAccountId,
  selectedConversationMode,
  selectedModel,
  selectedEffort,
  autoSelectedWorkerType,
  activeAllowedWorkerTypes,
  renamingRunId,
  pendingDeletedRunIdsRef,
  pendingCreatedConversationSnapshotsRef,
  pendingSentConversationMessagesRef,
  locallySentMessageIdsRef,
  sendingMessageIdsRef,
  loadingWorkerHistoryIdsRef,
  scrollConversationToBottom,
  sessionQueryRefetch,
}: UseHomeMutationsParams) {
  const runtimeApis = useRuntimeAPIs();
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
    setAttachments,
    clearAttachments,
  } = homeUiSetters;
  const preferredWorkerAccountId = selectedWorkerAccountId === "auto" ? null : selectedWorkerAccountId;

  const loginMutation = useMutation({
    mutationFn: async (password: string) => runtimeApis.auth.login({
      password,
      label: "Browser session",
    }) as Promise<{ ok: true }>,
    onSuccess: async () => {
      setAuthError(null);
      await sessionQueryRefetch();
    },
    onError: (error) => {
      setAuthError(error instanceof Error ? error.message : String(error));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => runtimeApis.auth.logout() as Promise<{ ok: true }>,
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
    mutationFn: async (pairToken: string) => runtimeApis.auth.redeemPair({
      pairToken,
    }) as Promise<{ ok: true; targetPath: string }>,
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
      await runtimeApis.settings.save(payload);
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
      await runtimeApis.settings.save({ [key]: value });
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
    mutationFn: async ({ runId, title }: { runId: string; title: string }) =>
      runtimeApis.runs.update({ runId, patch: { title } }),
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
    mutationFn: async ({ runId, projectPath }: { runId: string; projectPath: string }) =>
      runtimeApis.runs.update({
        runId,
        patch: { projectPath },
      }) as Promise<{ ok: true; runId: string; projectPath: string }>,
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
    mutationFn: async ({ runId }: { runId: string }) =>
      runtimeApis.runs.remove({ runId }),
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
    mutationFn: async ({ runId }: { runId: string }) =>
      runtimeApis.runs.act({ runId, body: { action: "archive" } }),
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
    mutationFn: async ({ runId, action, targetMessageId, content, gitWorkspaceLaunch, manualRecovery }: {
      runId: string;
      action: "retry" | "edit" | "fork";
      targetMessageId: string;
      content?: string;
      gitWorkspaceLaunch?: GitWorkspaceLaunchRequest;
      manualRecovery?: boolean;
    }) => runtimeApis.runs.act({
      runId,
      body: { action, targetMessageId, content, gitWorkspaceLaunch, manualRecovery },
    }) as Promise<{ runId?: string }>,
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
    mutationFn: async ({ runId }: { runId: string }) =>
      runtimeApis.runs.resume({ runId }) as Promise<{
        ok: true;
        runId: string;
        recovery?: unknown;
      }>,
  });

  const runCommand = useMutation({
    mutationFn: async (payload: { content: string; attachments: PendingChatAttachment[]; projectPath: string | null; requestedRunId: string }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      const uploadedAttachments = await uploadPendingChatAttachments(
        payload.attachments,
        runtimeApis.files,
      );
      const workspaceState = payload.projectPath ? gitWorkspaceManager.getSnapshot() : null;
      const pendingWorkspaceLaunch = payload.projectPath
        ? workspaceState?.pendingLaunchByProject[payload.projectPath] ?? null
        : null;
      const selectedWorkspaceTarget = payload.projectPath && !pendingWorkspaceLaunch
        ? workspaceState?.selectedTargetsByProject[payload.projectPath] ?? null
        : null;
      return runtimeApis.conversations.create({
          mode: selectedConversationMode,
          command: payload.content,
          projectPath: payload.projectPath,
          requestedRunId: payload.requestedRunId,
          gitWorkspaceLaunch: pendingWorkspaceLaunch,
          gitWorkspaceTarget: selectedWorkspaceTarget,
          preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent,
          preferredWorkerModel: resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          preferredWorkerAccountId,
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent],
          attachments: uploadedAttachments,
        }) as Promise<{ runId?: string } & CreatedConversationSnapshot>;
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
        preferredWorkerAccountId,
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
    // The user's bubble must exist continuously from the moment they hit
    // send: optimistic row now, swapped for the server's row on success,
    // removed (with the draft restored) on error. Appearing only on POST
    // success made the bubble pop in late and flicker.
    onMutate: (payload: {
      runId: string;
      content: string;
      attachments: PendingChatAttachment[];
      busyAction?: BusyMessageAction;
    }) => {
      const snapshot = homeUiStateManager.getSnapshot();
      const optimisticMessage = buildOptimisticSentConversationMessage({
        runId: payload.runId,
        content: payload.content,
        attachments: payload.attachments.map(({ id, kind, name, mimeType, size, previewUrl }) => (
          { id, kind, name, mimeType, size, previewUrl }
        )),
      });
      pendingSentConversationMessagesRef.current.set(optimisticMessage.id, optimisticMessage);
      locallySentMessageIdsRef.current.add(optimisticMessage.id);
      sendingMessageIdsRef.current.add(optimisticMessage.id);
      setState((current) => appendSentConversationMessageSnapshot(current, optimisticMessage));
      const ownsSideEffects = ownsConversationSideEffects({
        runId: payload.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });
      const composerCleared = ownsSideEffects && snapshot.command === payload.content;
      if (composerCleared) {
        setCommand("");
        clearAttachments();
      }
      if (ownsSideEffects) {
        scrollConversationToBottom();
      }
      return {
        commandAtStart: snapshot.command,
        attachmentsAtStart: snapshot.attachments,
        optimisticMessageId: optimisticMessage.id,
        composerCleared,
      };
    },
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
      const uploadedAttachments = await uploadPendingChatAttachments(
        payload.attachments,
        runtimeApis.files,
      );
      return runtimeApis.conversations.sendTo({
        runId: payload.runId,
        body: {
          content: payload.content,
          attachments: uploadedAttachments,
          busyAction: payload.busyAction,
          preferredWorkerType: selectedWorkerType,
          preferredWorkerModel: isAutoWorkerSelection ? null : resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          preferredWorkerAccountId,
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedWorkerType],
        },
      }) as Promise<{
        ok: true;
        message?: MessageRecord;
        queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
      }>;
    },
    onSuccess: (data, variables, context) => {
      if (context) {
        pendingSentConversationMessagesRef.current.delete(context.optimisticMessageId);
        locallySentMessageIdsRef.current.delete(context.optimisticMessageId);
        sendingMessageIdsRef.current.delete(context.optimisticMessageId);
      }
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
        locallySentMessageIdsRef.current.add(data.message.id);
      }
      if (data.queuedMessage) {
        if (variables.busyAction === "steer" && data.message) {
          busyMessageQueueManager.hideQueuedMessage(data.queuedMessage.id);
        } else {
          busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
        }
      }
      setState((current) => (
        context
          ? resolveOptimisticSentConversationMessage(current, context.optimisticMessageId, data.message)
          : appendSentConversationMessageSnapshot(current, data.message)
      ));
      const snapshot = homeUiStateManager.getSnapshot();
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });
      if (ownsSideEffects && context && !context.composerCleared && shouldClearSubmittedComposer({
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
    onError: (_error, variables, context) => {
      if (!context) {
        return;
      }
      pendingSentConversationMessagesRef.current.delete(context.optimisticMessageId);
      locallySentMessageIdsRef.current.delete(context.optimisticMessageId);
      sendingMessageIdsRef.current.delete(context.optimisticMessageId);
      setState((current) => resolveOptimisticSentConversationMessage(current, context.optimisticMessageId, null));
      // Restore the draft we cleared optimistically, unless the user has
      // already typed or attached something new.
      const snapshot = homeUiStateManager.getSnapshot();
      if (
        context.composerCleared
        && ownsConversationSideEffects({
          runId: variables.runId,
          currentSelectedRunId: snapshot.selectedRunId,
        })
        && !snapshot.command.trim()
        && snapshot.attachments.length === 0
      ) {
        setCommand(context.commandAtStart);
        setAttachments(context.attachmentsAtStart);
      }
    },
  });

  const { cancelQueuedMessage, sendQueuedMessageNow, interruptQueuedMessage } = useQueuedMessageMutations({
    setState,
    pendingSentConversationMessagesRef,
    locallySentMessageIdsRef,
    scrollConversationToBottom,
  });

  const autoCommitChat = useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: ManualCommitAction }) =>
      runtimeApis.conversations.sendTo({
        runId,
        body: { content: getManualCommitPrompt(action) },
      }) as Promise<{ ok: true; message?: MessageRecord }>,
    onSuccess: (data, variables) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
        locallySentMessageIdsRef.current.add(data.message.id);
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
      return runtimeApis.conversations.create({
          mode: "commit",
          command: getManualProjectCommitPrompt(payload.action),
          projectPath: payload.projectPath,
          preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent,
          preferredWorkerModel: resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          preferredWorkerAccountId,
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent],
        }) as Promise<{ runId?: string } & CreatedConversationSnapshot>;
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
    mutationFn: async ({ runId }: { runId: string }) =>
      runtimeApis.runs.act({
        runId,
        body: { action: "stop_supervisor" },
      }) as Promise<{ ok: true }>,
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
    mutationFn: async ({ runId, workerId }: { runId: string; workerId: string }) =>
      runtimeApis.runs.act({
        runId,
        body: { action: "stop_worker", workerId },
      }) as Promise<{ ok: true }>,
    onError: (_error, _variables, context) => {
      if (context?.previousState) setState(context.previousState);
    },
  });

  const stopWorkerTerminalProcess = useMutation({
    mutationFn: async ({ runId, workerId, terminalProcess }: {
      runId: string;
      workerId: string;
      terminalProcess: WorkerTerminalProcess;
    }) => runtimeApis.runs.act({
      runId,
      body: {
        action: "stop_worker_terminal",
        workerId,
        terminalProcessId: terminalProcess.id,
        processId: terminalProcess.processId,
      },
    }) as Promise<{ ok: true }>,
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
    mutationFn: async ({ workerId, requestId, action, content }) =>
      runtimeApis.workers.answerElicitation({
        workerId,
        body: action === "accept"
          ? { requestId, action, content: content ?? {} }
          : { requestId, action },
      }) as Promise<{ ok: true }>,
    onError: (error, _variables, context) => {
      const alreadyResolved = isAlreadyResolvedHumanInputError(error);
      if (!alreadyResolved && context?.previousState) {
        setState(context.previousState);
      }
      const descriptor = buildInlineError(error, {
        source: "Agent runtime",
        action: "Respond to worker question",
      });
      setRuntimeErrors((current) => mergeAppErrors(current, [
        alreadyResolved
          ? {
              ...descriptor,
              source: "Agent runtime",
              action: "Respond to worker question",
              message: "This question is no longer open — the worker stopped waiting for an answer.",
              suggestion: "Send your answer as a normal message instead.",
            }
          : descriptor,
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
    mutationFn: async ({ workerId, requestId, decision, optionId }) =>
      runtimeApis.workers.answerPermission({
        workerId,
        body: optionId
          ? { requestId, decision, optionId }
          : { requestId, decision },
      }) as Promise<{ ok: true }>,
    onError: (error, _variables, context) => {
      const alreadyResolved = isAlreadyResolvedHumanInputError(error);
      if (!alreadyResolved && context?.previousState) {
        setState(context.previousState);
      }
      const descriptor = buildInlineError(error, {
        source: "Agent runtime",
        action: "Respond to permission request",
      });
      setRuntimeErrors((current) => mergeAppErrors(current, [
        alreadyResolved
          ? {
              ...descriptor,
              source: "Agent runtime",
              action: "Respond to permission request",
              message: "This permission request is no longer open — the worker stopped waiting for a decision.",
              suggestion: "The tool call it was guarding did not run. Ask the worker to retry it if you still want it.",
            }
          : descriptor,
      ]));
    },
  });

  const promotePlanningConversation = useMutation({
    onMutate: (_payload: { runId: string; planPath: string | null }) => ({
      selectedRunIdAtStart: homeUiStateManager.getSnapshot().selectedRunId,
    }),
    mutationFn: async (payload: { runId: string; planPath: string | null }) =>
      runtimeApis.planning.promote({
        runId: payload.runId,
        body: { planPath: payload.planPath },
      }) as Promise<{ runId?: string }>,
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
    mutationFn: async (payload: { runId: string; agentSelection: PlanningReviewAgentSelection; rounds: number }) =>
      runtimeApis.planning.review({
        runId: payload.runId,
        body: {
          agentSelection: payload.agentSelection,
          rounds: payload.rounds,
        },
      }) as Promise<{ ok: true; reviewRunId: string }>,
  });

  const handleLoadWorkerHistory = async (workerId: string) => {
    const normalizedWorkerId = workerId.trim();
    if (!normalizedWorkerId || loadingWorkerHistoryIdsRef.current.has(normalizedWorkerId)) {
      return;
    }

    loadingWorkerHistoryIdsRef.current.add(normalizedWorkerId);
    try {
      const agent = await runtimeApis.workers.get({
        workerId: normalizedWorkerId,
        history: "full",
      }) as AgentSnapshot;

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
