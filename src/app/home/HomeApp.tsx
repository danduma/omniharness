"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BootShell } from "@/components/BootShell";
import { FileAttachmentPickerDialog, type AttachmentItem } from "@/components/FileAttachmentPickerDialog";
import { FolderPickerDialog } from "@/components/FolderPickerDialog";
import { LoginShell } from "@/components/LoginShell";
import { PairDeviceDialog } from "@/components/PairDeviceDialog";
import { ConversationComposer } from "@/components/home/ConversationComposer";
import { ConversationMain } from "@/components/home/ConversationMain";
import { ConversationSidebar } from "@/components/home/ConversationSidebar";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SettingsDialog } from "@/components/home/SettingsDialog";
import { WorkersSidebar } from "@/components/home/WorkersSidebar";
import { type AppErrorDescriptor, mergeAppErrors, requestJson } from "@/lib/app-errors";
import { buildConversationGroups } from "@/lib/conversations";
import { buildWorkerLists, isWorkerActiveStatus, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";
import { resolveProjectScope } from "@/lib/project-scope";
import { applyRunRecoveryOptimisticUpdate, type RecoverableConversationState } from "@/lib/run-recovery-state";
import { COMPOSER_WORKER_OPTIONS, DEFAULT_ALLOWED_WORKER_TYPES, WORKER_OPTIONS } from "./constants";
import type { AgentSnapshot, AuthSessionResponse, ClarificationRecord, ComposerWorkerOption, ConversationModeOption, EventStreamState, ExecutionEventRecord, LlmProfileTab, MessageRecord, NoticeDescriptor, PlanItemRecord, PlanRecord, ProjectFilesResponse, RunRecord, SettingsResponse, SettingsTab, SidebarGroup, SidebarRun, WorkerCatalogResponse, WorkerType } from "./types";
import { buildInlineError, extractWorkerFailureDetail, getWorkerModelOptions, parseProjectList, parseWorkerType, parseWorkerTypes, resolveSelectedWorkerModel, stripRunFailurePrefix, summarizeThought } from "./utils";
import { useAppErrors } from "./useAppErrors";
import { useConversationExecutionStatus } from "./useConversationExecutionStatus";
import { useHomeLifecycle } from "./useHomeLifecycle";
import { useRunSelectionEffects } from "./useRunSelectionEffects";

export function HomeApp() {
  const [command, setCommand] = useState("");
  const [themeMode, setThemeMode] = useState<"day" | "night">("day");
  const [showSettings, setShowSettings] = useState(false);
  const [showPairDeviceDialog, setShowPairDeviceDialog] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("llm");
  const [activeLlmProfileTab, setActiveLlmProfileTab] = useState<LlmProfileTab>("supervisor");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    SUPERVISOR_LLM_PROVIDER: 'gemini',
    SUPERVISOR_LLM_MODEL: 'gemini-3.1-pro-preview',
    SUPERVISOR_LLM_BASE_URL: '',
    SUPERVISOR_LLM_API_KEY: '',
    SUPERVISOR_FALLBACK_LLM_PROVIDER: 'openai',
    SUPERVISOR_FALLBACK_LLM_MODEL: 'gpt-5.4-mini',
    SUPERVISOR_FALLBACK_LLM_BASE_URL: '',
    SUPERVISOR_FALLBACK_LLM_API_KEY: '',
    CREDIT_STRATEGY: 'swap_account',
    WORKER_DEFAULT_TYPE: 'codex',
    WORKER_ALLOWED_TYPES: DEFAULT_ALLOWED_WORKER_TYPES,
    WORKER_YOLO_MODE: 'true',
    PROJECTS: '[]',
  });
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(420);
  const [isResizingRightSidebar, setIsResizingRightSidebar] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileWorkersOpen, setMobileWorkersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftProjectPath, setDraftProjectPath] = useState<string | null>(null);
  const [commandCursor, setCommandCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({});
  const [renamingRunId, setRenamingRunId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageValue, setEditingMessageValue] = useState("");
  const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false);
  const [expandedDirectMessageIds, setExpandedDirectMessageIds] = useState<Set<string>>(() => new Set());
  const [routeReady, setRouteReady] = useState(false);
  const [hasReceivedInitialEventStreamPayload, setHasReceivedInitialEventStreamPayload] = useState(false);
  const [selectedConversationMode, setSelectedConversationMode] = useState<ConversationModeOption>("implementation");
  const [selectedCliAgent, setSelectedCliAgent] = useState<ComposerWorkerOption>("auto");
  const [selectedModel, setSelectedModel] = useState("gpt-5.4");
  const [selectedEffort, setSelectedEffort] = useState("High");
  const [hydratedRunSelectionId, setHydratedRunSelectionId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [pairTokenFromUrl, setPairTokenFromUrl] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pairRedeemError, setPairRedeemError] = useState<string | null>(null);
  const [pairRedeemAttempted, setPairRedeemAttempted] = useState(false);
  
  const [state, setState] = useState<EventStreamState>({
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    validationRuns: [],
    executionEvents: [],
    frontendErrors: [],
  });
  const [runtimeErrors, setRuntimeErrors] = useState<AppErrorDescriptor[]>([]);
  const [settingsDiagnostics, setSettingsDiagnostics] = useState<AppErrorDescriptor[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLTextAreaElement>(null);

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
      setApiKeys(prev => ({ ...prev, ...(data.values || {}) }));
      setSettingsDiagnostics(data.diagnostics ?? []);
      return data;
    },
  });

  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
    queryKey: ["worker-catalog"],
    staleTime: 60_000,
    enabled: appUnlocked,
    queryFn: async () => {
      return requestJson<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>("/api/agents/catalog", undefined, {
        source: "Bridge",
        action: "Load worker availability",
      });
    },
  });

  const explicitProjects = useMemo(() => parseProjectList(apiKeys.PROJECTS), [apiKeys.PROJECTS]);

  useHomeLifecycle({ appUnlocked, setHasReceivedInitialEventStreamPayload, setState, setRuntimeErrors, routeReady, setRouteReady, authEnabled, authConfigurationError, pairTokenFromUrl, setPairTokenFromUrl, redeemPairMutation, pairRedeemAttempted, setPairRedeemAttempted, selectedRunId, setSelectedRunId, draftProjectPath, setDraftProjectPath, setSelectedConversationMode, setSelectedCliAgent, setSelectedModel, setSelectedEffort, setReadMarkers, readMarkers, rightSidebarWidth, setRightSidebarWidth, isResizingRightSidebar, setIsResizingRightSidebar, selectedConversationMode, selectedCliAgent, selectedModel, selectedEffort, themeMode, setThemeMode });
  const isHydratingConversations = appUnlocked && !hasReceivedInitialEventStreamPayload;

  useEffect(() => {
    if (!selectedRunId) {
      setRightSidebarOpen(false);
      setMobileWorkersOpen(false);
    }
    setExpandedDirectMessageIds(new Set());
  }, [selectedRunId]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await requestJson<{ ok: true }>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiKeys),
      }, {
        source: "Settings",
        action: "Save settings",
      });
    },
    onSuccess: () => setShowSettings(false),
  });

  const answerClarification = useMutation({
    mutationFn: async ({ clarificationId, answer }: { clarificationId: string; answer: string }) => {
      if (!selectedRunId) throw new Error("No run selected");
      return requestJson(`/api/runs/${selectedRunId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarificationId, answer }),
      }, {
        source: "Clarifications",
        action: "Answer clarification",
      });
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
        action: "Rename conversation",
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
    },
  });

  const deleteRun = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      return requestJson(`/api/runs/${runId}`, {
        method: "DELETE",
      }, {
        source: "Runs",
        action: "Delete conversation",
      });
    },
    onSuccess: (_data, variables) => {
      const runToDelete = (state.runs || []).find((run: RunRecord) => run.id === variables.runId);
      const workerIds = (state.workers || [])
        .filter((worker: { runId: string; id: string }) => worker.runId === variables.runId)
        .map((worker: { id: string }) => worker.id);

      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).filter((run: RunRecord) => run.id !== variables.runId),
        messages: (current.messages || []).filter((message: { runId: string }) => message.runId !== variables.runId),
        workers: (current.workers || []).filter((worker: { runId: string }) => worker.runId !== variables.runId),
        clarifications: (current.clarifications || []).filter((item: { runId: string }) => item.runId !== variables.runId),
        validationRuns: (current.validationRuns || []).filter((item: { runId: string }) => item.runId !== variables.runId),
        executionEvents: (current.executionEvents || []).filter((item: { runId: string; workerId?: string | null }) =>
          item.runId !== variables.runId && (!item.workerId || !workerIds.includes(item.workerId))
        ),
        plans: runToDelete
          ? (current.plans || []).filter((plan: PlanRecord) => plan.id !== runToDelete.planId)
          : current.plans,
        planItems: runToDelete
          ? (current.planItems || []).filter((item: PlanItemRecord) => item.planId !== runToDelete.planId)
          : current.planItems,
      }));

      if (selectedRunId === variables.runId) {
        setSelectedRunId(null);
      }
      if (renamingRunId === variables.runId) {
        setRenamingRunId(null);
        setRenameValue("");
      }
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

  const runCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel);
      return requestJson<{ runId?: string }>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedConversationMode,
          command: cmd,
          projectPath: currentProjectScope,
          preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent,
          preferredWorkerModel: resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent],
          attachments: attachments.map(({ kind, name, path }) => ({ kind, name, path })),
        }),
      }, {
        source: "Supervisor",
        action: "Start a run",
      });
    },
    onSuccess: (data) => {
      setCommand("");
      setAttachments([]);
      if (data.runId) setSelectedRunId(data.runId);
    },
  });

  const sendConversationMessage = useMutation({
    mutationFn: async (payload: { runId: string; content: string }) => {
      return requestJson<{ ok: true }>(`/api/conversations/${payload.runId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payload.content }),
      }, {
        source: "Conversations",
        action: "Send a conversation message",
      });
    },
    onSuccess: () => {
      setCommand("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      if (selectedRunId && (isPlanningConversation || isDirectConversation)) {
        sendConversationMessage.mutate({ runId: selectedRunId, content: command });
        return;
      }

      runCommand.mutate(command);
    }
  };

  const handleStartNewPlan = () => {
    setSelectedRunId(null);
    setDraftProjectPath(null);
    setCommand("");
    setAttachments([]);
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

  const beginConversationInProject = (projectPath: string) => {
    setSelectedRunId(null);
    setDraftProjectPath(projectPath);
    setCommand("");
    setAttachments([]);
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
  };

  const handleCancelRenamingRun = () => {
    setRenamingRunId(null);
    setRenameValue("");
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

  const runs = (state.runs || []) as RunRecord[];
  const plans = (state.plans || []) as PlanRecord[];
  const clarifications = (state.clarifications || []) as ClarificationRecord[];
  const selectedRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null;
  const selectedRunMode: ConversationModeOption = selectedRun?.mode || "implementation";
  const isImplementationConversation = selectedRunMode === "implementation";
  const isPlanningConversation = selectedRunMode === "planning";
  const isDirectConversation = selectedRunMode === "direct";
  const activeComposerMode: ConversationModeOption = selectedRun ? selectedRunMode : selectedConversationMode;
  useEffect(() => {
    setExecutionDetailsOpen(false);
  }, [selectedRunId]);
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
      availability: {
        status: "warning" as const,
        binary: false,
        apiKey: null,
        endpoint: null,
        message: "Worker availability has not loaded yet.",
      },
    }));
  }, [catalogWorkers]);
  const configuredAllowedWorkerSet = useMemo(
    () => new Set(configuredAllowedWorkerTypes),
    [configuredAllowedWorkerTypes],
  );
  const filteredMessages = useMemo(
    () => (selectedRunId
      ? state.messages?.filter((m: { runId: string }) => m.runId === selectedRunId)
      : []),
    [selectedRunId, state.messages],
  );

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
  }, [activeWorkerModelOptions, activeWorkerModelType, selectedModel]);

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
  const primaryConversationAgent = useMemo(() => {
    if (!isDirectConversation) {
      return conversationAgents[0] ?? null;
    }

    return (
      conversationAgents.find((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))
      ?? conversationAgents.find((agent) => agent.state !== "cancelled")
      ?? conversationAgents[0]
      ?? null
    );
  }, [conversationAgents, isDirectConversation]);
  const conversationWorkerGroups = useMemo(
    () => buildWorkerLists(selectedRunWorkers),
    [selectedRunWorkers],
  );
  const activeConversationWorkerIds = useMemo(
    () => new Set(conversationWorkerGroups.active.map((worker) => worker.id)),
    [conversationWorkerGroups.active],
  );
  const activeConversationAgents = useMemo(
    () => conversationAgents.filter((agent) => activeConversationWorkerIds.has(agent.name)),
    [activeConversationWorkerIds, conversationAgents],
  );
  const latestUserCheckpoint = selectedRunId
    ? [...((filteredMessages || []) as MessageRecord[])]
        .filter((message) => message.role === "user")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  ), [selectedRunId, state.executionEvents]);
  const recentExecutionEvents = selectedRunExecutionEvents.slice(0, 6);
  const latestExecutionEvent = selectedRunExecutionEvents[0] ?? null;
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
  const conversationFailure = useMemo(() => {
    if (!selectedRun || selectedRun.status !== "failed" || !selectedRun.lastError) {
      return null;
    }

    const staleFailure = failedWorkerAvailability?.availability.status === "ok";
    const workerFailureDetail = extractWorkerFailureDetail((filteredMessages || []) as MessageRecord[]);
    const workerLabel = failedWorkerAvailability?.label;
    const workerStatus = failedWorkerAvailability?.availability.message;

    return {
      tone: workerFailureDetail ? "warning" : staleFailure ? "success" : "error",
      action: workerFailureDetail ? "Worker configuration issue" : staleFailure ? "Ready to retry" : "Run failed",
      message: workerFailureDetail || (staleFailure
        ? `${workerLabel || "The selected worker"} is available now.`
        : stripRunFailurePrefix(selectedRun.lastError)),
      suggestion: workerFailureDetail
        ? "Retry latest after updating the worker model or account configuration."
        : staleFailure
        ? "Retry latest to rerun with the current worker availability."
        : "Retry latest after fixing the worker runtime, or switch to another available worker.",
      details: workerLabel && workerStatus ? [`Current ${workerLabel} status: ${workerStatus}`] : [],
    } satisfies NoticeDescriptor;
  }, [failedWorkerAvailability, filteredMessages, selectedRun]);
  const visibleMessages = useMemo(() => {
    if (!selectedRun || selectedRun.status !== "failed" || !selectedRun.lastError) {
      return (filteredMessages || []) as MessageRecord[];
    }

    return ((filteredMessages || []) as MessageRecord[]).filter((message) => !(
      message.role === "system"
      && message.kind === "error"
    ));
  }, [filteredMessages, selectedRun]);
  const directConversationMessages = useMemo(() => {
    if (!isDirectConversation) {
      return [] as MessageRecord[];
    }

    return ((filteredMessages || []) as MessageRecord[])
      .filter((message) => message.role === "user")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [filteredMessages, isDirectConversation]);
  const pendingPermissionAgent = activeConversationAgents.find((agent) => (agent.pendingPermissions?.length ?? 0) > 0) ?? null;
  const erroredAgent = activeConversationAgents.find((agent) => agent.state === "error" || Boolean(agent.lastError) || Boolean(agent.stopReason)) ?? null;
  const latestWaitEvent = selectedRunExecutionEvents.find((event) => event.eventType === "supervisor_wait") ?? null;
  const latestStuckEvent = selectedRunExecutionEvents.find((event) => event.eventType === "worker_stuck") ?? null;
  const hasStuckWorker = conversationWorkerGroups.active.some((worker) => worker.status === "stuck")
    || activeConversationAgents.some((agent) => agent.state === "stuck")
    || Boolean(latestStuckEvent);
  const hasActiveWorker = activeConversationAgents.some((agent) => (
    isWorkerActiveStatus(agent.state)
    || Boolean(agent.currentText?.trim())
  ));
  const latestExecutionAgeMs = latestExecutionEvent
    ? Date.now() - new Date(latestExecutionEvent.createdAt).getTime()
    : Number.POSITIVE_INFINITY;
  const showRecoverableRunningState = Boolean(
    selectedRun?.status === "running"
      && latestUserCheckpoint
      && !pendingPermissionAgent
      && !hasActiveWorker
      && (
        hasStuckWorker
        || (conversationWorkerGroups.active.length === 0 && latestExecutionAgeMs >= 30_000)
      )
  );
  const { liveExecutionStatus, executionDetailLines } = useConversationExecutionStatus({
    selectedRun,
    latestExecutionEvent,
    erroredAgent,
    pendingPermissionAgent,
    hasStuckWorker,
    latestStuckEvent,
    showRecoverableRunningState,
    latestWaitEvent,
    activeConversationAgents,
    liveThoughts,
    conversationAgents,
    recentExecutionEvents,
  });

  const isConversationThinking = selectedRun?.status === "running" || conversationAgents.some((agent) => agent.state === "working");
  const showConversationExecution = Boolean(
    selectedRun && selectedRun.status !== "failed" && (isConversationThinking || selectedRunExecutionEvents.length > 0)
  );

  const currentProjectScope = resolveProjectScope({
    draftProjectPath,
    selectedRunId,
    plans,
    runs,
    explicitProjects,
  });

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
  const selectedClarifications = selectedRunId ? clarifications.filter((item) => item.runId === selectedRunId) : [];
  const appErrors = useAppErrors({ state, runtimeErrors, projectFilesError: projectFilesQuery.error, settingsError: settingsQuery.error, runCommandError: runCommand.error, recoverRunError: recoverRun.error, renameRunError: renameRun.error, deleteRunError: deleteRun.error });

  useRunSelectionEffects({ scrollRef, state, selectedRunId, selectedRun, activeComposerMode, selectedCliAgent, setSelectedCliAgent, autoSelectedWorkerType, activeAllowedWorkerTypes, hydratedRunSelectionId, setHydratedRunSelectionId, selectedModel, setSelectedModel, selectedEffort, setSelectedEffort, availableWorkerTypes, configuredAllowedWorkerTypes, apiKeys, setApiKeys, setReadMarkers });
  const activeMention = getActiveMentionQuery(command, commandCursor);
  const filteredProjectFiles = useMemo(() => {
    if (!activeMention) {
      return [];
    }

    const files = projectFilesQuery.data?.files ?? [];
    const needle = activeMention.query.toLowerCase();
    return files
      .filter((filePath) => needle.length === 0 || filePath.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [activeMention, projectFilesQuery.data?.files]);
  const showMentionPicker = Boolean(
    activeMention && currentProjectScope && (filteredProjectFiles.length > 0 || projectFilesQuery.isFetched)
  );

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, currentProjectScope]);

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

  const handleAttachFiles = (nextAttachments: AttachmentItem[]) => {
    setAttachments((current) => {
      const seen = new Set(current.map((attachment) => attachment.path));
      const merged = [...current];

      for (const attachment of nextAttachments) {
        if (!seen.has(attachment.path)) {
          seen.add(attachment.path);
          merged.push(attachment);
        }
      }

      return merged;
    });
  };

  const handleRemoveAttachment = (attachmentPath: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.path !== attachmentPath));
  };

  const handleToggleAllowedWorker = (workerType: WorkerType, checked: boolean) => {
    const currentlyAllowed = parseWorkerTypes(apiKeys.WORKER_ALLOWED_TYPES);
    const nextAllowed = checked
      ? Array.from(new Set([...currentlyAllowed, workerType]))
      : currentlyAllowed.filter((type) => type !== workerType);

    if (nextAllowed.length === 0) {
      return;
    }

    setApiKeys((current) => ({
      ...current,
      WORKER_ALLOWED_TYPES: JSON.stringify(nextAllowed),
      WORKER_DEFAULT_TYPE: nextAllowed.includes(current.WORKER_DEFAULT_TYPE as WorkerType)
        ? current.WORKER_DEFAULT_TYPE
        : nextAllowed[0],
    }));
  };

  const isComposerSubmitting = runCommand.isPending || sendConversationMessage.isPending || promotePlanningConversation.isPending;
  const lockedDirectWorkerLabel = WORKER_OPTIONS.find((option) => option.value === (selectedCliAgent === "auto" ? autoSelectedWorkerType : selectedCliAgent))?.label
    || WORKER_OPTIONS.find((option) => option.value === autoSelectedWorkerType)?.label
    || "Direct worker";
  const shouldLockDirectWorker = Boolean(selectedRunId) && activeComposerMode === "direct";

  const handleRetryMessage = (messageId: string) => {
    if (!selectedRunId) return;
    recoverRun.mutate({ runId: selectedRunId, action: "retry", targetMessageId: messageId });
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

  const handleStartEditingMessage = (message: MessageRecord) => {
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

  const handleForkMessage = (message: MessageRecord) => {
    if (!selectedRunId) return;
    const content = window.prompt("Fork with this prompt:", message.content)?.trim();
    if (!content) return;
    recoverRun.mutate({ runId: selectedRunId, action: "fork", targetMessageId: message.id, content });
  };

  const handleRightSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizingRightSidebar(true);
  };


  const renderComposer = (className: string) => (
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
          themeMode={themeMode}
          attachments={attachments}
          handleRemoveAttachment={handleRemoveAttachment}
          setShowAttachmentPicker={setShowAttachmentPicker}
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
          isPlanningConversation={isPlanningConversation}
          isDirectConversation={isDirectConversation}
          onSendConversationMessage={(content) => {
            if (selectedRunId) {
              sendConversationMessage.mutate({ runId: selectedRunId, content });
            }
          }}
          onRunCommand={(content) => runCommand.mutate(content)}
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
    setShowSettings,
    openFolderPicker: () => setShowFolderPicker(true),
    startNewPlan: handleStartNewPlan,
    beginConversationInProject,
    handleRemoveProject,
    selectRun: handleSelectRun,
    renamingRunId,
    renameValue,
    setRenameValue,
    startRenamingRun: handleStartRenamingRun,
    commitRenamingRun: handleCommitRenamingRun,
    cancelRenamingRun: handleCancelRenamingRun,
    deleteRun: handleDeleteRun,
    authEnabled,
    openPairDeviceDialog: () => setShowPairDeviceDialog(true),
    logout: () => logoutMutation.mutate(),
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground lg:h-screen">
      <div className="relative z-30 hidden h-full w-[280px] shrink-0 overflow-hidden border-r border-border lg:flex">
        <ConversationSidebar {...sharedSidebarProps} />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <HomeHeader
          {...sharedSidebarProps}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          activeConversationCwd={activeConversationCwd}
          selectedRun={selectedRun}
          isImplementationConversation={isImplementationConversation}
          showRecoverableRunningState={showRecoverableRunningState}
          hasStuckWorker={hasStuckWorker}
          latestUserCheckpoint={latestUserCheckpoint}
          handleRetryMessage={handleRetryMessage}
          recoverRun={recoverRun}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          rightSidebarOpen={rightSidebarOpen}
          setRightSidebarOpen={setRightSidebarOpen}
          mobileWorkersOpen={mobileWorkersOpen}
          setMobileWorkersOpen={setMobileWorkersOpen}
          selectedRunWorkers={selectedRunWorkers}
          conversationAgents={conversationAgents}
        />

        <ConversationMain
          scrollRef={scrollRef}
          selectedRunId={selectedRunId}
          selectedRun={selectedRun}
          selectedConversationMode={selectedConversationMode}
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
          visibleMessages={visibleMessages}
          recoverRun={recoverRun}
          handleRetryMessage={handleRetryMessage}
          handleStartEditingMessage={handleStartEditingMessage}
          handleForkMessage={handleForkMessage}
          editingMessageId={editingMessageId}
          editingMessageValue={editingMessageValue}
          setEditingMessageValue={setEditingMessageValue}
          handleCancelEditingMessage={handleCancelEditingMessage}
          handleSaveEditedMessage={handleSaveEditedMessage}
          selectedRunWorkers={selectedRunWorkers}
          conversationAgents={conversationAgents}
          showConversationExecution={showConversationExecution}
          liveExecutionStatus={liveExecutionStatus}
          liveThoughts={liveThoughts}
          executionDetailsOpen={executionDetailsOpen}
          setExecutionDetailsOpen={setExecutionDetailsOpen}
          executionDetailLines={executionDetailLines}
          selectedClarifications={selectedClarifications}
          answerClarification={answerClarification}
          conversationWorkerGroups={conversationWorkerGroups}
          emptyComposer={renderComposer("mt-6 w-full")}
        />

        {selectedRunId ? renderComposer("w-full") : null}
      </div>

      {rightSidebarOpen && selectedRunId && isImplementationConversation ? (
        <div className="relative hidden h-full shrink-0 border-l border-border lg:flex" style={{ width: rightSidebarWidth }}>
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center bg-transparent"
            aria-label="Resize workers sidebar"
            onPointerDown={handleRightSidebarResizeStart}
          >
            <span className="h-14 w-1 rounded-full bg-border/80 transition-colors hover:bg-foreground/30" />
          </button>
          <div className="flex h-full min-w-0 flex-1 pl-2">
            <WorkersSidebar
              workers={selectedRunWorkers}
              agents={conversationAgents}
              preferredModel={selectedRun?.preferredWorkerModel ?? null}
              preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
              onClose={() => setRightSidebarOpen(false)}
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
        apiKeys={apiKeys}
        setApiKeys={setApiKeys}
        settingsWorkers={settingsWorkers}
        configuredAllowedWorkerSet={configuredAllowedWorkerSet}
        configuredAllowedWorkerTypes={configuredAllowedWorkerTypes}
        handleToggleAllowedWorker={handleToggleAllowedWorker}
        workerCatalogQuery={workerCatalogQuery}
        settingsDiagnostics={settingsDiagnostics}
        saveSettings={saveSettings}
      />

      <PairDeviceDialog
        open={showPairDeviceDialog}
        onOpenChange={setShowPairDeviceDialog}
        selectedRunId={selectedRunId}
        availabilityError={pairDeviceAvailabilityError}
      />

      <FolderPickerDialog
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onSelect={handleAddProject}
      />
      <FileAttachmentPickerDialog
        open={showAttachmentPicker}
        onOpenChange={setShowAttachmentPicker}
        rootPath={currentProjectScope}
        onSelect={handleAttachFiles}
      />
    </div>
  );
}
