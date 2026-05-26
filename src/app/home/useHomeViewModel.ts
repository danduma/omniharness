"use client";

import { useMemo } from "react";
import { buildConversationGroups } from "@/lib/conversations";
import { buildActiveConversationGroups, filterActiveConversationGroups } from "./sidebar-activity";
import { sidebarWorkerActivityManager } from "./SidebarWorkerActivityManager";
import { isTerminalRunStatus, normalizeRunStatus } from "@/lib/run-status";
import {
  buildWorkerLists,
  isWorkerActiveStatus,
  mergeWorkerLiveStatus,
  normalizeWorkerStatus,
  selectPrimaryConversationAgent,
  type ConversationWorkerRecord,
} from "@/lib/conversation-workers";
import { buildDirectTerminalUserMessages } from "@/lib/worker-terminal-messages";
import { resolveProjectScope } from "@/lib/project-scope";
import { buildConversationTimelineItems, compareNewestByCreatedAtThenId, compareOldestByCreatedAtThenId, filterPromotedPlanningTranscriptMessages, extractWorkerFailureDetail, getConversationTranscriptRunIds, getLatestUnresolvedWorkerStuckEvent, getWorkerModelOptions, parseProjectList, parseWorkerType, parseWorkerTypes, shouldRenderMessageInMainConversation, shouldShowConversationExecutionPanel, shouldShowExecutionEventInRunLog, shouldShowRecoverableRunningState, stripRunFailurePrefix, summarizeThought } from "./utils";
import { COMPOSER_WORKER_OPTIONS, WORKER_OPTIONS } from "./constants";
import type { AgentSnapshot, ComposerWorkerOption, ConversationModeOption, EventStreamState, ExecutionEventRecord, MessageRecord, NoticeDescriptor, PlanRecord, RunMode, RunRecord, SidebarGroup, SupervisorInterventionRecord } from "./types";
import type { WorkerCatalogResponse } from "./types";
import { sessionStateManager } from "./SessionStateManager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export interface UseHomeViewModelParams {
  state: EventStreamState;
  selectedRunId: string | null;
  selectedConversationMode: ConversationModeOption;
  selectedCliAgent: ComposerWorkerOption;
  selectedModel: string;
  selectedEffort: string;
  draftProjectPath: string | null;
  searchQuery: string;
  apiKeys: Record<string, string>;
  workerCatalogData: (WorkerCatalogResponse & { diagnostics?: unknown[] }) | undefined;
  readMarkers?: Record<string, string>;
}

export function useHomeViewModel({
  state,
  selectedRunId,
  selectedConversationMode,
  selectedCliAgent,
  selectedModel: _selectedModel,
  selectedEffort: _selectedEffort,
  draftProjectPath,
  searchQuery,
  apiKeys,
  workerCatalogData,
  readMarkers = {},
}: UseHomeViewModelParams) {
  const runs = (state.runs || []) as RunRecord[];
  const plans = (state.plans || []) as PlanRecord[];

  const explicitProjects = useMemo(() => parseProjectList(apiKeys.PROJECTS), [apiKeys.PROJECTS]);

  const selectedRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null;
  const sessionSnapshot = useManagerSnapshot(sessionStateManager);
  const selectedSession = selectedRunId ? sessionSnapshot.sessionsByRunId[selectedRunId] ?? null : null;
  const selectedRunIsTerminal = isTerminalRunStatus(selectedRun?.status);
  const selectedRunNeedsRecovery = normalizeRunStatus(selectedRun?.status) === "needs_recovery";

  const isSupervisorRunning = Boolean(selectedRun && selectedRun.mode === "implementation" && selectedRun.status === "running");
  const selectedRunMode: RunMode = selectedRun?.mode || "implementation";
  const isImplementationConversation = selectedRunMode === "implementation";
  const isPlanningConversation = selectedRunMode === "planning";
  const isDirectConversation = selectedRunMode === "direct" || selectedRunMode === "commit";
  const activeComposerMode: ConversationModeOption = selectedRun
    ? selectedRunMode === "commit" ? "direct" : selectedRunMode
    : selectedConversationMode;

  const catalogWorkers = useMemo(
    () => workerCatalogData?.workers ?? [],
    [workerCatalogData?.workers],
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
    const configured = selectedRun && selectedRunMode !== "implementation"
      ? selectedRunAllowedWorkerTypes
      : configuredAllowedWorkerTypes;
    if (availableWorkerTypes.length === 0) {
      return configured;
    }

    const availableSet = new Set(availableWorkerTypes);
    const filtered = configured.filter((type) => availableSet.has(type));
    return filtered.length > 0 ? filtered : [...availableWorkerTypes];
  }, [availableWorkerTypes, configuredAllowedWorkerTypes, selectedRun, selectedRunAllowedWorkerTypes, selectedRunMode]);

  const autoSelectedWorkerType = useMemo(() => {
    return activeAllowedWorkerTypes[0] ?? null;
  }, [activeAllowedWorkerTypes]);

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
    () => getWorkerModelOptions(workerCatalogData?.workerModels, activeWorkerModelType),
    [activeWorkerModelType, workerCatalogData?.workerModels],
  );

  const settingsWorkers = useMemo(() => {
    if (catalogWorkers.length > 0) {
      return catalogWorkers;
    }

    return WORKER_OPTIONS.map((option) => ({
      type: option.value,
      label: option.label,
      installation: { command: option.value, path: null, dir: null },
      availability: {
        status: "warning" as const,
        binary: false,
        apiKey: null,
        endpoint: null,
        message: "Worker availability has not loaded yet.",
      },
    }));
  }, [catalogWorkers]);

  const groupedProjects = buildConversationGroups({
    explicitProjects,
    plans,
    runs,
  });

  const filteredProjects = groupedProjects.map((group) => {
    if (!searchQuery) return group;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupRuns = (group.runs as any[]).filter((run: { path: string; title: string }) =>
      run.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return { ...group, runs: groupRuns };
  }).filter((group) => group.runs.length > 0 || group.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeProjects = useMemo(() => {
    const activeFilterNowMs = Date.now();
    const workerOutputObservedAtByRunId = sidebarWorkerActivityManager.getRunOutputAtRecord();
    const unsearched = buildActiveConversationGroups({
      groups: groupedProjects as unknown as SidebarGroup[],
      messages: (state.messages || []) as Array<{ runId: string; role: string; kind?: string | null; createdAt: string }>,
      readMarkers,
      workers: (state.workers || []) as Array<{ id: string; runId: string; status: string; updatedAt?: string }>,
      agents: (state.agents || []) as Array<{ name: string; state: string; updatedAt?: string; lastText?: string; currentText?: string; displayText?: string }>,
      queuedMessages: (state.queuedMessages || []) as Array<{ runId: string; createdAt: string; updatedAt: string; deliveredAt?: string | null }>,
      workerOutputObservedAtByRunId,
      nowMs: activeFilterNowMs,
    });
    return filterActiveConversationGroups(unsearched, searchQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedProjects, state.messages, state.workers, state.agents, state.queuedMessages, readMarkers, searchQuery]);

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

    return filterPromotedPlanningTranscriptMessages({ messages, selectedRun });
  }, [selectedRun, selectedRunId, state.messages, transcriptRunIds]);

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
      const candidateAgent = liveAgentsById.get(worker.id);
      if (!candidateAgent) {
        return {
          name: worker.id,
          type: worker.type,
          state: worker.status,
          currentText: "",
          lastText: "",
        };
      }

      // On a terminal/needs-recovery run, a worker stuck in an "active"
      // state ("idle", "working", etc.) is stale runtime metadata — but the
      // snapshot still carries the persisted outputEntries that the
      // Terminal needs to render. Overlay the quiesced worker status
      // without dropping the rest of the agent. Previously this branch
      // returned a stub with no outputEntries, which made every direct
      // conversation render an empty terminal.
      if ((selectedRunIsTerminal || selectedRunNeedsRecovery) && isWorkerActiveStatus(candidateAgent.state)) {
        return { ...candidateAgent, state: worker.status };
      }

      return candidateAgent;
    });
  }, [selectedRunIsTerminal, selectedRunNeedsRecovery, selectedRunWorkers, state.agents]);

  const selectedRunWorkersForDisplay = useMemo(
    () => mergeWorkerLiveStatus(selectedRunWorkers, conversationAgents),
    [conversationAgents, selectedRunWorkers],
  );

  const primaryConversationAgent = useMemo(
    () => selectPrimaryConversationAgent(conversationAgents, isDirectConversation),
    [conversationAgents, isDirectConversation],
  );

  const conversationWorkerGroups = useMemo(
    () => selectedRunIsTerminal || selectedRunNeedsRecovery
      ? { active: [], finished: selectedRunWorkersForDisplay }
      : buildWorkerLists(selectedRunWorkersForDisplay),
    [selectedRunIsTerminal, selectedRunNeedsRecovery, selectedRunWorkersForDisplay],
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

  const isConversationStoppable = selectedSession
    ? selectedSession.capabilities.includes("stop")
    : isSupervisorRunning || Boolean(busyConversationWorkerId);

  const latestUserCheckpoint = selectedRunId
    ? [...((selectedRunMessages || []) as MessageRecord[])]
        .filter((message) => message.role === "user")
        .sort(compareNewestByCreatedAtThenId)[0] ?? null
    : null;

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
          text: rawThought,
          snippet,
          isLive: Boolean(agent.currentText?.trim()),
        };
      })
      .filter((thought): thought is { agentName: string; text: string; snippet: string; isLive: boolean } => Boolean(thought))
      .slice(0, 3);
  }, [activeConversationAgents]);

  const selectedRunExecutionEvents = useMemo(() => (
    ((state.executionEvents || []) as ExecutionEventRecord[])
      .filter((event) => event.runId === selectedRunId)
      .filter(shouldShowExecutionEventInRunLog)
      .sort(compareNewestByCreatedAtThenId)
  ), [selectedRunId, state.executionEvents]);

  const selectedRunSupervisorInterventions = useMemo(() => (
    ((state.supervisorInterventions || []) as SupervisorInterventionRecord[])
      .filter((intervention) => intervention.runId === selectedRunId)
      .sort(compareOldestByCreatedAtThenId)
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
    ].filter((type, index, values) => Boolean(type) && values.indexOf(type) === index);

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

  const conversationFailure = useMemo((): NoticeDescriptor | null => {
    if (!selectedRun || selectedRun.status !== "failed" || !selectedRun.lastError) {
      return null;
    }

    // Only show "Reconnecting" when an auto-resume will actually run. HomeApp
    // only auto-resumes direct/implementation runs; planning runs surface the
    // real error and rely on the user to act.
    const autoResumes = selectedRun.mode === "direct" || selectedRun.mode === "commit" || selectedRun.mode === "implementation";
    const staleFailure = autoResumes && failedWorkerAvailability?.availability.status === "ok";
    const workerLabel = failedWorkerAvailability?.label;
    const workerStatus = failedWorkerAvailability?.availability.message;

    const rawMessage = stripRunFailurePrefix(selectedRun.lastError);
    const looksLikeStaleSession = typeof rawMessage === "string"
      && /not present in the bridge runtime|worker.*not.*found|session.*lost/i.test(rawMessage);

    return {
      tone: workerFailureDetail ? "warning" : staleFailure || looksLikeStaleSession ? "progress" : "error",
      action: workerFailureDetail
        ? "Worker setup"
        : staleFailure || looksLikeStaleSession
        ? "Reconnecting"
        : "Run failed",
      message: workerFailureDetail || (staleFailure
        ? `to ${workerLabel || "worker"}`
        : looksLikeStaleSession
        ? `the ${workerLabel || "worker"} session — this usually clears itself in a moment.`
        : rawMessage),
      suggestion: workerFailureDetail
        ? "Update the model or account, then resume."
        : staleFailure || looksLikeStaleSession
        ? undefined
        : "Send a message to reconnect; the worker will respawn automatically.",
      details: staleFailure || looksLikeStaleSession
        ? []
        : workerLabel && workerStatus
        ? [`Current ${workerLabel} status: ${workerStatus}`]
        : [],
    };
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
      return [];
    }

    return buildDirectTerminalUserMessages({
      messages: (filteredMessages || []) as MessageRecord[],
      agent: primaryConversationAgent,
      workers: selectedRunWorkers,
    });
  }, [filteredMessages, isDirectConversation, primaryConversationAgent, selectedRunWorkers]);

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

  const isSelectedConversationPreviewAvailable = !selectedRunId || state.snapshotRunId === selectedRunId;
  const isSelectedConversationLoaded = isSelectedConversationPreviewAvailable && state.snapshotSource === "server";

  const awaitingUserQuestionMessage = useMemo(() => {
    if (selectedRun?.status !== "awaiting_user") {
      return null;
    }
    const messages = (selectedRunMessages || []) as MessageRecord[];
    const latestUserAt = messages
      .filter((m) => m.role === "user")
      .reduce((max, m) => Math.max(max, new Date(m.createdAt).getTime()), 0);
    const candidates = messages
      .filter((m) => m.role === "supervisor"
        && (m.kind === "clarification" || m.kind === "implementation_confirmation")
        && new Date(m.createdAt).getTime() >= latestUserAt)
      .sort(compareNewestByCreatedAtThenId);
    return candidates[0] ?? null;
  }, [selectedRun?.status, selectedRunMessages]);
  const latestStuckEvent = getLatestUnresolvedWorkerStuckEvent(selectedRunExecutionEvents);

  const canSurfaceWorkerRecovery = selectedRun?.status === "running";
  const hasStuckWorker = canSurfaceWorkerRecovery && (
    conversationWorkerGroups.active.some((worker) => worker.status === "stuck")
    || activeConversationAgents.some((agent) => agent.state === "stuck")
    || Boolean(latestStuckEvent)
  );

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

  const isConversationThinking = isSupervisorRunning
    || hasActiveWorker
    || Boolean(pendingPermissionAgent)
    || hasStuckWorker
    || showRecoverableRunningState
    || Boolean(latestPromptDeferredEvent)
    || selectedRun?.status === "awaiting_user"
    || selectedRun?.status === "failed";

  // Don't gate the panel on `isSelectedConversationLoaded`: that flag
  // demotes to false whenever the snapshot transitions to a cache view
  // (e.g. during a brief SSE/cache re-hydration window), which would
  // otherwise make the supervisor activity bar disappear mid-run.
  // `shouldShowConversationExecutionPanel` is already conservative —
  // it requires a selected run and some signal of activity — so the
  // loaded-state gate is redundant for visibility.
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

  const activePlan = selectedRunId && runs.length && plans.length
    ? plans.find((p) => p.id === runs.find((r) => r.id === selectedRunId)?.planId) ?? null
    : null;

  const activeConversationCwd = selectedRun?.projectPath || activePlan?.path || draftProjectPath || null;
  const workspaceSideWindowAvailable = Boolean(selectedRunId || draftProjectPath) && Boolean(currentProjectScope);

  return {
    runs,
    plans,
    explicitProjects,
    selectedRun,
    selectedSession,
    selectedRunMode,
    isImplementationConversation,
    isPlanningConversation,
    isDirectConversation,
    isSupervisorRunning,
    activeComposerMode,
    catalogWorkers,
    availableWorkerTypes,
    configuredAllowedWorkerTypes,
    selectedRunAllowedWorkerTypes,
    activeAllowedWorkerTypes,
    autoSelectedWorkerType,
    composerWorkerOptions,
    activeWorkerModelType,
    activeWorkerModelOptions,
    settingsWorkers,
    groupedProjects,
    filteredProjects,
    activeProjects,
    selectedRunMessages,
    filteredMessages,
    selectedRunWorkers,
    conversationAgents,
    selectedRunWorkersForDisplay,
    primaryConversationAgent,
    conversationWorkerGroups,
    activeConversationWorkerIds,
    activeConversationAgents,
    busyConversationWorkerId,
    isConversationStoppable,
    latestUserCheckpoint,
    liveThoughts,
    selectedRunExecutionEvents,
    selectedRunSupervisorInterventions,
    latestExecutionEvent,
    completionEvent,
    failedWorkerAvailability,
    workerFailureDetail,
    conversationFailure,
    visibleMessages,
    conversationTimelineItems,
    conversationTimelineActivityCount,
    directConversationMessages,
    pendingPermissionAgent,
    erroredAgent,
    latestWaitEvent,
    latestPromptDeferredEvent,
    awaitingUserQuestionMessage,
    isSelectedConversationPreviewAvailable,
    isSelectedConversationLoaded,
    latestStuckEvent,
    hasStuckWorker,
    hasActiveWorker,
    showRecoverableRunningState,
    isConversationThinking,
    showConversationExecution,
    currentProjectScope,
    activePlan,
    activeConversationCwd,
    workspaceSideWindowAvailable,
  };
}
