import { chatAttachmentKindFromMimeType, type PendingChatAttachment } from "@/lib/chat-attachments";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { StateManager, type StateUpdate } from "@/lib/state-manager";
import { DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_SERVER_SETTINGS, DEFAULT_WORKERS_SIDEBAR_WIDTH } from "./constants";
import type { ComposerWorkerOption, ConversationModeOption, EventStreamState, LlmProfileTab, MessageRecord, SettingsTab } from "./types";
import type { CreatedConversationSnapshot } from "./utils";

export type ThemeMode = "day" | "night";
export type RenameSource = "sidebar" | "topbar";

export const INITIAL_EVENT_STREAM_STATE: EventStreamState = {
  messages: [],
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
};

export const NEW_CONVERSATION_DRAFT_KEY = "__new__";

const EMPTY_COMPOSER_DRAFT: ComposerDraft = {
  command: "",
  commandCursor: 0,
  mentionIndex: 0,
  attachments: [],
};

export type HomeUiState = {
  command: string;
  themeMode: ThemeMode;
  showSettings: boolean;
  showOnboarding: boolean;
  showPairDeviceDialog: boolean;
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
  mobileNavOpen: boolean;
  mobileWorkersOpen: boolean;
  searchQuery: string;
  draftProjectPath: string | null;
  commandCursor: number;
  mentionIndex: number;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  renamingRunId: string | null;
  renameValue: string;
  renameSource: RenameSource | null;
  editingMessageId: string | null;
  editingMessageValue: string;
  expandedDirectMessageIds: Set<string>;
  routeReady: boolean;
  hasReceivedInitialEventStreamPayload: boolean;
  selectedConversationMode: ConversationModeOption;
  selectedCliAgent: ComposerWorkerOption;
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
};

const initialHomeUiState: HomeUiState = {
  command: "",
  themeMode: "day",
  showSettings: false,
  showOnboarding: false,
  showPairDeviceDialog: false,
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
  mobileNavOpen: false,
  mobileWorkersOpen: false,
  searchQuery: "",
  draftProjectPath: null,
  commandCursor: 0,
  mentionIndex: 0,
  readMarkers: {},
  collapsedProjectPaths: new Set(),
  renamingRunId: null,
  renameValue: "",
  renameSource: null,
  editingMessageId: null,
  editingMessageValue: "",
  expandedDirectMessageIds: new Set(),
  routeReady: false,
  hasReceivedInitialEventStreamPayload: false,
  selectedConversationMode: "implementation",
  selectedCliAgent: "auto",
  selectedModel: "gpt-5.4",
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
};

export class HomeUiStateManager extends StateManager<HomeUiState> {
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
        || current.attachments.length > 0;
      if (hasContent) {
        drafts[prevKey] = {
          command: current.command,
          commandCursor: current.commandCursor,
          mentionIndex: current.mentionIndex,
          attachments: current.attachments,
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
  setActiveSettingsTab: homeUiStateManager.createSetter("activeSettingsTab"),
  setActiveLlmProfileTab: homeUiStateManager.createSetter("activeLlmProfileTab"),
  setApiKeys: homeUiStateManager.createSetter("apiKeys"),
  setShowFolderPicker: homeUiStateManager.createSetter("showFolderPicker"),
  setSelectedRunId: (value: string | null) => homeUiStateManager.selectRun(value),
  setLeftSidebarOpen: homeUiStateManager.createSetter("leftSidebarOpen"),
  setLeftSidebarWidth: homeUiStateManager.createSetter("leftSidebarWidth"),
  setRightSidebarOpen: homeUiStateManager.createSetter("rightSidebarOpen"),
  setRightSidebarWidth: homeUiStateManager.createSetter("rightSidebarWidth"),
  setIsResizingLeftSidebar: homeUiStateManager.createSetter("isResizingLeftSidebar"),
  setIsResizingRightSidebar: homeUiStateManager.createSetter("isResizingRightSidebar"),
  setMobileNavOpen: homeUiStateManager.createSetter("mobileNavOpen"),
  setMobileWorkersOpen: homeUiStateManager.createSetter("mobileWorkersOpen"),
  setSearchQuery: homeUiStateManager.createSetter("searchQuery"),
  setDraftProjectPath: homeUiStateManager.createSetter("draftProjectPath"),
  setCommandCursor: homeUiStateManager.createSetter("commandCursor"),
  setMentionIndex: homeUiStateManager.createSetter("mentionIndex"),
  setReadMarkers: homeUiStateManager.createSetter("readMarkers"),
  setCollapsedProjectPaths: homeUiStateManager.createSetter("collapsedProjectPaths"),
  setRenamingRunId: homeUiStateManager.createSetter("renamingRunId"),
  setRenameValue: homeUiStateManager.createSetter("renameValue"),
  setRenameSource: homeUiStateManager.createSetter("renameSource"),
  setEditingMessageId: homeUiStateManager.createSetter("editingMessageId"),
  setEditingMessageValue: homeUiStateManager.createSetter("editingMessageValue"),
  setExpandedDirectMessageIds: homeUiStateManager.createSetter("expandedDirectMessageIds"),
  setRouteReady: homeUiStateManager.createSetter("routeReady"),
  setHasReceivedInitialEventStreamPayload: homeUiStateManager.createSetter("hasReceivedInitialEventStreamPayload"),
  setSelectedConversationMode: homeUiStateManager.createSetter("selectedConversationMode"),
  setSelectedCliAgent: homeUiStateManager.createSetter("selectedCliAgent"),
  setSelectedModel: homeUiStateManager.createSetter("selectedModel"),
  setSelectedEffort: homeUiStateManager.createSetter("selectedEffort"),
  setHydratedRunSelectionId: homeUiStateManager.createSetter("hydratedRunSelectionId"),
  setAttachments: homeUiStateManager.createSetter("attachments"),
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
};

export type HomePendingCreatedConversationSnapshots = Map<string, CreatedConversationSnapshot>;
export type HomePendingSentConversationMessages = Map<string, MessageRecord>;
