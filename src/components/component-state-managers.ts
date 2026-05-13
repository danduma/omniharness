import { StateManager, type StateUpdate } from "@/lib/state-manager";

export const loginShellManager = new class extends StateManager<{ password: string }> {
  constructor() {
    super({ password: "" });
  }

  setPassword = (password: string) => this.setKey("password", password);
}();

export const folderPickerManager = new class extends StateManager<{ currentPath: string; search: string }> {
  constructor() {
    super({ currentPath: "", search: "" });
  }

  setSearch = (search: string) => this.setKey("search", search);

  navigate = (currentPath: string) => this.patch({ currentPath, search: "" });
}();

export const fileAttachmentPickerManager = new class extends StateManager<{ search: string; selectedFiles: string[] }> {
  constructor() {
    super({ search: "", selectedFiles: [] });
  }

  setSearch = (search: string) => this.setKey("search", search);

  reset = () => this.patch({ search: "", selectedFiles: [] });

  toggleFile = (filePath: string) => this.setKey("selectedFiles", (current) =>
    current.includes(filePath)
      ? current.filter((candidate) => candidate !== filePath)
      : [...current, filePath]
  );
}();

export type AttachmentImagePreview = {
  url: string;
  name: string;
  size: number;
};

export const attachmentImagePreviewManager = new class extends StateManager<{ preview: AttachmentImagePreview | null }> {
  constructor() {
    super({ preview: null });
  }

  open = (preview: AttachmentImagePreview) => this.setKey("preview", preview);

  close = () => this.setKey("preview", null);
}();

export type PairingState<TPairing, TStatus> = {
  pairing: TPairing | null;
  pairingStatus: TStatus | null;
  qrDataUrl: string | null;
  isLoading: boolean;
  isActivating: boolean;
  error: string | null;
  copyNotice: string | null;
  nowMs: number;
};

export const pairDeviceManager = new class extends StateManager<PairingState<unknown, string>> {
  constructor() {
    super({
      pairing: null,
      pairingStatus: null,
      qrDataUrl: null,
      isLoading: false,
      isActivating: false,
      error: null,
      copyNotice: null,
      nowMs: Date.now(),
    });
  }

  reset = () => this.patch({
    pairing: null,
    pairingStatus: null,
    qrDataUrl: null,
    isActivating: false,
    error: null,
    copyNotice: null,
  });
}();

export const planningArtifactsManager = new class extends StateManager<{ selectedPlanPath: string | null }> {
  constructor() {
    super({ selectedPlanPath: null });
  }

  setSelectedPlanPath = (selectedPlanPath: string | null) => this.setKey("selectedPlanPath", selectedPlanPath);
}();

export class FileViewerPanelManager extends StateManager<{ wordWrap: boolean }> {
  constructor() {
    super({ wordWrap: true });
  }

  setWordWrap = (wordWrap: boolean) => this.setKey("wordWrap", wordWrap);

  toggleWordWrap = () => this.setKey("wordWrap", (current) => !current);
}

export const fileViewerPanelManager = new FileViewerPanelManager();

export const conversationMainManager = new class extends StateManager<{
  fullOutputOpenByMessageId: Record<string, boolean>;
  runLogOpenByRunId: Record<string, boolean>;
  hasOutputBelow: boolean;
}> {
  constructor() {
    super({ fullOutputOpenByMessageId: {}, runLogOpenByRunId: {}, hasOutputBelow: false });
  }

  setFullOutputOpen = (messageId: string, open: boolean) => this.setKey("fullOutputOpenByMessageId", (current) => ({
    ...current,
    [messageId]: open,
  }));

  setRunLogOpen = (runId: string, open: boolean) => this.setKey("runLogOpenByRunId", (current) => ({
    ...current,
    [runId]: open,
  }));

  setHasOutputBelow = (hasOutputBelow: boolean) => this.update((current) => (
    current.hasOutputBelow === hasOutputBelow
      ? current
      : { ...current, hasOutputBelow }
  ));
}();

export const workersSidebarManager = new class extends StateManager<{
  activeTab: "active" | "finished";
  focusedWorkerId: string | null;
}> {
  constructor() {
    super({ activeTab: "active", focusedWorkerId: null });
  }

  setActiveTab = (activeTab: "active" | "finished") => this.patch({ activeTab, focusedWorkerId: null });

  setFocusedWorker = (focusedWorkerId: string | null) => this.setKey("focusedWorkerId", focusedWorkerId);

  toggleFocusedWorker = (workerId: string) => this.setKey("focusedWorkerId", (current) => current === workerId ? null : workerId);
}();

export const workerCardManager = new class extends StateManager<{
  openByWorkerId: Record<string, boolean>;
  permissionOpenByWorkerId: Record<string, boolean>;
  terminalProcessesOpenByWorkerId: Record<string, boolean>;
}> {
  constructor() {
    super({ openByWorkerId: {}, permissionOpenByWorkerId: {}, terminalProcessesOpenByWorkerId: {} });
  }

  setOpen = (workerId: string, open: boolean) => this.setKey("openByWorkerId", (current) => ({
    ...current,
    [workerId]: open,
  }));

  togglePermission = (workerId: string) => this.setKey("permissionOpenByWorkerId", (current) => ({
    ...current,
    [workerId]: !current[workerId],
  }));

  closePermission = (workerId: string) => this.setKey("permissionOpenByWorkerId", (current) => ({
    ...current,
    [workerId]: false,
  }));

  setTerminalProcessesOpen = (workerId: string, open: boolean) => this.setKey("terminalProcessesOpenByWorkerId", (current) => ({
    ...current,
    [workerId]: open,
  }));
}();

export const terminalUiManager = new class extends StateManager<{
  toolDetailsOpenById: Record<string, boolean>;
  toolGroupOpenById: Record<string, boolean>;
  toolOutputExpandedById: Record<string, boolean>;
  thoughtOpenById: Record<string, boolean>;
}> {
  constructor() {
    super({
      toolDetailsOpenById: {},
      toolGroupOpenById: {},
      toolOutputExpandedById: {},
      thoughtOpenById: {},
    });
  }

  setToolDetailsOpen = (id: string, open: boolean) => this.setKey("toolDetailsOpenById", (current) => ({
    ...current,
    [id]: open,
  }));

  setToolGroupOpen = (id: string, open: boolean) => this.setKey("toolGroupOpenById", (current) => ({
    ...current,
    [id]: open,
  }));

  setToolOutputExpanded = (id: string, expanded: boolean) => this.setKey("toolOutputExpandedById", (current) => ({
    ...current,
    [id]: expanded,
  }));

  setThoughtOpen = (id: string, open: StateUpdate<boolean>) => this.setKey("thoughtOpenById", (current) => ({
    ...current,
    [id]: typeof open === "function" ? (open as (value: boolean) => boolean)(current[id] ?? false) : open,
  }));
}();
