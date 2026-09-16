import { chatAttachmentKindFromMimeType, type PendingChatAttachment } from "@/lib/chat-attachments";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { StateManager, type StateUpdate } from "@/lib/state-manager";
import { goalPlanManager } from "./GoalPlanManager";
import { DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_SERVER_SETTINGS, DEFAULT_TERMINAL_PANEL_WIDTH, DEFAULT_WORKERS_SIDEBAR_WIDTH, PROJECT_SESSION_DISPLAY_BATCH_SIZE } from "./constants";
import type { ComposerWorkerOption, ConversationModeOption, ConversationSidebarTab, EventStreamState, LlmProfileTab, MessageRecord, SettingsTab, SidebarRun } from "./types";
import type { CreatedConversationSnapshot } from "./utils";

export type ThemeMode = "day" | "night";
export type RenameSource = "sidebar" | "topbar";

export const INITIAL_EVENT_STREAM_STATE: EventStreamState = {
  messages: [],
  readMarkers: {},
  plans: [],
  runs: [],
  accounts: [],
  agents: [],
  workers: [],
  planItems: [],
  clarifications: [],
  executionEvents: [],
  supervisorInterventions: [],
  queuedMessages: [],
  recoveryIncidents: [],
  recoveryState: null,
  frontendErrors: [],
};

export type ComposerDraft = {
  command: string;
  commandCursor: number;
  mentionIndex: number;
  attachments: PendingChatAttachment[];
  selection: ComposerSelection;
  dirtySelectionFields: ComposerSelectionField[];
  serverSelectionVersion: string | null;
};

export type ComposerSelection = {
  conversationMode: ConversationModeOption;
  worker: ComposerWorkerOption;
  accountId: string;
  model: string;
  effort: string;
};

export type ComposerSelectionField = keyof ComposerSelection;

export const NEW_CONVERSATION_DRAFT_KEY = "__new__";

const EMPTY_COMPOSER_DRAFT: ComposerDraft = {
  command: "",
  commandCursor: 0,
  mentionIndex: 0,
  attachments: [],
  selection: {
    conversationMode: "direct",
    worker: "auto",
    accountId: "auto",
    model: "gpt-5.6-sol",
    effort: "High",
  },
  dirtySelectionFields: [],
  serverSelectionVersion: null,
};

export type HomeUiState = {
  command: string;
  themeMode: ThemeMode;
  showSettings: boolean;
  showOnboarding: boolean;
  showPairDeviceDialog: boolean;
  showExternalSessionsPicker: boolean;
  activeSettingsTab: SettingsTab;
  activeLlmProfileTab: LlmProfileTab;
  apiKeys: Record<string, string>;
  showFolderPicker: boolean;
  selectedRunId: string | null;
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;
  isResizingLeftSidebar: boolean;
  isResizingRightSidebar: boolean;
  terminalPanelOpen: boolean;
  terminalPanelWidth: number;
  isResizingTerminalPanel: boolean;
  mobileNavOpen: boolean;
  mobileWorkersOpen: boolean;
  mobileTerminalOpen: boolean;
  searchQuery: string;
  draftProjectPath: string | null;
  commandCursor: number;
  mentionIndex: number;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  visibleProjectSessionCounts: Record<string, number>;
  renamingRunId: string | null;
  renameValue: string;
  renameSource: RenameSource | null;
  renameDialogRevision: number;
  movingRunId: string | null;
  moveRunProjectPath: string;
  moveDialogRevision: number;
  editingMessageId: string | null;
  editingMessageValue: string;
  expandedDirectMessageIds: Set<string>;
  routeReady: boolean;
  hasReceivedInitialEventStreamPayload: boolean;
  selectedConversationMode: ConversationModeOption;
  selectedCliAgent: ComposerWorkerOption;
  selectedWorkerAccountId: string;
  selectedModel: string;
  selectedEffort: string;
  hydratedRunSelectionId: string | null;
  attachments: PendingChatAttachment[];
  pairTokenFromUrl: string | null;
  authError: string | null;
  pairRedeemError: string | null;
  pairRedeemAttempted: boolean;
  runtimeErrors: AppErrorDescriptor[];
  settingsDiagnostics: AppErrorDescriptor[];
  composerDraftsByRun: Record<string, ComposerDraft>;
  conversationSidebarTab: ConversationSidebarTab;
  deletingRun: SidebarRun | null;
};

const initialHomeUiState: HomeUiState = {
  command: "",
  themeMode: "day",
  showSettings: false,
  showOnboarding: false,
  showPairDeviceDialog: false,
  showExternalSessionsPicker: false,
  activeSettingsTab: "general",
  activeLlmProfileTab: "supervisor",
  apiKeys: { ...DEFAULT_SERVER_SETTINGS },
  showFolderPicker: false,
  selectedRunId: null,
  leftSidebarOpen: true,
  leftSidebarWidth: DEFAULT_CONVERSATION_SIDEBAR_WIDTH,
  rightSidebarOpen: false,
  rightSidebarWidth: DEFAULT_WORKERS_SIDEBAR_WIDTH,
  isResizingLeftSidebar: false,
  isResizingRightSidebar: false,
  terminalPanelOpen: false,
  terminalPanelWidth: DEFAULT_TERMINAL_PANEL_WIDTH,
  isResizingTerminalPanel: false,
  mobileNavOpen: false,
  mobileWorkersOpen: false,
  mobileTerminalOpen: false,
  searchQuery: "",
  draftProjectPath: null,
  commandCursor: 0,
  mentionIndex: 0,
  readMarkers: {},
  collapsedProjectPaths: new Set(),
  visibleProjectSessionCounts: {},
  renamingRunId: null,
  renameValue: "",
  renameSource: null,
  renameDialogRevision: 0,
  movingRunId: null,
  moveRunProjectPath: "",
  moveDialogRevision: 0,
  editingMessageId: null,
  editingMessageValue: "",
  expandedDirectMessageIds: new Set(),
  routeReady: false,
  hasReceivedInitialEventStreamPayload: false,
  selectedConversationMode: "direct",
  selectedCliAgent: "auto",
  selectedWorkerAccountId: "auto",
  selectedModel: "gpt-5.6-sol",
  selectedEffort: "High",
  hydratedRunSelectionId: null,
  attachments: [],
  pairTokenFromUrl: null,
  authError: null,
  pairRedeemError: null,
  pairRedeemAttempted: false,
  runtimeErrors: [],
  settingsDiagnostics: [],
  composerDraftsByRun: {},
  conversationSidebarTab: "projects",
  deletingRun: null,
};

export class HomeUiStateManager extends StateManager<HomeUiState> {
  private readonly acknowledgedSelectionsByRun = new Map<string, ComposerSelection>();

  constructor() {
    super(initialHomeUiState);
  }

  private revokeAttachmentPreview(attachment: PendingChatAttachment) {
    if (attachment.previewUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }

  addAttachmentFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    this.setKey("attachments", (current) => [
      ...current,
      ...files.map((file) => {
        const mimeType = file.type || "application/octet-stream";
        const kind = chatAttachmentKindFromMimeType(mimeType);
        const previewUrl = kind === "image" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : undefined;

        const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);

        return {
          id: `${Date.now()}-${randomId}`,
          kind,
          name: file.name || "attachment",
          mimeType,
          size: file.size,
          file,
          ...(previewUrl ? { previewUrl } : {}),
        };
      }),
    ]);
  }

  addPastedImages(files: File[]) {
    this.addAttachmentFiles(files.map((file, index) => {
      if (file.name) {
        return file;
      }

      const extension = file.type.split("/")[1]?.split(";")[0] || "png";
      return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
        type: file.type || "image/png",
        lastModified: file.lastModified || Date.now(),
      });
    }));
  }

  removeAttachment(id: string) {
    this.setKey("attachments", (current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed) {
        this.revokeAttachmentPreview(removed);
      }
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  clearAttachments() {
    const current = this.getSnapshot().attachments;
    current.forEach((attachment) => this.revokeAttachmentPreview(attachment));
    this.setKey("attachments", []);
  }

  setComposerDraft(patch: Partial<ComposerDraft>) {
    this.update((current) => {
      const command = patch.command ?? current.command;
      const commandCursor = patch.commandCursor ?? current.commandCursor;
      const mentionIndex = patch.mentionIndex ?? current.mentionIndex;
      const attachments = patch.attachments ?? current.attachments;

      if (
        Object.is(command, current.command)
        && Object.is(commandCursor, current.commandCursor)
        && Object.is(mentionIndex, current.mentionIndex)
        && Object.is(attachments, current.attachments)
      ) {
        return current;
      }

      return {
        ...current,
        command,
        commandCursor,
        mentionIndex,
        attachments,
      };
    });
  }

  private activeSelection(state: HomeUiState): ComposerSelection {
    return {
      conversationMode: state.selectedConversationMode,
      worker: state.selectedCliAgent,
      accountId: state.selectedWorkerAccountId,
      model: state.selectedModel,
      effort: state.selectedEffort,
    };
  }

  setComposerSelectionField<TKey extends ComposerSelectionField>(
    field: TKey,
    value: StateUpdate<ComposerSelection[TKey]>,
    options: { userEdited?: boolean } = {},
  ) {
    this.update((current) => {
      const currentSelection = this.activeSelection(current);
      const nextValue = typeof value === "function"
        ? (value as (previous: ComposerSelection[TKey]) => ComposerSelection[TKey])(currentSelection[field])
        : value;
      if (Object.is(currentSelection[field], nextValue)) return current;

      const key = current.selectedRunId ?? NEW_CONVERSATION_DRAFT_KEY;
      const stored = current.composerDraftsByRun[key];
      const dirtySelectionFields = new Set(stored?.dirtySelectionFields ?? []);
      if (options.userEdited !== false) {
        const acknowledgedValue = current.selectedRunId
          ? this.acknowledgedSelectionsByRun.get(current.selectedRunId)?.[field]
          : undefined;
        if (current.selectedRunId && Object.is(nextValue, acknowledgedValue)) {
          dirtySelectionFields.delete(field);
        } else {
          dirtySelectionFields.add(field);
        }
      }
      const selection = { ...(stored?.selection ?? currentSelection), [field]: nextValue };
      const draft: ComposerDraft = {
        command: current.command,
        commandCursor: current.commandCursor,
        mentionIndex: current.mentionIndex,
        attachments: current.attachments,
        selection,
        dirtySelectionFields: [...dirtySelectionFields],
        serverSelectionVersion: stored?.serverSelectionVersion ?? null,
      };

      const selectionStatePatch: Partial<HomeUiState> = field === "conversationMode"
        ? { selectedConversationMode: nextValue as ConversationModeOption }
        : field === "worker"
          ? { selectedCliAgent: nextValue as ComposerWorkerOption }
          : field === "accountId"
            ? { selectedWorkerAccountId: nextValue as string }
            : field === "model"
              ? { selectedModel: nextValue as string }
              : { selectedEffort: nextValue as string };

      return {
        ...current,
        ...selectionStatePatch,
        composerDraftsByRun: { ...current.composerDraftsByRun, [key]: draft },
      };
    });
  }

  setComposerWorkerSelection(worker: ComposerWorkerOption, model: string) {
    this.update((current) => {
      const currentSelection = this.activeSelection(current);
      const workerChanged = currentSelection.worker !== worker;
      const modelChanged = currentSelection.model !== model;
      if (!workerChanged && !modelChanged) return current;

      const key = current.selectedRunId ?? NEW_CONVERSATION_DRAFT_KEY;
      const stored = current.composerDraftsByRun[key];
      const dirtySelectionFields = new Set(stored?.dirtySelectionFields ?? []);
      const acknowledged = current.selectedRunId
        ? this.acknowledgedSelectionsByRun.get(current.selectedRunId)
        : undefined;

      if (workerChanged) {
        if (current.selectedRunId && acknowledged?.worker === worker) {
          dirtySelectionFields.delete("worker");
        } else {
          dirtySelectionFields.add("worker");
        }
      }
      if (modelChanged) {
        if (current.selectedRunId && acknowledged?.model === model) {
          dirtySelectionFields.delete("model");
        } else {
          dirtySelectionFields.add("model");
        }
      }

      const selection = { ...currentSelection, worker, model };
      const draft: ComposerDraft = {
        command: current.command,
        commandCursor: current.commandCursor,
        mentionIndex: current.mentionIndex,
        attachments: current.attachments,
        selection,
        dirtySelectionFields: [...dirtySelectionFields],
        serverSelectionVersion: stored?.serverSelectionVersion ?? null,
      };

      return {
        ...current,
        selectedCliAgent: worker,
        selectedModel: model,
        composerDraftsByRun: { ...current.composerDraftsByRun, [key]: draft },
      };
    });
  }

  hydrateComposerSelection(args: {
    runId: string;
    selection: ComposerSelection;
    serverVersion: string;
  }) {
    this.acknowledgedSelectionsByRun.set(args.runId, { ...args.selection });
    this.update((current) => {
      const key = args.runId;
      const active = current.selectedRunId === args.runId;
      const currentSelection = active
        ? this.activeSelection(current)
        : current.composerDraftsByRun[key]?.selection ?? args.selection;
      const stored = current.composerDraftsByRun[key];
      if (
        stored?.serverSelectionVersion === args.serverVersion
        && stored.dirtySelectionFields.length === 0
      ) return current;

      const dirtyFields = new Set(stored?.dirtySelectionFields ?? []);
      const nextSelection = { ...currentSelection };
      for (const field of Object.keys(args.selection) as ComposerSelectionField[]) {
        if (dirtyFields.has(field)) {
          if (Object.is(currentSelection[field], args.selection[field])) dirtyFields.delete(field);
          continue;
        }
        (nextSelection[field] as ComposerSelection[typeof field]) = args.selection[field];
      }

      const draft: ComposerDraft = {
        command: active ? current.command : stored?.command ?? "",
        commandCursor: active ? current.commandCursor : stored?.commandCursor ?? 0,
        mentionIndex: active ? current.mentionIndex : stored?.mentionIndex ?? 0,
        attachments: active ? current.attachments : stored?.attachments ?? [],
        selection: nextSelection,
        dirtySelectionFields: [...dirtyFields],
        serverSelectionVersion: args.serverVersion,
      };

      return {
        ...current,
        ...(active ? {
          selectedConversationMode: nextSelection.conversationMode,
          selectedCliAgent: nextSelection.worker,
          selectedWorkerAccountId: nextSelection.accountId,
          selectedModel: nextSelection.model,
          selectedEffort: nextSelection.effort,
          hydratedRunSelectionId: args.runId,
        } : {}),
        composerDraftsByRun: { ...current.composerDraftsByRun, [key]: draft },
      };
    });
  }

  selectRun(nextRunId: string | null) {
    this.update((current) => {
      if (current.selectedRunId === nextRunId) return current;
      const prevKey = current.selectedRunId ?? NEW_CONVERSATION_DRAFT_KEY;
      const nextKey = nextRunId ?? NEW_CONVERSATION_DRAFT_KEY;
      const nextDraft = current.composerDraftsByRun[nextKey] ?? EMPTY_COMPOSER_DRAFT;
      const drafts: Record<string, ComposerDraft> = { ...current.composerDraftsByRun };
      const hasContent = current.command.length > 0
        || current.commandCursor !== 0
        || current.mentionIndex !== 0
        || current.attachments.length > 0
        || (current.composerDraftsByRun[prevKey]?.dirtySelectionFields.length ?? 0) > 0;
      // A clean, server-hydrated selection is still the session's compound
      // composer state. Keep it in memory so switching back restores the
      // model/effort/worker atomically instead of flashing the generic new-run
      // defaults until the hydration effect runs again.
      if (hasContent || current.composerDraftsByRun[prevKey]) {
        drafts[prevKey] = {
          command: current.command,
          commandCursor: current.commandCursor,
          mentionIndex: current.mentionIndex,
          attachments: current.attachments,
          selection: this.activeSelection(current),
          dirtySelectionFields: current.composerDraftsByRun[prevKey]?.dirtySelectionFields ?? [],
          serverSelectionVersion: current.composerDraftsByRun[prevKey]?.serverSelectionVersion ?? null,
        };
      } else {
        delete drafts[prevKey];
      }
      if (nextDraft === EMPTY_COMPOSER_DRAFT) {
        delete drafts[nextKey];
      }
      return {
        ...current,
        selectedRunId: nextRunId,
        composerDraftsByRun: drafts,
        command: nextDraft.command,
        commandCursor: nextDraft.commandCursor,
        mentionIndex: nextDraft.mentionIndex,
        attachments: nextDraft.attachments,
        selectedConversationMode: nextDraft.selection.conversationMode,
        selectedCliAgent: nextDraft.selection.worker,
        selectedWorkerAccountId: nextDraft.selection.accountId,
        selectedModel: nextDraft.selection.model,
        selectedEffort: nextDraft.selection.effort,
        hydratedRunSelectionId: nextRunId && nextDraft.serverSelectionVersion ? nextRunId : null,
      };
    });
  }

  setRenamingRunId(runId: string | null) {
    this.patch((current) => current.renamingRunId === runId
      ? {}
      : { renamingRunId: runId, renameDialogRevision: current.renameDialogRevision + 1 });
  }

  setMovingRunId(runId: string | null) {
    this.patch((current) => current.movingRunId === runId
      ? {}
      : { movingRunId: runId, moveDialogRevision: current.moveDialogRevision + 1 });
  }

  revealMoreProjectSessions(projectPath: string) {
    this.setKey("visibleProjectSessionCounts", (current) => ({
      ...current,
      [projectPath]: (current[projectPath] ?? PROJECT_SESSION_DISPLAY_BATCH_SIZE) + PROJECT_SESSION_DISPLAY_BATCH_SIZE,
    }));
  }

  resetProjectSessionDisplayLimit(projectPath: string) {
    this.setKey("visibleProjectSessionCounts", (current) => {
      if (!(projectPath in current)) {
        return current;
      }

      const next = { ...current };
      delete next[projectPath];
      return next;
    });
  }

  setProjectExpanded(projectPath: string, expanded: boolean) {
    this.setKey("collapsedProjectPaths", (current) => {
      const next = new Set(current);
      if (expanded) {
        if (!next.has(projectPath)) return current;
        next.delete(projectPath);
      } else {
        if (next.has(projectPath)) return current;
        next.add(projectPath);
      }
      return next;
    });
  }

  collapseProjects(projectPaths: string[]) {
    if (projectPaths.length === 0) return;

    this.update((current) => {
      const collapsedProjectPaths = new Set(current.collapsedProjectPaths);
      let changed = false;
      for (const projectPath of projectPaths) {
        if (!collapsedProjectPaths.has(projectPath)) {
          collapsedProjectPaths.add(projectPath);
          changed = true;
        }
      }

      if (!changed) return current;

      const visibleProjectSessionCounts = { ...current.visibleProjectSessionCounts };
      for (const projectPath of projectPaths) {
        delete visibleProjectSessionCounts[projectPath];
      }

      return {
        ...current,
        collapsedProjectPaths,
        visibleProjectSessionCounts,
      };
    });
  }

  createSetter<TKey extends keyof HomeUiState>(key: TKey) {
    return (value: StateUpdate<HomeUiState[TKey]>) => {
      this.setKey(key, value);
    };
  }
}

export const homeUiStateManager = new HomeUiStateManager();

export const homeUiSetters = {
  setCommand: homeUiStateManager.createSetter("command"),
  setThemeMode: homeUiStateManager.createSetter("themeMode"),
  setShowSettings: homeUiStateManager.createSetter("showSettings"),
  setShowOnboarding: homeUiStateManager.createSetter("showOnboarding"),
  setShowPairDeviceDialog: homeUiStateManager.createSetter("showPairDeviceDialog"),
  setShowExternalSessionsPicker: homeUiStateManager.createSetter("showExternalSessionsPicker"),
  setActiveSettingsTab: homeUiStateManager.createSetter("activeSettingsTab"),
  setActiveLlmProfileTab: homeUiStateManager.createSetter("activeLlmProfileTab"),
  setApiKeys: homeUiStateManager.createSetter("apiKeys"),
  setShowFolderPicker: homeUiStateManager.createSetter("showFolderPicker"),
  setSelectedRunId: (value: string | null) => {
    goalPlanManager.switchRun(value);
    homeUiStateManager.selectRun(value);
  },
  setLeftSidebarOpen: homeUiStateManager.createSetter("leftSidebarOpen"),
  setLeftSidebarWidth: homeUiStateManager.createSetter("leftSidebarWidth"),
  setRightSidebarOpen: homeUiStateManager.createSetter("rightSidebarOpen"),
  setRightSidebarWidth: homeUiStateManager.createSetter("rightSidebarWidth"),
  setIsResizingLeftSidebar: homeUiStateManager.createSetter("isResizingLeftSidebar"),
  setIsResizingRightSidebar: homeUiStateManager.createSetter("isResizingRightSidebar"),
  setTerminalPanelOpen: homeUiStateManager.createSetter("terminalPanelOpen"),
  setTerminalPanelWidth: homeUiStateManager.createSetter("terminalPanelWidth"),
  setIsResizingTerminalPanel: homeUiStateManager.createSetter("isResizingTerminalPanel"),
  setMobileNavOpen: homeUiStateManager.createSetter("mobileNavOpen"),
  setMobileWorkersOpen: homeUiStateManager.createSetter("mobileWorkersOpen"),
  setMobileTerminalOpen: homeUiStateManager.createSetter("mobileTerminalOpen"),
  setSearchQuery: homeUiStateManager.createSetter("searchQuery"),
  setDraftProjectPath: homeUiStateManager.createSetter("draftProjectPath"),
  setCommandCursor: homeUiStateManager.createSetter("commandCursor"),
  setMentionIndex: homeUiStateManager.createSetter("mentionIndex"),
  setReadMarkers: homeUiStateManager.createSetter("readMarkers"),
  setCollapsedProjectPaths: homeUiStateManager.createSetter("collapsedProjectPaths"),
  setProjectExpanded: (projectPath: string, expanded: boolean) => homeUiStateManager.setProjectExpanded(projectPath, expanded),
  collapseProjects: (projectPaths: string[]) => homeUiStateManager.collapseProjects(projectPaths),
  setVisibleProjectSessionCounts: homeUiStateManager.createSetter("visibleProjectSessionCounts"),
  revealMoreProjectSessions: (projectPath: string) => homeUiStateManager.revealMoreProjectSessions(projectPath),
  resetProjectSessionDisplayLimit: (projectPath: string) => homeUiStateManager.resetProjectSessionDisplayLimit(projectPath),
  setRenamingRunId: (value: string | null) => homeUiStateManager.setRenamingRunId(value),
  setRenameValue: homeUiStateManager.createSetter("renameValue"),
  setRenameSource: homeUiStateManager.createSetter("renameSource"),
  setMovingRunId: (value: string | null) => homeUiStateManager.setMovingRunId(value),
  setMoveRunProjectPath: homeUiStateManager.createSetter("moveRunProjectPath"),
  setEditingMessageId: homeUiStateManager.createSetter("editingMessageId"),
  setEditingMessageValue: homeUiStateManager.createSetter("editingMessageValue"),
  setExpandedDirectMessageIds: homeUiStateManager.createSetter("expandedDirectMessageIds"),
  setRouteReady: homeUiStateManager.createSetter("routeReady"),
  setHasReceivedInitialEventStreamPayload: homeUiStateManager.createSetter("hasReceivedInitialEventStreamPayload"),
  setSelectedConversationMode: (value: StateUpdate<ConversationModeOption>) => homeUiStateManager.setComposerSelectionField("conversationMode", value),
  setSelectedCliAgent: (value: StateUpdate<ComposerWorkerOption>) => homeUiStateManager.setComposerSelectionField("worker", value),
  setSelectedWorkerAccountId: (value: StateUpdate<string>) => homeUiStateManager.setComposerSelectionField("accountId", value),
  setSelectedModel: (value: StateUpdate<string>) => homeUiStateManager.setComposerSelectionField("model", value),
  setSelectedEffort: (value: StateUpdate<string>) => homeUiStateManager.setComposerSelectionField("effort", value),
  initializeComposerSelection: <TKey extends ComposerSelectionField>(field: TKey, value: StateUpdate<ComposerSelection[TKey]>) => homeUiStateManager.setComposerSelectionField(field, value, { userEdited: false }),
  hydrateComposerSelection: (args: Parameters<HomeUiStateManager["hydrateComposerSelection"]>[0]) => homeUiStateManager.hydrateComposerSelection(args),
  setHydratedRunSelectionId: homeUiStateManager.createSetter("hydratedRunSelectionId"),
  setAttachments: homeUiStateManager.createSetter("attachments"),
  setComposerDraft: (patch: Partial<ComposerDraft>) => homeUiStateManager.setComposerDraft(patch),
  addAttachmentFiles: (files: File[]) => homeUiStateManager.addAttachmentFiles(files),
  addPastedImages: (files: File[]) => homeUiStateManager.addPastedImages(files),
  removeAttachment: (id: string) => homeUiStateManager.removeAttachment(id),
  clearAttachments: () => homeUiStateManager.clearAttachments(),
  setPairTokenFromUrl: homeUiStateManager.createSetter("pairTokenFromUrl"),
  setAuthError: homeUiStateManager.createSetter("authError"),
  setPairRedeemError: homeUiStateManager.createSetter("pairRedeemError"),
  setPairRedeemAttempted: homeUiStateManager.createSetter("pairRedeemAttempted"),
  setRuntimeErrors: homeUiStateManager.createSetter("runtimeErrors"),
  setSettingsDiagnostics: homeUiStateManager.createSetter("settingsDiagnostics"),
  setConversationSidebarTab: homeUiStateManager.createSetter("conversationSidebarTab"),
  setDeletingRun: homeUiStateManager.createSetter("deletingRun"),
};

export type HomePendingCreatedConversationSnapshots = Map<string, CreatedConversationSnapshot>;
export type HomePendingSentConversationMessages = Map<string, MessageRecord>;
