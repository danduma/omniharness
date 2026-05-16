"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { BootShell } from "@/components/BootShell";
import { LoginShell } from "@/components/LoginShell";
import { AttachmentImagePreviewDialog } from "@/components/AttachmentImagePreviewDialog";
import { ConversationMain } from "@/components/home/ConversationMain";
import { ConversationSidebar } from "@/components/home/ConversationSidebar";
import { HomeHeader } from "@/components/home/HomeHeader";
import { resolveProjectScope } from "@/lib/project-scope";
import { WORKER_OPTIONS } from "./constants";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { conversationNotificationManager } from "./ConversationNotificationManager";
import { sideWindowManager } from "./SideWindowManager";
import { parseBusyMessageAction } from "./busy-message-behavior";
import { EventStreamStateManager } from "./EventStreamStateManager";
import {
  homeUiSetters,
  homeUiStateManager,
  INITIAL_EVENT_STREAM_STATE,
  type HomeUiState,
} from "./HomeUiStateManager";
import { appearancePreferencesManager, getAppearanceTextSizeStyle } from "./AppearancePreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
import { preflightConfirmationActionsManager } from "./PreflightConfirmationActionsManager";
import {
  filterOptimisticallyDeletedRuns,
  mergePendingCreatedConversationSnapshots,
  mergePendingSentConversationMessages,
  parseProjectList,
  resolveRepoName,
  resolveSelectedWorkerModel,
  stripRunFailurePrefix,
  type CreatedConversationSnapshot,
} from "./utils";
import { useAppErrors } from "./useAppErrors";
import { useConversationExecutionStatus } from "./useConversationExecutionStatus";
import { useHomeLifecycle } from "./useHomeLifecycle";
import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { useRunRecoveryState } from "./useRunRecoveryState";
import { useRunSelectionEffects } from "./useRunSelectionEffects";
import type { EventStreamState, MessageRecord, SidebarGroup } from "./types";
import type { HomeBootstrapPayload } from "./bootstrap.server";
import { useHomeQueries } from "./useHomeQueries";
import { useHomeViewModel } from "./useHomeViewModel";
import { useHomeMutations } from "./useHomeMutations";
import { useConversationActions } from "./useConversationActions";
import { useHomeLayoutController } from "./useHomeLayoutController";
import { ComposerContainer } from "./ComposerContainer";
import { t } from "@/lib/i18n";
import { StateManager } from "@/lib/state-manager";

const FolderPickerDialog = dynamic(
  () => import("@/components/FolderPickerDialog").then((m) => m.FolderPickerDialog),
  { ssr: false },
);
const PairDeviceDialog = dynamic(
  () => import("@/components/PairDeviceDialog").then((m) => m.PairDeviceDialog),
  { ssr: false },
);
const SettingsDialog = dynamic(
  () => import("@/components/home/SettingsDialog").then((m) => m.SettingsDialog),
  { ssr: false },
);
const OnboardingSetupDialog = dynamic(
  () => import("@/components/home/OnboardingSetupDialog").then((m) => m.OnboardingSetupDialog),
  { ssr: false },
);
const SideWindow = dynamic(
  () => import("@/components/home/SideWindow").then((m) => m.SideWindow),
  { ssr: false },
);

const ONBOARDING_SEEN_STORAGE_KEY = "omni.onboarding.seen";
let appliedHomeBootstrapId: string | null = null;

class AutoResumeExhaustionManager extends StateManager<Set<string>> {
  constructor() {
    super(new Set());
  }

  clear(runId: string) {
    this.update((current) => {
      if (!current.has(runId)) return current;
      const next = new Set(current);
      next.delete(runId);
      return next;
    });
  }

  mark(runId: string) {
    this.update((current) => {
      if (current.has(runId)) return current;
      return new Set(current).add(runId);
    });
  }
}

const autoResumeExhaustionManager = new AutoResumeExhaustionManager();

type HomeAppState = Omit<HomeUiState, "command" | "commandCursor" | "mentionIndex" | "attachments">;

function selectHomeAppState(state: HomeUiState): HomeAppState {
  const s: Partial<HomeUiState> = { ...state };
  delete s.command;
  delete s.commandCursor;
  delete s.mentionIndex;
  delete s.attachments;
  return s as HomeAppState;
}

function applyHomeBootstrap(bootstrap: HomeBootstrapPayload | null | undefined, notify = true) {
  if (!bootstrap || appliedHomeBootstrapId === bootstrap.id) {
    return;
  }

  appliedHomeBootstrapId = bootstrap.id;

  const settingsValues = bootstrap.initialQueries.settings?.values ?? {};
  if (bootstrap.initialQueries.settings) {
    settingsDraftManager.hydrate(settingsValues, notify);
    planningReviewPreferencesManager.hydrate(settingsValues);
  }

  homeUiStateManager.patch((current) => ({
    routeReady: true,
    hasReceivedInitialEventStreamPayload: Boolean(bootstrap.initialEventState),
    selectedRunId: bootstrap.route.selectedRunId,
    draftProjectPath: bootstrap.route.selectedRunId ? null : bootstrap.route.draftProjectPath,
    pairTokenFromUrl: bootstrap.route.pairTokenFromUrl,
    apiKeys: { ...current.apiKeys, ...settingsValues },
    settingsDiagnostics: bootstrap.initialQueries.settings?.diagnostics ?? current.settingsDiagnostics,
  }), notify);

  if (bootstrap.initialEventState?.queuedMessages) {
    busyMessageQueueManager.setQueuedMessages(bootstrap.initialEventState.queuedMessages, notify);
  }
}

export function HomeApp({ bootstrap }: { bootstrap?: HomeBootstrapPayload | null }) {
  applyHomeBootstrap(bootstrap, false);
  const initialEventState = bootstrap?.initialEventState ?? INITIAL_EVENT_STREAM_STATE;
  const initialSnapshotScope = bootstrap?.route.selectedRunId ?? null;

  const {
    themeMode,
    showSettings,
    showOnboarding,
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
    setThemeMode,
    setShowSettings,
    setShowOnboarding,
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
    setReadMarkers,
    setCollapsedProjectPaths,
    setRenameValue,
    setEditingMessageValue,
    setExpandedDirectMessageIds,
    setRouteReady,
    setHasReceivedInitialEventStreamPayload,
    setSelectedConversationMode,
    setSelectedCliAgent,
    setSelectedModel,
    setSelectedEffort,
    setHydratedRunSelectionId,
    setPairTokenFromUrl,
    setAuthError,
    setPairRedeemAttempted,
    setRuntimeErrors,
  } = homeUiSetters;

  // Event stream state
  const stateManager = useMemo(() => new EventStreamStateManager(initialEventState, {
    snapshotCacheScope: initialSnapshotScope,
    deferCacheHydration: true,
  }), [initialEventState, initialSnapshotScope]);
  useEffect(() => {
    stateManager.hydrateFromCaches();
  }, [stateManager]);
  const state = useSyncExternalStore(
    useCallback((listener) => stateManager.subscribe(listener), [stateManager]),
    useCallback(() => stateManager.getSnapshot(), [stateManager]),
    () => initialEventState,
  );
  const setState = useCallback<React.Dispatch<React.SetStateAction<EventStreamState>>>(
    (action) => {
      stateManager.setSnapshotCacheScope(selectedRunId);
      stateManager.update(action);
    },
    [selectedRunId, stateManager],
  );

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingDeletedRunIdsRef = useRef<Set<string>>(new Set());
  const pendingCreatedConversationSnapshotsRef = useRef<Map<string, CreatedConversationSnapshot>>(new Map());
  const pendingSentConversationMessagesRef = useRef<Map<string, MessageRecord>>(new Map());
  const loadingWorkerHistoryIdsRef = useRef<Set<string>>(new Set());
  const autoResumeStateRef = useRef<Map<string, { failureKey: string; attempts: number; timerId: ReturnType<typeof setTimeout> | null }>>(new Map());
  const autoResumeExhaustedRunIds = useSyncExternalStore(
    useCallback((listener) => autoResumeExhaustionManager.subscribe(listener), []),
    useCallback(() => autoResumeExhaustionManager.getSnapshot(), []),
    () => autoResumeExhaustionManager.getSnapshot(),
  );

  // Appearance
  const appearancePreferences = useManagerSnapshot(appearancePreferencesManager);
  const appearanceTextSizeStyle = useMemo(
    () => getAppearanceTextSizeStyle(appearancePreferences.uiTextSize, appearancePreferences.conversationTextSize),
    [appearancePreferences.conversationTextSize, appearancePreferences.uiTextSize],
  );
  useEffect(() => {
    const body = document.body;
    const textSizeStyles = appearanceTextSizeStyle as Record<string, string | number | undefined>;
    body.classList.add("omni-app-text-scale");
    for (const [property, value] of Object.entries(textSizeStyles)) {
      if (typeof value === "string" || typeof value === "number") body.style.setProperty(property, String(value));
    }
    return () => {
      for (const property of Object.keys(textSizeStyles)) body.style.removeProperty(property);
      body.classList.remove("omni-app-text-scale");
    };
  }, [appearanceTextSizeStyle]);

  const busyMessageQueueState = useManagerSnapshot(busyMessageQueueManager);
  const settingsDraft = useManagerSnapshot(settingsDraftManager);

  const scrollConversationToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const vp = scrollRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]',
      ) as HTMLDivElement | null;
      vp?.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    conversationNotificationManager.hydrateFromBrowser();
    preflightConfirmationActionsManager.hydrateFromBrowser();
  }, []);

  // Filter event stream state
  const filterEventStreamState = useCallback((incoming: EventStreamState) => {
    let next = mergePendingCreatedConversationSnapshots(incoming, pendingCreatedConversationSnapshotsRef.current);
    next = mergePendingSentConversationMessages(next, pendingSentConversationMessagesRef.current);
    const pendingDeleted = pendingDeletedRunIdsRef.current;
    const reconcile = (s: EventStreamState) => { busyMessageQueueManager.setQueuedMessages(s.queuedMessages || []); return s; };
    if (pendingDeleted.size === 0) return reconcile(next);
    next = filterOptimisticallyDeletedRuns(next, pendingDeleted);
    const serverRunIds = new Set((incoming.runs || []).map((r) => r.id));
    for (const id of Array.from(pendingDeleted)) { if (!serverRunIds.has(id)) pendingDeleted.delete(id); }
    return reconcile(next);
  }, []);

  // Compute currentProjectScope early so queries can use it
  const explicitProjects = useMemo(() => parseProjectList(apiKeys.PROJECTS), [apiKeys.PROJECTS]);
  const currentProjectScope = resolveProjectScope({
    draftProjectPath,
    selectedRunId,
    plans: (state.plans || []) as import("./types").PlanRecord[],
    runs: (state.runs || []) as import("./types").RunRecord[],
    explicitProjects,
  });

  // Queries
  const {
    sessionQuery,
    settingsQuery,
    workerCatalogQuery,
    refreshWorkerCatalog,
    projectFilesQuery,
    authEnabled,
    authConfigurationError,
    appUnlocked,
  } = useHomeQueries({
    currentProjectScope,
    bootstrapId: bootstrap?.id,
    initialQueries: bootstrap?.initialQueries,
  });

  // View model
  const vm = useHomeViewModel({
    state,
    selectedRunId,
    selectedConversationMode,
    selectedCliAgent,
    selectedModel,
    selectedEffort,
    draftProjectPath,
    searchQuery,
    apiKeys,
    workerCatalogData: workerCatalogQuery.data,
  });

  const {
    runs,
    selectedRun,
    isImplementationConversation,
    isPlanningConversation,
    isDirectConversation,
    isSupervisorRunning,
    activeComposerMode,
    catalogWorkers,
    availableWorkerTypes,
    configuredAllowedWorkerTypes,
    activeAllowedWorkerTypes,
    autoSelectedWorkerType,
    composerWorkerOptions,
    activeWorkerModelOptions,
    settingsWorkers,
    filteredProjects,
    selectedRunWorkers: selectedRunWorkersForDisplay,
    conversationAgents,
    activeConversationAgents,
    busyConversationWorkerId,
    latestUserCheckpoint,
    liveThoughts,
    selectedRunExecutionEvents,
    selectedRunSupervisorInterventions,
    latestExecutionEvent,
    completionEvent,
    failedWorkerAvailability,
    workerFailureDetail,
    conversationFailure: rawConversationFailure,
    directConversationMessages,
    pendingPermissionAgent,
    erroredAgent,
    latestWaitEvent,
    latestPromptDeferredEvent,
    awaitingUserQuestionMessage,
    isSelectedConversationLoaded,
    latestStuckEvent,
    hasStuckWorker,
    showRecoverableRunningState,
    showConversationExecution,
    activeConversationCwd,
    workspaceSideWindowAvailable,
    conversationTimelineItems,
  } = vm;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (catalogWorkers.length === 0) return;
    try {
      if (window.localStorage.getItem(ONBOARDING_SEEN_STORAGE_KEY) === "1") return;
    } catch {
      return;
    }
    const needsSetup = catalogWorkers.some((worker) => (
      worker.availability.status !== "ok"
      || worker.authentication?.status === "not_authenticated"
      || worker.authentication?.status === "unknown"
    ));
    if (needsSetup) {
      setShowOnboarding(true);
    }
    try {
      window.localStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }, [catalogWorkers, setShowOnboarding]);

  // Mutations
  const mutations = useHomeMutations({
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
    sessionQueryRefetch: sessionQuery.refetch,
  });

  const {
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
    startPlanningReview,
    handleLoadWorkerHistory,
  } = mutations;

  // Conversation actions
  const actions = useConversationActions({
    mutations: {
      renameRun,
      deleteRun,
      archiveRun,
      recoverRun,
      resumeRunRecovery,
      autoCommitChat,
      autoCommitProject,
      commitWorkflowSettings,
      cancelQueuedMessage,
    },
    selectedRunId,
    currentProjectScope,
    explicitProjects,
    runs,
    latestUserCheckpoint,
    renamingRunId,
    apiKeys,
    commandInputRef,
  });

  // Layout controller
  const layout = useHomeLayoutController();

  // Lifecycle
  useHomeLifecycle({
    appUnlocked,
    setHasReceivedInitialEventStreamPayload,
    setState,
    setRuntimeErrors,
    routeReady,
    setRouteReady,
    authEnabled,
    authConfigurationError,
    pairTokenFromUrl,
    setPairTokenFromUrl,
    redeemPairMutation,
    pairRedeemAttempted,
    setPairRedeemAttempted,
    selectedRunId,
    setSelectedRunId,
    draftProjectPath,
    setDraftProjectPath,
    setSelectedConversationMode,
    setSelectedCliAgent,
    setSelectedModel,
    setSelectedEffort,
    setReadMarkers,
    readMarkers,
    collapsedProjectPaths,
    setCollapsedProjectPaths,
    leftSidebarWidth,
    setLeftSidebarWidth,
    rightSidebarWidth,
    setRightSidebarWidth,
    isResizingLeftSidebar,
    setIsResizingLeftSidebar,
    isResizingRightSidebar,
    setIsResizingRightSidebar,
    selectedConversationMode,
    selectedCliAgent,
    selectedModel,
    selectedEffort,
    themeMode,
    setThemeMode,
    filterEventStreamState,
  });

  const isHydratingConversations = appUnlocked && !hasReceivedInitialEventStreamPayload;

  useEffect(() => {
    sideWindowManager.resetFileTabs();
    if (!selectedRunId) {
      setRightSidebarOpen(false);
      setMobileWorkersOpen(false);
    }
    setExpandedDirectMessageIds(new Set());
  }, [selectedRunId, setExpandedDirectMessageIds, setMobileWorkersOpen, setRightSidebarOpen]);

  useRunSelectionEffects({
    scrollRef,
    state,
    selectedRunId,
    selectedRun,
    activeComposerMode,
    selectedCliAgent,
    setSelectedCliAgent,
    autoSelectedWorkerType,
    activeAllowedWorkerTypes,
    hydratedRunSelectionId,
    setHydratedRunSelectionId,
    selectedModel,
    setSelectedModel,
    selectedEffort,
    setSelectedEffort,
    availableWorkerTypes,
    configuredAllowedWorkerTypes,
    apiKeys,
    setApiKeys,
    setReadMarkers,
  });

  // Normalize selected model when catalog changes
  useEffect(() => {
    if (activeWorkerModelOptions.length === 0) return;
    const resolved = resolveSelectedWorkerModel(vm.activeWorkerModelType, selectedModel);
    if (activeWorkerModelOptions.some((o) => o.value === resolved)) {
      if (resolved !== selectedModel) setSelectedModel(resolved);
      return;
    }
    setSelectedModel(activeWorkerModelOptions[0].value);
  }, [activeWorkerModelOptions, vm.activeWorkerModelType, selectedModel, setSelectedModel]);

  // Auto-sync the desktop side window with implementation conversations that have workers.
  useEffect(() => {
    if (selectedRunId && isImplementationConversation && selectedRunWorkersForDisplay.length > 0) {
      setRightSidebarOpen(true);
      return;
    }

    if (selectedRunId) {
      setRightSidebarOpen(false);
    }
  }, [isImplementationConversation, selectedRunId, selectedRunWorkersForDisplay.length, setRightSidebarOpen]);

  // Auto-resume failed runs with backoff. Up to MAX_AUTO_RESUME_ATTEMPTS per
  // distinct failure; after that, surface the real error so the user is not
  // stuck staring at "Reconnecting..." forever.
  const MAX_AUTO_RESUME_ATTEMPTS = 3;
  useEffect(() => {
    if (
      !selectedRunId || !selectedRun
      || (!isImplementationConversation && !isDirectConversation)
      || selectedRun.status !== "failed"
      || failedWorkerAvailability?.availability.status !== "ok"
      || workerFailureDetail || !latestUserCheckpoint || recoverRun.isPending
    ) return;

    const runId = selectedRunId;
    const failureKey = `${selectedRun.failedAt ?? ""}:${selectedRun.lastError ?? ""}`;
    const targetMessageId = latestUserCheckpoint.id;
    const existing = autoResumeStateRef.current.get(runId);

    // New failure for this run — reset attempt counter and clear exhausted flag.
    if (!existing || existing.failureKey !== failureKey) {
      if (existing?.timerId) clearTimeout(existing.timerId);
      autoResumeStateRef.current.set(runId, { failureKey, attempts: 0, timerId: null });
      autoResumeExhaustionManager.clear(runId);
    }

    const state = autoResumeStateRef.current.get(runId)!;
    if (state.timerId) return; // retry already scheduled
    if (state.attempts >= MAX_AUTO_RESUME_ATTEMPTS) {
      autoResumeExhaustionManager.mark(runId);
      return;
    }

    // Backoff: 1s, 4s, 10s.
    const delay = [1000, 4000, 10000][state.attempts] ?? 10000;
    const timerId = setTimeout(() => {
      const current = autoResumeStateRef.current.get(runId);
      if (!current) return;
      autoResumeStateRef.current.set(runId, { ...current, attempts: current.attempts + 1, timerId: null });
      recoverRun.mutate({ runId, action: "retry", targetMessageId });
    }, delay);
    autoResumeStateRef.current.set(runId, { ...state, timerId });
  }, [
    autoResumeExhaustedRunIds,
    failedWorkerAvailability?.availability.status,
    isDirectConversation,
    isImplementationConversation,
    latestUserCheckpoint,
    recoverRun,
    selectedRun,
    selectedRunId,
    workerFailureDetail,
  ]);

  useEffect(() => () => {
    autoResumeStateRef.current.forEach((entry) => {
      if (entry.timerId) clearTimeout(entry.timerId);
    });
    autoResumeStateRef.current.clear();
  }, []);

  const conversationFailure = useMemo(() => {
    if (!rawConversationFailure || rawConversationFailure.tone !== "progress") return rawConversationFailure;
    if (!selectedRunId || !autoResumeExhaustedRunIds.has(selectedRunId)) return rawConversationFailure;
    return {
      tone: "error" as const,
      action: "Run failed",
      message: stripRunFailurePrefix(selectedRun?.lastError) || "Auto-reconnect attempts exhausted.",
      suggestion: "Click reconnect to try again, or fix the worker runtime first.",
      details: [],
    };
  }, [autoResumeExhaustedRunIds, rawConversationFailure, selectedRun?.lastError, selectedRunId]);

  const { selectedRecoveryState, selectedRecoveryIncidents } = useRunRecoveryState({ state, selectedRunId });
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
    queuedMessageCount: busyMessageQueueState.queuedMessages.filter(
      (m) => m.runId === selectedRunId && (m.status === "pending" || m.status === "delivering"),
    ).length,
    activeConversationAgents,
    liveThoughts,
    awaitingUserQuestionMessage,
    isSelectedConversationLoaded,
  });

  const appErrors = useAppErrors({
    state,
    runtimeErrors,
    projectFilesError: projectFilesQuery.error,
    settingsError: settingsQuery.error,
    commitWorkflowSettingsError: commitWorkflowSettings.error,
    runCommandError: runCommand.error,
    sendConversationMessageError: sendConversationMessage.error,
    cancelQueuedMessageError: cancelQueuedMessage.error,
    autoCommitChatError: autoCommitChat.error,
    autoCommitProjectError: autoCommitProject.error,
    recoverRunError: recoverRun.error,
    renameRunError: renameRun.error,
    archiveRunError: archiveRun.error,
    deleteRunError: deleteRun.error,
    stopSupervisorError: stopSupervisor.error,
    stopWorkerError: stopWorker.error ?? stopWorkerTerminalProcess.error,
  });

  // Composer state
  const pendingConversationWorkerId = !isImplementationConversation && sendConversationMessage.isPending
    ? selectedRunWorkersForDisplay[0]?.id ?? null
    : null;
  const stoppableConversationWorkerId = busyConversationWorkerId ?? pendingConversationWorkerId;
  const isConversationStoppable = isSupervisorRunning || Boolean(stoppableConversationWorkerId);
  const isStopConversationPending = stopSupervisor.isPending || stopWorker.isPending;
  const isStartingCurrentProjectConversation = runCommand.isPending
    && !selectedRunId
    && (runCommand.variables?.projectPath ?? null) === (currentProjectScope ?? null);
  const isComposerSubmitting = isStartingCurrentProjectConversation || sendConversationMessage.isPending || sendQueuedMessageNow.isPending || promotePlanningConversation.isPending || isStopConversationPending;
  const busyMessageAction = parseBusyMessageAction(apiKeys.BUSY_MESSAGE_ACTION);
  const hasBusyConversation = isSupervisorRunning || Boolean(stoppableConversationWorkerId);
  const lockedDirectWorkerLabel = WORKER_OPTIONS.find((o) => o.value === (selectedCliAgent === "auto" ? autoSelectedWorkerType : selectedCliAgent))?.label
    || WORKER_OPTIONS.find((o) => o.value === autoSelectedWorkerType)?.label
    || "Direct worker";
  const shouldLockDirectWorker = Boolean(selectedRunId) && activeComposerMode === "direct";
  const showDirectControlWorkingIndicator = isDirectConversation && hasBusyConversation;
  const welcomeRepoName = resolveRepoName(currentProjectScope);
  const pairDeviceAvailabilityError = !authEnabled
    ? "Phone pairing requires OmniHarness auth. Set OMNIHARNESS_AUTH_PASSWORD or OMNIHARNESS_AUTH_PASSWORD_HASH and restart, then open Connect Phone again."
    : authConfigurationError;

  const handleStopConversation = () => {
    if (!selectedRunId || isStopConversationPending) return;
    if (isSupervisorRunning) { stopSupervisor.mutate({ runId: selectedRunId }); return; }
    if (stoppableConversationWorkerId) stopWorker.mutate({ runId: selectedRunId, workerId: stoppableConversationWorkerId });
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
      onOpenProjectFile={actions.handleOpenProjectFile}
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
      onEditQueuedMessage={actions.handleEditQueuedMessage}
      onSendQueuedMessageNow={(messageId) => {
        if (selectedRunId) sendQueuedMessageNow.mutate({ runId: selectedRunId, messageId });
      }}
      onCancelQueuedMessage={(messageId) => {
        if (selectedRunId) cancelQueuedMessage.mutate({ runId: selectedRunId, messageId });
      }}
      onSendConversationMessage={(content, attachments, busyAction) => {
        if (selectedRunId) sendConversationMessage.mutate({ runId: selectedRunId, content, attachments, busyAction });
      }}
      onRunCommand={(content, attachments) => runCommand.mutate({ content, attachments, projectPath: currentProjectScope })}
      onStopConversation={handleStopConversation}
    />
  );

  // Auth gates
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
    onProjectOpenChange: actions.handleProjectOpenChange,
    setShowSettings,
    openOnboarding: () => setShowOnboarding(true),
    openFolderPicker: () => setShowFolderPicker(true),
    startNewPlan: actions.handleStartNewPlan,
    beginConversationInProject: actions.beginConversationInProject,
    autoCommitProject: actions.handleManualCommitProject,
    isAutoCommitProjectPending: autoCommitProject.isPending,
    handleRemoveProject: actions.handleRemoveProject,
    selectRun: actions.handleSelectRun,
    renamingRunId,
    renameValue,
    renameSource,
    setRenameValue,
    startRenamingRun: actions.handleStartRenamingRun,
    commitRenamingRun: (runId: string) => actions.handleCommitRenamingRun(runId, renameValue, state),
    cancelRenamingRun: actions.handleCancelRenamingRun,
    archiveRun: actions.handleArchiveRun,
    deleteRun: actions.handleDeleteRun,
    authEnabled,
    openPairDeviceDialog: () => setShowPairDeviceDialog(true),
    logout: () => logoutMutation.mutate(),
  };

  return (
    <div
      className="omni-app-text-scale flex h-dvh w-full overflow-hidden bg-background text-foreground lg:h-screen"
      style={appearanceTextSizeStyle}
    >
      <div
        className={`relative z-30 hidden h-full shrink-0 overflow-hidden border-r bg-background transition-[width,opacity] duration-150 ease-out lg:flex motion-reduce:transition-none ${leftSidebarOpen ? "border-border opacity-100" : "pointer-events-none border-transparent opacity-0"}`}
        style={{ width: leftSidebarOpen ? leftSidebarWidth : 0 }}
        aria-hidden={!leftSidebarOpen}
        inert={!leftSidebarOpen ? true : undefined}
      >
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-10 w-3 translate-x-1/2 cursor-col-resize bg-transparent"
          aria-label={t("sidebar.resize.conversations")}
          onPointerDown={layout.handleLeftSidebarResizeStart}
        />
        <div className={`flex h-full min-w-0 flex-1 transition-transform duration-150 ease-out motion-reduce:transition-none ${leftSidebarOpen ? "translate-x-0" : "-translate-x-3"}`}>
          <ConversationSidebar {...sharedSidebarProps} onCollapse={() => setLeftSidebarOpen(false)} />
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <HomeHeader
          {...sharedSidebarProps}
          startRenamingRun={actions.handleStartTopBarRenamingRun}
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
          onCommitNow={() => actions.handleManualCommitChat("commit")}
          onCommitAndPushNow={() => actions.handleManualCommitChat("commit-push")}
          onPrimaryCommit={() => actions.handleManualCommitChat()}
          autoCommitMilestonesEnabled={actions.autoCommitMilestonesEnabled}
          pushOnCommitEnabled={actions.pushOnCommitEnabled}
          onAutoCommitMilestonesChange={(checked) => actions.updateCommitWorkflowSetting("GIT_AUTO_COMMIT_MILESTONES", checked)}
          onPushOnCommitChange={(checked) => actions.updateCommitWorkflowSetting("GIT_PUSH_ON_COMMIT", checked)}
          isAutoCommitChatPending={autoCommitChat.isPending}
          onStopWorker={(workerId) => {
            if (selectedRunId) stopWorker.mutate({ runId: selectedRunId, workerId });
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
          onForkSession={actions.handleForkSession}
          onForkSessionIntoWorktree={actions.handleForkSessionIntoWorktree}
          canForkSession={Boolean(selectedRunId && latestUserCheckpoint)}
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
          toggleDirectMessageExpansion={actions.toggleDirectMessageExpansion}
          primaryConversationAgent={vm.primaryConversationAgent}
          primaryConversationWorkerId={vm.primaryConversationAgent?.name ?? null}
          unifiedWorkerStreamEnabled={bootstrap?.features?.unifiedWorkerStream ?? false}
          isHydratingConversations={isHydratingConversations}
          isSelectedConversationLoaded={isSelectedConversationLoaded}
          promotePlanningConversation={promotePlanningConversation}
          onStartReview={(prefs) => {
            if (selectedRunId) {
              startPlanningReview.mutate({ runId: selectedRunId, ...prefs });
            }
          }}
          reviewRuns={state.reviewRuns}
          reviewRounds={state.reviewRounds}
          reviewFindings={state.reviewFindings}
          conversationTimelineItems={conversationTimelineItems}
          recoverRun={recoverRun}
          recoveryState={selectedRecoveryState}
          recoveryIncidents={selectedRecoveryIncidents}
          resumeRunRecovery={resumeRunRecovery}
          showRecoverableRunningState={showRecoverableRunningState}
          hasStuckWorker={hasStuckWorker}
          latestUserCheckpoint={latestUserCheckpoint}
          handleRetryMessage={actions.handleRetryMessage}
          handleResumeRunRecovery={actions.handleResumeRunRecovery}
          handleStartEditingMessage={actions.handleStartEditingMessage}
          handleForkMessage={actions.handleForkMessage}
          handleForkMessageIntoWorktree={actions.handleForkMessageIntoWorktree}
          handleConfirmForkMessageIntoWorktree={actions.handleConfirmForkMessageIntoWorktree}
          editingMessageId={editingMessageId}
          editingMessageValue={editingMessageValue}
          setEditingMessageValue={setEditingMessageValue}
          handleCancelEditingMessage={actions.handleCancelEditingMessage}
          handleSaveEditedMessage={(messageId) => actions.handleSaveEditedMessage(messageId, editingMessageValue)}
          handlePreflightConfirmationAnswer={(content) => {
            if (selectedRunId) {
              sendConversationMessage.mutate({ runId: selectedRunId, content, attachments: [] });
            }
          }}
          isPreflightConfirmationAnswering={sendConversationMessage.isPending}
          conversationAgents={conversationAgents}
          showDirectControlWorkingIndicator={showDirectControlWorkingIndicator}
          showConversationExecution={showConversationExecution}
          liveExecutionStatus={liveExecutionStatus}
          liveThoughts={liveThoughts}
          executionEvents={selectedRunExecutionEvents}
          emptyComposer={renderComposer("mt-2 w-full pt-0 sm:pt-0")}
          projectRoot={currentProjectScope}
          onOpenProjectFile={actions.handleOpenProjectFile}
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
            aria-label={t("sidebar.resize.workspace")}
            onPointerDown={layout.handleRightSidebarResizeStart}
          />
          <div className={`flex h-full min-w-0 flex-1 pl-2 transition-transform duration-150 ease-out motion-reduce:transition-none ${rightSidebarOpen ? "translate-x-0" : "translate-x-3"}`}>
            <SideWindow
              projectRoot={currentProjectScope}
              workers={selectedRunId ? selectedRunWorkersForDisplay : []}
              agents={selectedRunId ? conversationAgents : []}
              supervisorInterventions={selectedRunId ? selectedRunSupervisorInterventions : []}
              preferredModel={selectedRun?.preferredWorkerModel ?? null}
              preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
              onStopWorker={(workerId) => { if (selectedRunId) stopWorker.mutate({ runId: selectedRunId, workerId }); }}
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

      <OnboardingSetupDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        workers={catalogWorkers}
        onRefreshWorkerCatalog={() => refreshWorkerCatalog.mutate()}
        workerCatalogRefreshing={refreshWorkerCatalog.isPending || workerCatalogQuery.isFetching}
        onOpenAgentSettings={() => { setActiveSettingsTab("agents"); setShowSettings(true); }}
      />

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
        onRefreshWorkerCatalog={() => refreshWorkerCatalog.mutate()}
        workerCatalogRefreshing={refreshWorkerCatalog.isPending || workerCatalogQuery.isFetching}
        settingsDiagnostics={settingsDiagnostics}
        saveSettings={saveSettings}
        activeProjectPath={activeConversationCwd ?? null}
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
        onSelect={actions.handleAddProject}
      />

      <AttachmentImagePreviewDialog />
    </div>
  );
}
