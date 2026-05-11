"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BootShell } from "@/components/BootShell";
import { LoginShell } from "@/components/LoginShell";
import { AttachmentImagePreviewDialog } from "@/components/AttachmentImagePreviewDialog";
import { ConversationComposer } from "@/components/home/ConversationComposer";
import { ConversationMain } from "@/components/home/ConversationMain";
import { ConversationSidebar } from "@/components/home/ConversationSidebar";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SideWindow } from "@/components/home/SideWindow";
import { type AppErrorDescriptor, mergeAppErrors, requestJson } from "@/lib/app-errors";
import type { ChatAttachment, PendingChatAttachment } from "@/lib/chat-attachments";
import { buildConversationGroups } from "@/lib/conversations";
import { buildWorkerLists, isWorkerActiveStatus, mergeWorkerLiveStatus, normalizeWorkerStatus, selectPrimaryConversationAgent, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import {
  GIT_AUTO_COMMIT_MILESTONES_SETTING,
  GIT_PUSH_ON_COMMIT_SETTING,
  getManualCommitPrompt,
  getManualProjectCommitPrompt,
  parseBooleanSetting,
  serializeBooleanSetting,
  type ManualCommitAction,
} from "@/lib/commit-workflow";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";
import { resolveProjectScope } from "@/lib/project-scope";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { applyRunRecoveryOptimisticUpdate, type RecoverableConversationState } from "@/lib/run-recovery-state";
import { buildDirectTerminalUserMessages, type WorkerTerminalUserMessage } from "@/lib/worker-terminal-messages";
import { COMPOSER_WORKER_OPTIONS, RUN_PATH_PATTERN, WORKER_OPTIONS } from "./constants";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { conversationNotificationManager } from "./ConversationNotificationManager";
import { sideWindowManager } from "./SideWindowManager";
import { parseBusyMessageAction, resolveBusyComposerBehavior, resolveBusyMessageActionForSubmitAction, type BusyMessageAction } from "./busy-message-behavior";
import type { AgentSnapshot, AuthSessionResponse, ComposerWorkerOption, ConversationModeOption, EventStreamState, ExecutionEventRecord, MessageRecord, NoticeDescriptor, PlanRecord, ProjectFilesResponse, QueuedConversationMessageRecord, RunRecord, SettingsResponse, SidebarGroup, SidebarRun, SupervisorInterventionRecord, WorkerCatalogResponse, WorkerModelOption, WorkerType } from "./types";
import { EventStreamStateManager } from "./EventStreamStateManager";
import { homeUiSetters, homeUiStateManager, INITIAL_EVENT_STREAM_STATE, type HomeUiState } from "./HomeUiStateManager";
import { appearancePreferencesManager, getAppearanceTextSizeStyle } from "./AppearancePreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { appendCreatedConversationSnapshot, appendSentConversationMessageSnapshot, buildConversationTimelineItems, buildInlineError, extractWorkerFailureDetail, filterOptimisticallyDeletedRuns, filterPromotedPlanningTranscriptMessages, getConversationTranscriptRunIds, getLatestUnresolvedWorkerStuckEvent, getWorkerModelOptions, mergePendingCreatedConversationSnapshots, mergePendingSentConversationMessages, parseProjectList, parseWorkerType, parseWorkerTypes, removeRunFromHomeState, resolveSelectedWorkerModel, shouldRenderMessageInMainConversation, shouldShowConversationExecutionPanel, shouldShowExecutionEventInRunLog, shouldShowRecoverableRunningState, stripRunFailurePrefix, summarizeThought, type CreatedConversationSnapshot } from "./utils";
import { useAppErrors } from "./useAppErrors";
import { useConversationExecutionStatus } from "./useConversationExecutionStatus";
import { useHomeLifecycle } from "./useHomeLifecycle";
import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { useRunRecoveryState } from "./useRunRecoveryState";
import { useRunSelectionEffects } from "./useRunSelectionEffects";
import { shouldOpenMobileSideWindow } from "./side-window-viewport";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";

const FolderPickerDialog = dynamic(
  () => import("@/components/FolderPickerDialog").then((module) => module.FolderPickerDialog),
  { ssr: false },
);
const PairDeviceDialog = dynamic(
  () => import("@/components/PairDeviceDialog").then((module) => module.PairDeviceDialog),
  { ssr: false },
);
const SettingsDialog = dynamic(
  () => import("@/components/home/SettingsDialog").then((module) => module.SettingsDialog),
  { ssr: false },
);

async function uploadPendingChatAttachments(attachments: PendingChatAttachment[]) {
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

function resolveRepoName(projectPath: string | null) {
  const normalized = projectPath?.trim().replace(/[/\\]+$/, "");
  if (!normalized) {
    return "omniharness";
  }

  return normalized.split(/[/\\]/).filter(Boolean).pop() || "omniharness";
}

function getInitialEventStreamSnapshotScope() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.pathname.match(RUN_PATH_PATTERN)?.[1]?.trim() || null;
}

type HomeAppState = Omit<HomeUiState, "command" | "commandCursor" | "mentionIndex" | "attachments">;
type ComposerDraftState = Pick<HomeUiState, "command" | "commandCursor" | "mentionIndex" | "attachments">;

function selectHomeAppState(state: HomeUiState): HomeAppState {
  const homeAppState: Partial<HomeUiState> = { ...state };
  delete homeAppState.command;
  delete homeAppState.commandCursor;
  delete homeAppState.mentionIndex;
  delete homeAppState.attachments;
  return homeAppState as HomeAppState;
}

function selectComposerDraftState(state: HomeUiState): ComposerDraftState {
  return {
    command: state.command,
    commandCursor: state.commandCursor,
    mentionIndex: state.mentionIndex,
    attachments: state.attachments,
  };
}

interface ComposerContainerProps {
  className: string;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
  selectedRunId: string | null;
  selectedConversationMode: ConversationModeOption;
  setSelectedConversationMode: (value: ConversationModeOption) => void;
  currentProjectScope: string | null;
  projectFiles: string[];
  projectFilesIsFetched: boolean;
  onOpenProjectFile: (filePath: string) => void;
  themeMode: "day" | "night";
  shouldLockDirectWorker: boolean;
  lockedDirectWorkerLabel: string;
  selectedCliAgent: ComposerWorkerOption;
  setSelectedCliAgent: (value: ComposerWorkerOption) => void;
  composerWorkerOptions: Array<{ value: ComposerWorkerOption; label: string }>;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  activeWorkerModelOptions: WorkerModelOption[];
  selectedEffort: string;
  setSelectedEffort: (value: string) => void;
  isComposerSubmitting: boolean;
  isStopConversationPending: boolean;
  isConversationStoppable: boolean;
  hasBusyConversation: boolean;
  busyMessageAction: BusyMessageAction;
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingQueuedMessageIds: Set<string>;
  onEditQueuedMessage: (message: QueuedConversationMessageRecord) => void;
  onSendQueuedMessageNow: (messageId: string) => void;
  onCancelQueuedMessage: (messageId: string) => void;
  onSendConversationMessage: (content: string, attachments: PendingChatAttachment[], busyAction?: BusyMessageAction) => void;
  onRunCommand: (content: string, attachments: PendingChatAttachment[]) => void;
  onStopConversation: () => void;
}

function ComposerContainer({
  className,
  commandInputRef,
  selectedRunId,
  selectedConversationMode,
  setSelectedConversationMode,
  currentProjectScope,
  projectFiles,
  projectFilesIsFetched,
  onOpenProjectFile,
  themeMode,
  shouldLockDirectWorker,
  lockedDirectWorkerLabel,
  selectedCliAgent,
  setSelectedCliAgent,
  composerWorkerOptions,
  selectedModel,
  setSelectedModel,
  activeWorkerModelOptions,
  selectedEffort,
  setSelectedEffort,
  isComposerSubmitting,
  isStopConversationPending,
  isConversationStoppable,
  hasBusyConversation,
  busyMessageAction,
  queuedMessages,
  cancellingQueuedMessageIds,
  onEditQueuedMessage,
  onSendQueuedMessageNow,
  onCancelQueuedMessage,
  onSendConversationMessage,
  onRunCommand,
  onStopConversation,
}: ComposerContainerProps) {
  const {
    setCommand,
    setCommandCursor,
    setMentionIndex,
    addAttachmentFiles,
    addPastedImages,
    removeAttachment,
  } = homeUiSetters;
  const { command, commandCursor, mentionIndex, attachments } = useManagerSelector(
    homeUiStateManager,
    selectComposerDraftState,
    shallowEqualRecord,
  );
  const activeMention = getActiveMentionQuery(command, commandCursor);
  const filteredProjectFiles = useMemo(() => {
    if (!activeMention) {
      return [];
    }

    const needle = activeMention.query.toLowerCase();
    return projectFiles
      .filter((filePath) => needle.length === 0 || filePath.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [activeMention, projectFiles]);
  const showMentionPicker = Boolean(
    activeMention && currentProjectScope && (filteredProjectFiles.length > 0 || projectFilesIsFetched)
  );
  const composerBehavior = resolveBusyComposerBehavior({
    hasBusyConversation,
    isConversationStoppable,
    hasContent: Boolean(command.trim() || attachments.length > 0),
    busyMessageAction,
  });

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, currentProjectScope, setMentionIndex]);

  const applyMention = (filePath: string) => {
    if (!activeMention) {
      return;
    }

    const nextValue = replaceActiveMention(command, activeMention, filePath);
    const nextCursor = activeMention.start + filePath.length + 2;
    setCommand(nextValue);
    setCommandCursor(nextCursor);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (composerBehavior.submitAction === "stop") {
      onStopConversation();
      return;
    }

    if (!command.trim() && attachments.length === 0) {
      return;
    }

    if (selectedRunId) {
      onSendConversationMessage(
        command,
        attachments,
        resolveBusyMessageActionForSubmitAction(composerBehavior.submitAction),
      );
      return;
    }

    onRunCommand(command, attachments);
  };

  return (
    <ConversationComposer
      className={className}
      command={command}
      setCommand={setCommand}
      setCommandCursor={setCommandCursor}
      commandInputRef={commandInputRef}
      handleSubmit={handleSubmit}
      selectedRunId={selectedRunId}
      selectedConversationMode={selectedConversationMode}
      setSelectedConversationMode={setSelectedConversationMode}
      showMentionPicker={showMentionPicker}
      currentProjectScope={currentProjectScope}
      filteredProjectFiles={filteredProjectFiles}
      mentionIndex={mentionIndex}
      setMentionIndex={setMentionIndex}
      applyMention={applyMention}
      onOpenProjectFile={onOpenProjectFile}
      themeMode={themeMode}
      attachments={attachments}
      handleRemoveAttachment={removeAttachment}
      onAddAttachmentFiles={addAttachmentFiles}
      onAddPastedImages={addPastedImages}
      shouldLockDirectWorker={shouldLockDirectWorker}
      lockedDirectWorkerLabel={lockedDirectWorkerLabel}
      selectedCliAgent={selectedCliAgent}
      setSelectedCliAgent={setSelectedCliAgent}
      composerWorkerOptions={composerWorkerOptions}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      activeWorkerModelOptions={activeWorkerModelOptions}
      selectedEffort={selectedEffort}
      setSelectedEffort={setSelectedEffort}
      isComposerSubmitting={isComposerSubmitting}
      isStopConversationPending={isStopConversationPending}
      isConversationStoppable={isConversationStoppable}
      composerBehavior={composerBehavior}
      queuedMessages={queuedMessages}
      cancellingQueuedMessageIds={cancellingQueuedMessageIds}
      onEditQueuedMessage={onEditQueuedMessage}
      onSendQueuedMessageNow={onSendQueuedMessageNow}
      onCancelQueuedMessage={onCancelQueuedMessage}
      onSendConversationMessage={(content, busyAction) => {
        onSendConversationMessage(content, attachments, busyAction);
      }}
      onRunCommand={(content) => onRunCommand(content, attachments)}
      onStopConversation={onStopConversation}
    />
  );
}

export function HomeApp() {
  const {
    themeMode,
    showSettings,
    showPairDeviceDialog,
    activeSettingsTab,
    activeLlmProfileTab,
    apiKeys,
    showFolderPicker,
    selectedRunId,
    leftSidebarOpen,
    leftSidebarWidth,
    rightSidebarOpen,
    rightSidebarWidth,
    isResizingLeftSidebar,
    isResizingRightSidebar,
    mobileNavOpen,
    mobileWorkersOpen,
    searchQuery,
    draftProjectPath,
    readMarkers,
    collapsedProjectPaths,
    renamingRunId,
    renameValue,
    renameSource,
    editingMessageId,
    editingMessageValue,
    expandedDirectMessageIds,
    routeReady,
    hasReceivedInitialEventStreamPayload,
    selectedConversationMode,
    selectedCliAgent,
    selectedModel,
    selectedEffort,
    hydratedRunSelectionId,
    pairTokenFromUrl,
    authError,
    pairRedeemError,
    pairRedeemAttempted,
    runtimeErrors,
    settingsDiagnostics,
  } = useManagerSelector(homeUiStateManager, selectHomeAppState, shallowEqualRecord);
  const {
    setCommand,
    setThemeMode,
    setShowSettings,
    setShowPairDeviceDialog,
    setActiveSettingsTab,
    setActiveLlmProfileTab,
    setApiKeys,
    setShowFolderPicker,
    setSelectedRunId,
    setLeftSidebarOpen,
    setLeftSidebarWidth,
    setRightSidebarOpen,
    setRightSidebarWidth,
    setIsResizingLeftSidebar,
    setIsResizingRightSidebar,
    setMobileNavOpen,
    setMobileWorkersOpen,
    setSearchQuery,
    setDraftProjectPath,
    setCommandCursor,
    setReadMarkers,
    setCollapsedProjectPaths,
    setRenamingRunId,
    setRenameValue,
    setRenameSource,
    setEditingMessageId,
    setEditingMessageValue,
    setExpandedDirectMessageIds,
    setRouteReady,
    setHasReceivedInitialEventStreamPayload,
    setSelectedConversationMode,
    setSelectedCliAgent,
    setSelectedModel,
    setSelectedEffort,
    setHydratedRunSelectionId,
    clearAttachments,
    setPairTokenFromUrl,
    setAuthError,
    setPairRedeemError,
    setPairRedeemAttempted,
    setRuntimeErrors,
    setSettingsDiagnostics,
  } = homeUiSetters;
  
  const stateManager = useMemo(() => new EventStreamStateManager(INITIAL_EVENT_STREAM_STATE, {
    snapshotCacheScope: getInitialEventStreamSnapshotScope(),
  }), []);
  const state = useSyncExternalStore(
    useCallback((listener) => stateManager.subscribe(listener), [stateManager]),
    useCallback(() => stateManager.getSnapshot(), [stateManager]),
    () => INITIAL_EVENT_STREAM_STATE,
  );
  const notificationState = useManagerSnapshot(conversationNotificationManager);
  const appearancePreferences = useManagerSnapshot(appearancePreferencesManager);
  const appearanceTextSizeStyle = useMemo(() => (
    getAppearanceTextSizeStyle(appearancePreferences.uiTextSize, appearancePreferences.conversationTextSize)
  ), [appearancePreferences.conversationTextSize, appearancePreferences.uiTextSize]);
  useEffect(() => {
    const body = document.body;
    const textSizeStyles = appearanceTextSizeStyle as Record<string, string | number | undefined>;

    body.classList.add("omni-app-text-scale");
    for (const [property, value] of Object.entries(textSizeStyles)) {
      if (typeof value === "string" || typeof value === "number") {
        body.style.setProperty(property, String(value));
      }
    }

    return () => {
      for (const property of Object.keys(textSizeStyles)) {
        body.style.removeProperty(property);
      }
      body.classList.remove("omni-app-text-scale");
    };
  }, [appearanceTextSizeStyle]);
  const setState = useCallback<React.Dispatch<React.SetStateAction<EventStreamState>>>(
    (action) => {
      stateManager.setSnapshotCacheScope(selectedRunId);
      stateManager.update(action);
    },
    [selectedRunId, stateManager],
  );
  const busyMessageQueueState = useManagerSnapshot(busyMessageQueueManager);
  const settingsDraft = useManagerSnapshot(settingsDraftManager);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingDeletedRunIdsRef = useRef<Set<string>>(new Set());
  const pendingCreatedConversationSnapshotsRef = useRef<Map<string, CreatedConversationSnapshot>>(new Map());
  const pendingSentConversationMessagesRef = useRef<Map<string, MessageRecord>>(new Map());
  const loadingWorkerHistoryIdsRef = useRef<Set<string>>(new Set());
  const autoResumeRunKeysRef = useRef<Set<string>>(new Set());
  const scrollConversationToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]') as HTMLDivElement | null;
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    });
  }, []);
  const enableNotifications = useCallback(() => {
    void conversationNotificationManager.requestEnable();
  }, []);
  const disableNotifications = useCallback(() => {
    conversationNotificationManager.disable();
  }, []);

  useEffect(() => {
    conversationNotificationManager.hydrateFromBrowser();
  }, []);

  const sessionQuery = useQuery<AuthSessionResponse>({
    queryKey: ["auth-session"],
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => requestJson<AuthSessionResponse>("/api/auth/session", undefined, {
      source: "Auth",
      action: "Load session state",
    }),
  });

  const authEnabled = sessionQuery.data?.enabled ?? false;
  const authConfigurationError = sessionQuery.data?.configurationError ?? null;
  const appUnlocked = sessionQuery.data ? (!sessionQuery.data.enabled || sessionQuery.data.authenticated) : false;
  const pairDeviceAvailabilityError = !authEnabled
    ? "Phone pairing requires OmniHarness auth. Set OMNIHARNESS_AUTH_PASSWORD or OMNIHARNESS_AUTH_PASSWORD_HASH and restart, then open Connect Phone again."
    : authConfigurationError;

  const loginMutation = useMutation({
    mutationFn: async (password: string) => requestJson<{ ok: true }>("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password,
        label: "Browser session",
      }),
    }, {
      source: "Auth",
      action: "Log in",
    }),
    onSuccess: async () => {
      setAuthError(null);
      await sessionQuery.refetch();
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
        buildInlineError(error, {
          source: "Auth",
          action: "Log out",
        }),
      ]));
    },
  });

  const redeemPairMutation = useMutation({
    mutationFn: async (pairToken: string) => requestJson<{ ok: true; targetPath: string }>("/api/auth/pair/redeem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: appUnlocked,
    queryFn: async () => {
      const data = await requestJson<SettingsResponse>("/api/settings", undefined, {
        source: "Settings",
        action: "Load saved settings",
      });
      settingsDraftManager.hydrate(data.values || {});
      setApiKeys(prev => ({ ...prev, ...settingsDraftManager.getSnapshot().draft }));
      setSettingsDiagnostics(data.diagnostics ?? []);
      return data;
    },
  });

  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
    queryKey: ["worker-catalog"],
    staleTime: 60_000,
    enabled: appUnlocked,
    refetchInterval: (query) => query.state.data?.workerModelsRefreshing ? 2_000 : false,
    queryFn: async () => {
      return requestJson<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>("/api/agents/catalog", undefined, {
        source: "Agent runtime",
        action: "Load worker availability",
      });
    },
  });

  const explicitProjects = useMemo(() => parseProjectList(apiKeys.PROJECTS), [apiKeys.PROJECTS]);

  const filterEventStreamState = useCallback((incomingState: EventStreamState) => {
    let nextState = mergePendingCreatedConversationSnapshots(
      incomingState,
      pendingCreatedConversationSnapshotsRef.current,
    );
    nextState = mergePendingSentConversationMessages(
      nextState,
      pendingSentConversationMessagesRef.current,
    );

    const pendingDeletedRunIds = pendingDeletedRunIdsRef.current;
    const reconcileQueuedMessages = (stateWithQueues: EventStreamState) => {
      busyMessageQueueManager.setQueuedMessages(stateWithQueues.queuedMessages || []);
      return stateWithQueues;
    };

    if (pendingDeletedRunIds.size === 0) {
      return reconcileQueuedMessages(nextState);
    }

    nextState = filterOptimisticallyDeletedRuns(nextState, pendingDeletedRunIds);
    const serverRunIds = new Set((incomingState.runs || []).map((run) => run.id));
    for (const runId of Array.from(pendingDeletedRunIds)) {
      if (!serverRunIds.has(runId)) {
        pendingDeletedRunIds.delete(runId);
      }
    }
    return reconcileQueuedMessages(nextState);
  }, []);

  useHomeLifecycle({ appUnlocked, setHasReceivedInitialEventStreamPayload, setState, setRuntimeErrors, routeReady, setRouteReady, authEnabled, authConfigurationError, pairTokenFromUrl, setPairTokenFromUrl, redeemPairMutation, pairRedeemAttempted, setPairRedeemAttempted, selectedRunId, setSelectedRunId, draftProjectPath, setDraftProjectPath, setSelectedConversationMode, setSelectedCliAgent, setSelectedModel, setSelectedEffort, setReadMarkers, readMarkers, collapsedProjectPaths, setCollapsedProjectPaths, leftSidebarWidth, setLeftSidebarWidth, rightSidebarWidth, setRightSidebarWidth, isResizingLeftSidebar, setIsResizingLeftSidebar, isResizingRightSidebar, setIsResizingRightSidebar, selectedConversationMode, selectedCliAgent, selectedModel, selectedEffort, themeMode, setThemeMode, filterEventStreamState });
  const isHydratingConversations = appUnlocked && !hasReceivedInitialEventStreamPayload;

  useEffect(() => {
    sideWindowManager.resetFileTabs();
    if (!selectedRunId) {
      setRightSidebarOpen(false);
      setMobileWorkersOpen(false);
    }
    setExpandedDirectMessageIds(new Set());
  }, [selectedRunId, setExpandedDirectMessageIds, setMobileWorkersOpen, setRightSidebarOpen]);

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
      const previousValue = apiKeys[key];
      setApiKeys((current) => ({ ...current, [key]: value }));
      settingsDraftManager.setField(key, value);
      return { key, previousValue };
    },
    onSuccess: ({ key, value }) => {
      settingsDraftManager.markFieldsSaved({ [key]: value });
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }
      const previousValue = context.previousValue ?? "";
      setApiKeys((current) => ({ ...current, [context.key]: previousValue }));
      settingsDraftManager.setField(context.key, previousValue);
    },
  });

  const renameRun = useMutation({
    mutationFn: async ({ runId, title }: { runId: string; title: string }) => {
      return requestJson(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }, {
        source: "Runs",
        action: "Rename",
      });
    },
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).map((run: RunRecord) =>
          run.id === variables.runId ? { ...run, title: variables.title } : run
        ),
      }));
      setRenamingRunId(null);
      setRenameValue("");
      setRenameSource(null);
    },
  });

  const deleteRun = useMutation({
    onMutate: (variables: { runId: string }) => {
      const previousState = state;
      const previousSelectedRunId = selectedRunId;
      const previousRenamingRunId = renamingRunId;
      const previousRenameValue = renameValue;
      const previousRenameSource = renameSource;
      const previousPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.get(variables.runId);
      const hadPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.has(variables.runId);

      pendingDeletedRunIdsRef.current.add(variables.runId);
      pendingCreatedConversationSnapshotsRef.current.delete(variables.runId);
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));

      if (selectedRunId === variables.runId) {
        setSelectedRunId(null);
      }
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
    mutationFn: async ({ runId }: { runId: string }) => {
      return requestJson(`/api/runs/${runId}`, {
        method: "DELETE",
      }, {
        source: "Runs",
        action: "Delete",
      });
    },
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }

      pendingDeletedRunIdsRef.current.delete(_variables.runId);
      if (context.hadPendingCreatedSnapshot && context.previousPendingCreatedSnapshot) {
        pendingCreatedConversationSnapshotsRef.current.set(_variables.runId, context.previousPendingCreatedSnapshot);
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
      const previousState = state;
      const previousSelectedRunId = selectedRunId;
      const previousRenamingRunId = renamingRunId;
      const previousRenameValue = renameValue;
      const previousRenameSource = renameSource;
      const previousPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.get(variables.runId);
      const hadPendingCreatedSnapshot = pendingCreatedConversationSnapshotsRef.current.has(variables.runId);

      pendingDeletedRunIdsRef.current.add(variables.runId);
      pendingCreatedConversationSnapshotsRef.current.delete(variables.runId);
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));

      if (selectedRunId === variables.runId) {
        setSelectedRunId(null);
      }
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
    mutationFn: async ({ runId }: { runId: string }) => {
      return requestJson(`/api/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      }, {
        source: "Runs",
        action: "Archive",
      });
    },
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => removeRunFromHomeState(current, variables.runId));
    },
    onError: (_error, variables, context) => {
      pendingDeletedRunIdsRef.current.delete(variables.runId);
      if (!context) {
        return;
      }

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
    mutationFn: async ({ runId, action, targetMessageId, content }: { runId: string; action: "retry" | "edit" | "fork"; targetMessageId: string; content?: string }) => {
      return requestJson<{ runId?: string }>(`/api/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetMessageId, content }),
      }, {
        source: "Runs",
        action: "Recover conversation",
      });
    },
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
      if (context?.previousState) {
        setState(context.previousState);
      }
    },
    onSuccess: (data) => {
      if (data.runId) {
        setSelectedRunId(data.runId);
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
    mutationFn: async (payload: { content: string; attachments: PendingChatAttachment[] }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      const uploadedAttachments = await uploadPendingChatAttachments(payload.attachments);
      return requestJson<({ runId?: string } & CreatedConversationSnapshot)>("/api/conversations", {
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
    mutationFn: async (payload: { runId: string; content: string; attachments: PendingChatAttachment[]; busyAction?: BusyMessageAction }) => {
      const uploadedAttachments = await uploadPendingChatAttachments(payload.attachments);
      return requestJson<{ ok: true; message?: MessageRecord; queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number] }>(`/api/conversations/${payload.runId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload.content, attachments: uploadedAttachments, busyAction: payload.busyAction }),
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
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => {
      return requestJson<{ ok: true }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
        method: "DELETE",
      }, {
        source: "Conversations",
        action: "Cancel queued message",
      });
    },
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
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => {
      return requestJson<{ ok: true; message?: MessageRecord; queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number] }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
        method: "PATCH",
      }, {
        source: "Conversations",
        action: "Send queued message now",
      });
    },
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
    mutationFn: async ({ runId, action }: { runId: string; action: ManualCommitAction }) => {
      return requestJson<{ ok: true; message?: MessageRecord }>(`/api/conversations/${runId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: getManualCommitPrompt(action) }),
      }, {
        source: "Conversations",
        action: "Commit chat",
      });
    },
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
      return requestJson<({ runId?: string } & CreatedConversationSnapshot)>("/api/conversations", {
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
    mutationFn: async ({ runId }: { runId: string }) => {
      return requestJson<{ ok: true }>(`/api/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop_supervisor" }),
      }, {
        source: "Runs",
        action: "Stop supervisor",
      });
    },
  });

  const stopWorker = useMutation({
    mutationFn: async ({ runId, workerId }: { runId: string; workerId: string }) => {
      return requestJson<{ ok: true }>(`/api/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop_worker", workerId }),
      }, {
        source: "Runs",
        action: "Stop worker",
      });
    },
  });

  const stopWorkerTerminalProcess = useMutation({
    mutationFn: async ({ runId, workerId, terminalProcess }: { runId: string; workerId: string; terminalProcess: WorkerTerminalProcess }) => {
      return requestJson<{ ok: true }>(`/api/runs/${runId}`, {
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
      });
    },
  });

  const promotePlanningConversation = useMutation({
    mutationFn: async (payload: { runId: string; planPath: string | null }) => {
      return requestJson<{ runId?: string }>(`/api/planning/${payload.runId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planPath: payload.planPath }),
      }, {
        source: "Planning",
        action: "Promote planning conversation",
      });
    },
    onSuccess: (data) => {
      if (data.runId) {
        setSelectedRunId(data.runId);
      }
    },
  });

  const handleStartNewPlan = () => {
    setSelectedRunId(null);
    setDraftProjectPath(null);
    setCommand("");
    clearAttachments();
    setMobileNavOpen(false);
  };

  const handleAddProject = (newPath: string) => {
    if (!explicitProjects.includes(newPath)) {
      const newProjects = [...explicitProjects, newPath];
      const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
      setApiKeys(updatedKeys);
      fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedKeys) });
    }
  };

  const handleRemoveProject = (pathToRemove: string) => {
    const newProjects = explicitProjects.filter((p: string) => p !== pathToRemove);
    const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
    setApiKeys(updatedKeys);
    fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedKeys) });
  };

  const autoCommitMilestonesEnabled = parseBooleanSetting(apiKeys[GIT_AUTO_COMMIT_MILESTONES_SETTING], false);
  const pushOnCommitEnabled = parseBooleanSetting(apiKeys[GIT_PUSH_ON_COMMIT_SETTING], false);

  const updateCommitWorkflowSetting = (key: string, value: boolean) => {
    commitWorkflowSettings.mutate({ key, value: serializeBooleanSetting(value) });
  };

  const handleManualCommitChat = (action: ManualCommitAction = pushOnCommitEnabled ? "commit-push" : "commit") => {
    if (!selectedRunId) {
      return;
    }

    autoCommitChat.mutate({ runId: selectedRunId, action });
  };

  const handleManualCommitProject = (projectPath: string, action: ManualCommitAction = "commit") => {
    autoCommitProject.mutate({ projectPath, action });
  };

  const beginConversationInProject = (projectPath: string) => {
    setSelectedRunId(null);
    setDraftProjectPath(projectPath);
    setCommand("");
    clearAttachments();
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(0, 0);
    });
  };

  const groupedProjects = buildConversationGroups({
    explicitProjects,
    plans: (state.plans || []) as PlanRecord[],
    runs: (state.runs || []) as RunRecord[],
  });

  const filteredProjects = groupedProjects.map((group: { path: string, name: string, runs: unknown[] }) => {
    if (!searchQuery) return group;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = (group.runs as any[]).filter((run: { path: string; title: string }) =>
      run.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...group, runs };
  }).filter((group: { name: string, runs: unknown[] }) => group.runs.length > 0 || group.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const handleCommitRenamingRun = (runId: string) => {
    const nextTitle = renameValue.trim().replace(/\s+/g, " ");
    const existingRun = (state.runs || []).find((run: RunRecord) => run.id === runId);
    if (!nextTitle || nextTitle === (existingRun?.title || "New conversation")) {
      handleCancelRenamingRun();
      return;
    }

    renameRun.mutate({ runId, title: nextTitle });
  };

  const handleDeleteRun = (run: SidebarRun) => {
    if (!window.confirm(`Delete "${run.title}"? This cannot be undone.`)) {
      return;
    }

    deleteRun.mutate({ runId: run.id });
  };

  const handleArchiveRun = (run: SidebarRun) => {
    archiveRun.mutate({ runId: run.id });
  };

  const runs = (state.runs || []) as RunRecord[];
  const plans = (state.plans || []) as PlanRecord[];
  const selectedRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null;
  const isSupervisorRunning = Boolean(selectedRun && selectedRun.mode === "implementation" && selectedRun.status === "running");
  const selectedRunMode: ConversationModeOption = selectedRun?.mode || "implementation";
  const isImplementationConversation = selectedRunMode === "implementation";
  const isPlanningConversation = selectedRunMode === "planning";
  const isDirectConversation = selectedRunMode === "direct";
  const activeComposerMode: ConversationModeOption = selectedRun ? selectedRunMode : selectedConversationMode;
  const catalogWorkers = useMemo(
    () => workerCatalogQuery.data?.workers ?? [],
    [workerCatalogQuery.data?.workers],
  );
  const availableWorkerTypes = useMemo(
    () => catalogWorkers
      .filter((worker) => worker.availability.status === "ok")
      .map((worker) => worker.type),
    [catalogWorkers],
  );
  const configuredAllowedWorkerTypes = useMemo(
    () => parseWorkerTypes(apiKeys.WORKER_ALLOWED_TYPES),
    [apiKeys.WORKER_ALLOWED_TYPES],
  );
  const selectedRunAllowedWorkerTypes = useMemo(
    () => selectedRun?.allowedWorkerTypes?.trim() ? parseWorkerTypes(selectedRun.allowedWorkerTypes) : [],
    [selectedRun?.allowedWorkerTypes],
  );
  const activeAllowedWorkerTypes = useMemo(() => {
    const configured = selectedRun ? selectedRunAllowedWorkerTypes : configuredAllowedWorkerTypes;
    if (availableWorkerTypes.length === 0) {
      return configured;
    }

    const availableSet = new Set(availableWorkerTypes);
    const filtered = configured.filter((type) => availableSet.has(type));
    return filtered.length > 0 ? filtered : [...availableWorkerTypes];
  }, [availableWorkerTypes, configuredAllowedWorkerTypes, selectedRun, selectedRunAllowedWorkerTypes]);
  const autoSelectedWorkerType = useMemo(() => {
    const normalizedDefaultWorkerType = parseWorkerType(apiKeys.WORKER_DEFAULT_TYPE);
    if (normalizedDefaultWorkerType && activeAllowedWorkerTypes.includes(normalizedDefaultWorkerType)) {
      return normalizedDefaultWorkerType;
    }

    return activeAllowedWorkerTypes[0] ?? null;
  }, [activeAllowedWorkerTypes, apiKeys.WORKER_DEFAULT_TYPE]);
  const shouldOfferAutoWorkerOption = activeComposerMode !== "direct";
  const composerWorkerOptions = useMemo(() => {
    const allowedSet = new Set(activeAllowedWorkerTypes);
    return shouldOfferAutoWorkerOption
      ? COMPOSER_WORKER_OPTIONS.filter((option) => option.value === "auto" || allowedSet.has(option.value))
      : WORKER_OPTIONS.filter((option) => allowedSet.has(option.value));
  }, [activeAllowedWorkerTypes, shouldOfferAutoWorkerOption]);
  const activeWorkerModelType = selectedCliAgent === "auto"
    ? autoSelectedWorkerType ?? activeAllowedWorkerTypes[0] ?? "codex"
    : selectedCliAgent;
  const activeWorkerModelOptions = useMemo(
    () => getWorkerModelOptions(workerCatalogQuery.data?.workerModels, activeWorkerModelType),
    [activeWorkerModelType, workerCatalogQuery.data?.workerModels],
  );
  const settingsWorkers = useMemo(() => {
    if (catalogWorkers.length > 0) {
      return catalogWorkers;
    }

    return WORKER_OPTIONS.map((option) => ({
      type: option.value,
      label: option.label,
      installation: {
        command: option.value,
        path: null,
        dir: null,
      },
      availability: {
        status: "warning" as const,
        binary: false,
        apiKey: null,
        endpoint: null,
        message: "Worker availability has not loaded yet.",
      },
    }));
  }, [catalogWorkers]);
  const selectedRunMessages = useMemo(
    () => (selectedRunId
      ? state.messages?.filter((m: { runId: string }) => m.runId === selectedRunId)
      : []),
    [selectedRunId, state.messages],
  );
  const transcriptRunIds = useMemo(
    () => new Set(getConversationTranscriptRunIds({ selectedRunId, selectedRun })),
    [selectedRun, selectedRunId],
  );
  const filteredMessages = useMemo(() => {
    const messages = selectedRunId
      ? ((state.messages || []) as MessageRecord[]).filter((message) => transcriptRunIds.has(message.runId))
      : [];

    return filterPromotedPlanningTranscriptMessages({
      messages,
      selectedRun,
    });
  }, [selectedRun, selectedRunId, state.messages, transcriptRunIds]);

  useEffect(() => {
    if (activeWorkerModelOptions.length === 0) {
      return;
    }

    const resolvedSelectedModel = resolveSelectedWorkerModel(activeWorkerModelType, selectedModel);
    if (activeWorkerModelOptions.some((option) => option.value === resolvedSelectedModel)) {
      if (resolvedSelectedModel !== selectedModel) {
        setSelectedModel(resolvedSelectedModel);
      }
      return;
    }

    setSelectedModel(activeWorkerModelOptions[0].value);
  }, [activeWorkerModelOptions, activeWorkerModelType, selectedModel, setSelectedModel]);

  const selectedRunWorkers = useMemo(() => {
    if (!selectedRunId || !state.workers) {
      return [] as ConversationWorkerRecord[];
    }

    return (state.workers || []).filter((worker: ConversationWorkerRecord) => worker.runId === selectedRunId);
  }, [selectedRunId, state.workers]);
  const conversationAgents = useMemo(() => {
    const liveAgentsById = new Map(
      ((state.agents || []) as AgentSnapshot[]).map((agent) => [agent.name, agent]),
    );

    return selectedRunWorkers.map((worker) => {
      const liveAgent = liveAgentsById.get(worker.id);
      return liveAgent ?? {
        name: worker.id,
        type: worker.type,
        state: worker.status,
        currentText: "",
        lastText: "",
      };
    });
  }, [selectedRunWorkers, state.agents]);
  const selectedRunWorkersForDisplay = useMemo(
    () => mergeWorkerLiveStatus(selectedRunWorkers, conversationAgents),
    [conversationAgents, selectedRunWorkers],
  );
  useEffect(() => {
    if (selectedRunId && isImplementationConversation && selectedRunWorkersForDisplay.length > 0) {
      setRightSidebarOpen(true);
    }
  }, [isImplementationConversation, selectedRunId, selectedRunWorkersForDisplay.length, setRightSidebarOpen]);
  const primaryConversationAgent = useMemo(() => {
    return selectPrimaryConversationAgent(conversationAgents, isDirectConversation);
  }, [conversationAgents, isDirectConversation]);
  const conversationWorkerGroups = useMemo(
    () => buildWorkerLists(selectedRunWorkersForDisplay),
    [selectedRunWorkersForDisplay],
  );
  const activeConversationWorkerIds = useMemo(
    () => new Set(conversationWorkerGroups.active.map((worker) => worker.id)),
    [conversationWorkerGroups.active],
  );
  const activeConversationAgents = useMemo(
    () => conversationAgents.filter((agent) => activeConversationWorkerIds.has(agent.name)),
    [activeConversationWorkerIds, conversationAgents],
  );
  const busyConversationWorkerId = !isImplementationConversation
    ? conversationWorkerGroups.active.find((worker) => {
        const status = normalizeWorkerStatus(worker.status);
        return status === "starting" || status === "working" || status === "stuck";
      })?.id ?? null
    : null;
  const pendingConversationWorkerId = !isImplementationConversation && sendConversationMessage.isPending
    ? selectedRunWorkersForDisplay[0]?.id ?? null
    : null;
  const stoppableConversationWorkerId = busyConversationWorkerId ?? pendingConversationWorkerId;
  const isConversationStoppable = isSupervisorRunning || Boolean(stoppableConversationWorkerId);
  const latestUserCheckpoint = selectedRunId
    ? [...((selectedRunMessages || []) as MessageRecord[])]
        .filter((message) => message.role === "user")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    : null;
  const { selectedRecoveryState, selectedRecoveryIncidents } = useRunRecoveryState({
    state,
    selectedRunId,
  });
  const liveThoughts = useMemo(() => {
    const seen = new Set<string>();

    return activeConversationAgents
      .map((agent) => {
        const rawThought = agent.currentText?.trim() || agent.lastText?.trim() || "";
        const snippet = summarizeThought(rawThought);
        if (!snippet) {
          return null;
        }

        const key = `${agent.name}:${snippet}`;
        if (seen.has(key)) {
          return null;
        }
        seen.add(key);

        return {
          agentName: agent.name,
          snippet,
          isLive: Boolean(agent.currentText?.trim()),
        };
      })
      .filter((thought): thought is { agentName: string; snippet: string; isLive: boolean } => Boolean(thought))
      .slice(0, 3);
  }, [activeConversationAgents]);
  const selectedRunExecutionEvents = useMemo(() => (
    ((state.executionEvents || []) as ExecutionEventRecord[])
      .filter((event) => event.runId === selectedRunId)
      .filter(shouldShowExecutionEventInRunLog)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  ), [selectedRunId, state.executionEvents]);
  const selectedRunSupervisorInterventions = useMemo(() => (
    ((state.supervisorInterventions || []) as SupervisorInterventionRecord[])
      .filter((intervention) => intervention.runId === selectedRunId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  ), [selectedRunId, state.supervisorInterventions]);
  const latestExecutionEvent = selectedRunExecutionEvents[0] ?? null;
  const completionEvent = selectedRunExecutionEvents.find((event) => event.eventType === "run_completed") ?? null;
  const failedWorkerAvailability = useMemo(() => {
    if (!selectedRun || selectedRun.status !== "failed") {
      return null;
    }

    const candidateTypes = [
      parseWorkerType(selectedRun.preferredWorkerType),
      ...selectedRunAllowedWorkerTypes,
    ].filter((type, index, values): type is WorkerType => Boolean(type) && values.indexOf(type) === index);

    for (const type of candidateTypes) {
      const worker = catalogWorkers.find((entry) => entry.type === type);
      if (worker) {
        return worker;
      }
    }

    return null;
  }, [catalogWorkers, selectedRun, selectedRunAllowedWorkerTypes]);
  const workerFailureDetail = useMemo(
    () => extractWorkerFailureDetail((selectedRunMessages || []) as MessageRecord[]),
    [selectedRunMessages],
  );

  useEffect(() => {
    if (
      !selectedRunId
      || !selectedRun
      || (!isImplementationConversation && !isDirectConversation)
      || selectedRun.status !== "failed"
      || failedWorkerAvailability?.availability.status !== "ok"
      || workerFailureDetail
      || !latestUserCheckpoint
      || recoverRun.isPending
    ) {
      return;
    }

    const resumeKey = `${selectedRun.id}:${selectedRun.failedAt ?? ""}:${selectedRun.lastError ?? ""}`;
    if (autoResumeRunKeysRef.current.has(resumeKey)) {
      return;
    }

    autoResumeRunKeysRef.current.add(resumeKey);
    recoverRun.mutate({
      runId: selectedRunId,
      action: "retry",
      targetMessageId: latestUserCheckpoint.id,
    });
  }, [
    failedWorkerAvailability?.availability.status,
    isDirectConversation,
    isImplementationConversation,
    latestUserCheckpoint,
    recoverRun,
    selectedRun,
    selectedRunId,
    workerFailureDetail,
  ]);

  const conversationFailure = useMemo(() => {
    if (!selectedRun || selectedRun.status !== "failed" || !selectedRun.lastError) {
      return null;
    }

    const staleFailure = failedWorkerAvailability?.availability.status === "ok";
    const workerLabel = failedWorkerAvailability?.label;
    const workerStatus = failedWorkerAvailability?.availability.message;

    return {
      tone: workerFailureDetail ? "warning" : staleFailure ? "success" : "error",
      action: workerFailureDetail ? "Worker setup" : staleFailure ? "Reconnecting" : "Run failed",
      message: workerFailureDetail || (staleFailure
        ? `Reconnecting to ${workerLabel || "worker"}.`
        : stripRunFailurePrefix(selectedRun.lastError)),
      suggestion: workerFailureDetail
        ? "Update the model or account, then resume."
        : staleFailure
        ? undefined
        : "Fix the worker runtime, then reconnect to the existing worker session.",
      details: staleFailure ? [] : workerLabel && workerStatus ? [`Current ${workerLabel} status: ${workerStatus}`] : [],
    } satisfies NoticeDescriptor;
  }, [failedWorkerAvailability, selectedRun, workerFailureDetail]);
  const visibleMessages = useMemo(() => {
    const messages = (filteredMessages || []) as MessageRecord[];
    return messages.filter(shouldRenderMessageInMainConversation);
  }, [filteredMessages]);
  const conversationTimelineItems = useMemo(() => buildConversationTimelineItems({
    messages: visibleMessages,
    executionEvents: selectedRunExecutionEvents,
    supervisorInterventions: selectedRunSupervisorInterventions,
    workers: selectedRunWorkersForDisplay,
    runMode: selectedRun?.mode ?? null,
  }), [selectedRun?.mode, selectedRunExecutionEvents, selectedRunSupervisorInterventions, selectedRunWorkersForDisplay, visibleMessages]);
  const conversationTimelineActivityCount = conversationTimelineItems.filter((item) => item.type === "activity").length;
  const directConversationMessages = useMemo(() => {
    if (!isDirectConversation) {
      return [] as WorkerTerminalUserMessage[];
    }

    return buildDirectTerminalUserMessages({
      messages: (filteredMessages || []) as MessageRecord[],
      agent: primaryConversationAgent,
    });
  }, [filteredMessages, isDirectConversation, primaryConversationAgent]);
  const pendingPermissionAgent = activeConversationAgents.find((agent) => (agent.pendingPermissions?.length ?? 0) > 0) ?? null;
  const erroredAgent = activeConversationAgents.find((agent) => {
    if (agent.state === "error") {
      return true;
    }

    const active = isWorkerActiveStatus(agent.state) || Boolean(agent.currentText?.trim());
    return !active && Boolean(agent.lastError);
  }) ?? null;
  const latestWaitEvent = selectedRunExecutionEvents.find((event) => event.eventType === "supervisor_wait") ?? null;
  const latestPromptDeferredEvent = selectedRunExecutionEvents.find((event) => event.eventType === "worker_prompt_deferred") ?? null;
  const latestStuckEvent = getLatestUnresolvedWorkerStuckEvent(selectedRunExecutionEvents);
  const hasStuckWorker = conversationWorkerGroups.active.some((worker) => worker.status === "stuck")
    || activeConversationAgents.some((agent) => agent.state === "stuck")
    || Boolean(latestStuckEvent);
  const hasActiveWorker = activeConversationAgents.some((agent) => (
    isWorkerActiveStatus(agent.state)
    || Boolean(agent.currentText?.trim())
  ));
  const showRecoverableRunningState = shouldShowRecoverableRunningState({
    selectedRun,
    latestUserCheckpoint,
    hasPendingPermission: Boolean(pendingPermissionAgent),
    hasActiveWorker,
    hasStuckWorker,
    activeWorkerCount: conversationWorkerGroups.active.length,
    latestExecutionEventCreatedAt: latestExecutionEvent?.createdAt,
  });
  const { liveExecutionStatus } = useConversationExecutionStatus({
    selectedRun,
    latestExecutionEvent,
    erroredAgent,
    pendingPermissionAgent,
    hasStuckWorker,
    latestStuckEvent,
    showRecoverableRunningState,
    latestWaitEvent,
    latestPromptDeferredEvent,
    completionEvent,
    queuedMessageCount: busyMessageQueueState.queuedMessages.filter((message) => message.runId === selectedRunId && (message.status === "pending" || message.status === "delivering")).length,
    activeConversationAgents,
    liveThoughts,
  });

  const isConversationThinking = hasActiveWorker
    || Boolean(pendingPermissionAgent)
    || hasStuckWorker
    || showRecoverableRunningState
    || Boolean(latestPromptDeferredEvent)
    || selectedRun?.status === "awaiting_user"
    || selectedRun?.status === "failed";
  const showConversationExecution = shouldShowConversationExecutionPanel({
    selectedRun,
    isConversationThinking,
    executionEventCount: conversationTimelineActivityCount,
  });

  const currentProjectScope = resolveProjectScope({
    draftProjectPath,
    selectedRunId,
    plans,
    runs,
    explicitProjects,
  });
  const workspaceSideWindowAvailable = Boolean(selectedRunId || draftProjectPath) && Boolean(currentProjectScope);
  const welcomeRepoName = resolveRepoName(currentProjectScope);

  const projectFilesQuery = useQuery<ProjectFilesResponse>({
    queryKey: ["project-files", currentProjectScope],
    queryFn: async () => {
      return requestJson<ProjectFilesResponse>(`/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`, undefined, {
        source: "Filesystem",
        action: "Load project files",
      });
    },
    enabled: Boolean(currentProjectScope),
    staleTime: 60_000,
  });

  const activePlan = selectedRunId && runs.length && plans.length
    ? plans.find((p) => p.id === runs.find((r) => r.id === selectedRunId)?.planId) ?? null
    : null;
  const activeConversationCwd = selectedRun?.projectPath || activePlan?.path || draftProjectPath || null;
  const appErrors = useAppErrors({ state, runtimeErrors, projectFilesError: projectFilesQuery.error, settingsError: settingsQuery.error, commitWorkflowSettingsError: commitWorkflowSettings.error, runCommandError: runCommand.error, sendConversationMessageError: sendConversationMessage.error, cancelQueuedMessageError: cancelQueuedMessage.error, autoCommitChatError: autoCommitChat.error, autoCommitProjectError: autoCommitProject.error, recoverRunError: recoverRun.error, renameRunError: renameRun.error, archiveRunError: archiveRun.error, deleteRunError: deleteRun.error, stopSupervisorError: stopSupervisor.error, stopWorkerError: stopWorker.error ?? stopWorkerTerminalProcess.error });

  useRunSelectionEffects({ scrollRef, state, selectedRunId, selectedRun, activeComposerMode, selectedCliAgent, setSelectedCliAgent, autoSelectedWorkerType, activeAllowedWorkerTypes, hydratedRunSelectionId, setHydratedRunSelectionId, selectedModel, setSelectedModel, selectedEffort, setSelectedEffort, availableWorkerTypes, configuredAllowedWorkerTypes, apiKeys, setApiKeys, setReadMarkers });

  const handleOpenProjectFile = useCallback((filePathOrReference: string | ProjectFileReference) => {
    const file = typeof filePathOrReference === "string"
      ? currentProjectScope
        ? { root: currentProjectScope, relativePath: filePathOrReference }
        : null
      : filePathOrReference;

    if (!file?.root || !file.relativePath) {
      return;
    }

    sideWindowManager.openFile(file);
    if (shouldOpenMobileSideWindow()) {
      setMobileWorkersOpen(true);
      return;
    }

    setRightSidebarOpen(true);
  }, [currentProjectScope, setMobileWorkersOpen, setRightSidebarOpen]);

  const handleEditQueuedMessage = (message: QueuedConversationMessageRecord) => {
    const nextCommand = message.content;
    setCommand(nextCommand);
    setCommandCursor(nextCommand.length);
    clearAttachments();
    cancelQueuedMessage.mutate({ runId: message.runId, messageId: message.id });
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(nextCommand.length, nextCommand.length);
    });
  };

  const isStopConversationPending = stopSupervisor.isPending || stopWorker.isPending;
  const isComposerSubmitting = runCommand.isPending || sendConversationMessage.isPending || sendQueuedMessageNow.isPending || promotePlanningConversation.isPending || isStopConversationPending;
  const busyMessageAction = parseBusyMessageAction(apiKeys.BUSY_MESSAGE_ACTION);
  const hasBusyConversation = isSupervisorRunning || Boolean(stoppableConversationWorkerId);
  const lockedDirectWorkerLabel = WORKER_OPTIONS.find((option) => option.value === (selectedCliAgent === "auto" ? autoSelectedWorkerType : selectedCliAgent))?.label
    || WORKER_OPTIONS.find((option) => option.value === autoSelectedWorkerType)?.label
    || "Direct worker";
  const shouldLockDirectWorker = Boolean(selectedRunId) && activeComposerMode === "direct";
  const showDirectControlWorkingIndicator = isDirectConversation && hasBusyConversation;

  const handleRetryMessage = (messageId: string) => {
    if (!selectedRunId) return;
    recoverRun.mutate({ runId: selectedRunId, action: "retry", targetMessageId: messageId });
  };

  const handleResumeRunRecovery = () => {
    if (!selectedRunId) return;
    resumeRunRecovery.mutate({ runId: selectedRunId });
  };

  function toggleDirectMessageExpansion(messageId: string) {
    setExpandedDirectMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }

  const handleStartEditingMessage = (message: Pick<MessageRecord, "id" | "content">) => {
    setEditingMessageId(message.id);
    setEditingMessageValue(message.content);
  };

  const handleCancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingMessageValue("");
  };

  const handleSaveEditedMessage = (messageId: string) => {
    if (!selectedRunId) return;
    const content = editingMessageValue.trim();
    if (!content) return;
    setEditingMessageId(null);
    setEditingMessageValue("");
    recoverRun.mutate(
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
    recoverRun.mutate({ runId: selectedRunId, action: "fork", targetMessageId: message.id, content });
  };

  const handleLoadWorkerHistory = useCallback(async (workerId: string) => {
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
        const agentsByName = new Map((current.agents || []).map((candidate: AgentSnapshot) => [candidate.name, candidate]));
        agentsByName.set(agent.name, agent);
        return {
          ...current,
          agents: Array.from(agentsByName.values()),
        };
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
  }, [setRuntimeErrors, setState]);

  const handleLeftSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingLeftSidebar(true);
  };

  const handleRightSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingRightSidebar(true);
  };

  const handleProjectOpenChange = (projectPath: string, open: boolean) => {
    setCollapsedProjectPaths((current) => {
      const next = new Set(current);
      if (open) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });
  };


  const renderComposer = (className: string) => (
<ComposerContainer
          className={className}
          commandInputRef={commandInputRef}
          selectedRunId={selectedRunId}
          selectedConversationMode={activeComposerMode}
          setSelectedConversationMode={setSelectedConversationMode}
          currentProjectScope={currentProjectScope}
          projectFiles={projectFilesQuery.data?.files ?? []}
          projectFilesIsFetched={projectFilesQuery.isFetched}
          onOpenProjectFile={handleOpenProjectFile}
          themeMode={themeMode}
          shouldLockDirectWorker={shouldLockDirectWorker}
          lockedDirectWorkerLabel={lockedDirectWorkerLabel}
          selectedCliAgent={selectedCliAgent}
          setSelectedCliAgent={setSelectedCliAgent}
          composerWorkerOptions={composerWorkerOptions}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          activeWorkerModelOptions={activeWorkerModelOptions}
          selectedEffort={selectedEffort}
          setSelectedEffort={setSelectedEffort}
          isComposerSubmitting={isComposerSubmitting}
          isStopConversationPending={isStopConversationPending}
          isConversationStoppable={isConversationStoppable}
          hasBusyConversation={hasBusyConversation}
          busyMessageAction={busyMessageAction}
          queuedMessages={busyMessageQueueState.queuedMessages}
          cancellingQueuedMessageIds={busyMessageQueueState.cancellingMessageIds}
          onEditQueuedMessage={handleEditQueuedMessage}
          onSendQueuedMessageNow={(messageId) => {
            if (selectedRunId) {
              sendQueuedMessageNow.mutate({ runId: selectedRunId, messageId });
            }
          }}
          onCancelQueuedMessage={(messageId) => {
            if (selectedRunId) {
              cancelQueuedMessage.mutate({ runId: selectedRunId, messageId });
            }
          }}
          onSendConversationMessage={(content, attachments, busyAction) => {
            if (selectedRunId) {
              sendConversationMessage.mutate({ runId: selectedRunId, content, attachments, busyAction });
            }
          }}
          onRunCommand={(content, attachments) => runCommand.mutate({ content, attachments })}
          onStopConversation={() => {
            if (!selectedRunId || isStopConversationPending) {
              return;
            }

            if (isSupervisorRunning) {
              stopSupervisor.mutate({ runId: selectedRunId });
              return;
            }

            if (stoppableConversationWorkerId) {
              stopWorker.mutate({ runId: selectedRunId, workerId: stoppableConversationWorkerId });
            }
          }}
        />
  );

  if (!routeReady || sessionQuery.isLoading || (authEnabled && !appUnlocked && Boolean(pairTokenFromUrl) && redeemPairMutation.isPending)) {
    return <BootShell />;
  }

  if (authEnabled && !appUnlocked) {
    return (
      <LoginShell
        configurationError={authConfigurationError}
        error={authError}
        isSubmitting={loginMutation.isPending}
        isRedeemingPair={Boolean(pairTokenFromUrl) && !authConfigurationError && !pairRedeemError}
        pairError={pairRedeemError}
        onSubmit={async (password) => {
          setAuthError(null);
          await loginMutation.mutateAsync(password);
        }}
      />
    );
  }

  const sharedSidebarProps = {
    filteredProjects: filteredProjects as SidebarGroup[],
    isHydratingConversations,
    searchQuery,
    setSearchQuery,
    selectedRunId,
    messages: state.messages,
    readMarkers,
    collapsedProjectPaths,
    onProjectOpenChange: handleProjectOpenChange,
    setShowSettings,
    openFolderPicker: () => setShowFolderPicker(true),
    startNewPlan: handleStartNewPlan,
    beginConversationInProject,
    autoCommitProject: handleManualCommitProject,
    isAutoCommitProjectPending: autoCommitProject.isPending,
    handleRemoveProject,
    selectRun: handleSelectRun,
    renamingRunId,
    renameValue,
    renameSource,
    setRenameValue,
    startRenamingRun: handleStartRenamingRun,
    commitRenamingRun: handleCommitRenamingRun,
    cancelRenamingRun: handleCancelRenamingRun,
    archiveRun: handleArchiveRun,
    deleteRun: handleDeleteRun,
    authEnabled,
    openPairDeviceDialog: () => setShowPairDeviceDialog(true),
    logout: () => logoutMutation.mutate(),
  };

  return (
    <div className="omni-app-text-scale flex h-dvh w-full overflow-hidden bg-background text-foreground lg:h-screen" style={appearanceTextSizeStyle}>
      <div
        className={`relative z-30 hidden h-full shrink-0 overflow-hidden border-r bg-background transition-[width,opacity] duration-150 ease-out lg:flex motion-reduce:transition-none ${leftSidebarOpen ? "border-border opacity-100" : "pointer-events-none border-transparent opacity-0"}`}
        style={{ width: leftSidebarOpen ? leftSidebarWidth : 0 }}
        aria-hidden={!leftSidebarOpen}
        inert={!leftSidebarOpen ? true : undefined}
      >
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-10 w-3 translate-x-1/2 cursor-col-resize bg-transparent"
          aria-label="Resize conversations sidebar"
          onPointerDown={handleLeftSidebarResizeStart}
        />
        <div className={`flex h-full min-w-0 flex-1 transition-transform duration-150 ease-out motion-reduce:transition-none ${leftSidebarOpen ? "translate-x-0" : "-translate-x-3"}`}>
          <ConversationSidebar {...sharedSidebarProps} onCollapse={() => setLeftSidebarOpen(false)} />
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <HomeHeader
          {...sharedSidebarProps}
          startRenamingRun={handleStartTopBarRenamingRun}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          leftSidebarOpen={leftSidebarOpen}
          setLeftSidebarOpen={setLeftSidebarOpen}
          activeConversationCwd={activeConversationCwd}
          selectedRun={selectedRun}
          isImplementationConversation={isImplementationConversation}
          workspaceSideWindowAvailable={workspaceSideWindowAvailable}
          projectRoot={currentProjectScope}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          rightSidebarOpen={rightSidebarOpen}
          setRightSidebarOpen={setRightSidebarOpen}
          mobileWorkersOpen={mobileWorkersOpen}
          setMobileWorkersOpen={setMobileWorkersOpen}
          selectedRunWorkers={selectedRunWorkersForDisplay}
          conversationAgents={conversationAgents}
          supervisorInterventions={selectedRunSupervisorInterventions}
          onCommitNow={() => handleManualCommitChat("commit")}
          onCommitAndPushNow={() => handleManualCommitChat("commit-push")}
          onPrimaryCommit={() => handleManualCommitChat()}
          autoCommitMilestonesEnabled={autoCommitMilestonesEnabled}
          pushOnCommitEnabled={pushOnCommitEnabled}
          onAutoCommitMilestonesChange={(checked) => updateCommitWorkflowSetting(GIT_AUTO_COMMIT_MILESTONES_SETTING, checked)}
          onPushOnCommitChange={(checked) => updateCommitWorkflowSetting(GIT_PUSH_ON_COMMIT_SETTING, checked)}
          isAutoCommitChatPending={autoCommitChat.isPending}
          notificationState={notificationState}
          onEnableNotifications={enableNotifications}
          onDisableNotifications={disableNotifications}
          onStopWorker={(workerId) => {
            if (selectedRunId) {
              stopWorker.mutate({ runId: selectedRunId, workerId });
            }
          }}
          onStopTerminalProcess={(workerId, terminalProcess) => {
            if (selectedRunId && terminalProcess.processId) {
              stopWorkerTerminalProcess.mutate({ runId: selectedRunId, workerId, terminalProcess });
            }
          }}
          onLoadWorkerHistory={handleLoadWorkerHistory}
          stoppingWorkerId={stopWorker.variables?.workerId ?? null}
          stoppingTerminalProcess={stopWorkerTerminalProcess.variables ? {
            workerId: stopWorkerTerminalProcess.variables.workerId,
            terminalProcessId: stopWorkerTerminalProcess.variables.terminalProcess.id,
          } : null}
        />

        <ConversationMain
          scrollRef={scrollRef}
          selectedRunId={selectedRunId}
          selectedRun={selectedRun}
          welcomeRepoName={welcomeRepoName}
          isDirectConversation={isDirectConversation}
          isPlanningConversation={isPlanningConversation}
          isImplementationConversation={isImplementationConversation}
          appErrors={appErrors}
          conversationFailure={conversationFailure}
          directConversationMessages={directConversationMessages}
          expandedDirectMessageIds={expandedDirectMessageIds}
          toggleDirectMessageExpansion={toggleDirectMessageExpansion}
          primaryConversationAgent={primaryConversationAgent}
          promotePlanningConversation={promotePlanningConversation}
          conversationTimelineItems={conversationTimelineItems}
          recoverRun={recoverRun}
          recoveryState={selectedRecoveryState}
          recoveryIncidents={selectedRecoveryIncidents}
          resumeRunRecovery={resumeRunRecovery}
          showRecoverableRunningState={showRecoverableRunningState}
          hasStuckWorker={hasStuckWorker}
          latestUserCheckpoint={latestUserCheckpoint}
          handleRetryMessage={handleRetryMessage}
          handleResumeRunRecovery={handleResumeRunRecovery}
          handleStartEditingMessage={handleStartEditingMessage}
          handleForkMessage={handleForkMessage}
          editingMessageId={editingMessageId}
          editingMessageValue={editingMessageValue}
          setEditingMessageValue={setEditingMessageValue}
          handleCancelEditingMessage={handleCancelEditingMessage}
          handleSaveEditedMessage={handleSaveEditedMessage}
          conversationAgents={conversationAgents}
          showDirectControlWorkingIndicator={showDirectControlWorkingIndicator}
          showConversationExecution={showConversationExecution}
          liveExecutionStatus={liveExecutionStatus}
          liveThoughts={liveThoughts}
          executionEvents={selectedRunExecutionEvents}
          cliSetupWorkers={catalogWorkers}
          onOpenAgentSettings={() => {
            setActiveSettingsTab("agents");
            setShowSettings(true);
          }}
          emptyComposer={renderComposer("mt-2 w-full pt-0 sm:pt-0")}
          projectRoot={currentProjectScope}
          onOpenProjectFile={handleOpenProjectFile}
        />

        {selectedRunId ? renderComposer("w-full") : null}
      </div>

      {workspaceSideWindowAvailable ? (
        <div
          className={`relative hidden h-full shrink-0 overflow-hidden border-l bg-background transition-[width,opacity] duration-150 ease-out lg:flex motion-reduce:transition-none ${rightSidebarOpen ? "border-border opacity-100" : "pointer-events-none border-transparent opacity-0"}`}
          style={{ width: rightSidebarOpen ? rightSidebarWidth : 0 }}
          aria-hidden={!rightSidebarOpen}
          inert={!rightSidebarOpen ? true : undefined}
        >
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize bg-transparent"
            aria-label="Resize workspace side window"
            onPointerDown={handleRightSidebarResizeStart}
          />
          <div className={`flex h-full min-w-0 flex-1 pl-2 transition-transform duration-150 ease-out motion-reduce:transition-none ${rightSidebarOpen ? "translate-x-0" : "translate-x-3"}`}>
            <SideWindow
              projectRoot={currentProjectScope}
              workers={selectedRunId && isImplementationConversation ? selectedRunWorkersForDisplay : []}
              agents={selectedRunId && isImplementationConversation ? conversationAgents : []}
              supervisorInterventions={selectedRunId && isImplementationConversation ? selectedRunSupervisorInterventions : []}
              preferredModel={selectedRun?.preferredWorkerModel ?? null}
              preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
              onStopWorker={(workerId) => {
                if (selectedRunId) {
                  stopWorker.mutate({ runId: selectedRunId, workerId });
                }
              }}
              onStopTerminalProcess={(workerId, terminalProcess) => {
                if (selectedRunId && terminalProcess.processId) {
                  stopWorkerTerminalProcess.mutate({ runId: selectedRunId, workerId, terminalProcess });
                }
              }}
              onLoadWorkerHistory={handleLoadWorkerHistory}
              stoppingWorkerId={stopWorker.variables?.workerId ?? null}
              stoppingTerminalProcess={stopWorkerTerminalProcess.variables ? {
                workerId: stopWorkerTerminalProcess.variables.workerId,
                terminalProcessId: stopWorkerTerminalProcess.variables.terminalProcess.id,
              } : null}
              onCloseWindow={() => setRightSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        activeSettingsTab={activeSettingsTab}
        setActiveSettingsTab={setActiveSettingsTab}
        activeLlmProfileTab={activeLlmProfileTab}
        setActiveLlmProfileTab={setActiveLlmProfileTab}
        settingsDraft={settingsDraft}
        setSetting={(key, value) => settingsDraftManager.setField(key, value)}
        discardSettingsDraft={() => settingsDraftManager.discardDraft()}
        secretStates={settingsQuery.data?.secrets}
        settingsWorkers={settingsWorkers}
        workerCatalogQuery={workerCatalogQuery}
        settingsDiagnostics={settingsDiagnostics}
        saveSettings={saveSettings}
      />

      <PairDeviceDialog
        open={showPairDeviceDialog}
        onOpenChange={setShowPairDeviceDialog}
        selectedRunId={selectedRunId}
        publicOrigin={sessionQuery.data?.publicOrigin ?? null}
        availabilityError={pairDeviceAvailabilityError}
      />

      <FolderPickerDialog
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onSelect={handleAddProject}
      />

      <AttachmentImagePreviewDialog />
    </div>
  );
}
