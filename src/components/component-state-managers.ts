import { QueryClient } from "@tanstack/react-query";
import { StateManager, type StateUpdate } from "@/lib/state-manager";
import type { TerminalZoomLevel } from "@/components/Terminal";

export const queryClient = new QueryClient();

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

export type PairingState<TPairing, TStatus> = {
  pairing: TPairing | null;
  pairingStatus: TStatus | null;
  qrDataUrl: string | null;
  isLoading: boolean;
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
      error: null,
      copyNotice: null,
      nowMs: Date.now(),
    });
  }

  reset = () => this.patch({
    pairing: null,
    pairingStatus: null,
    qrDataUrl: null,
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

export const composerModelPickerManager = new class extends StateManager<{ open: boolean; query: string }> {
  constructor() {
    super({ open: false, query: "" });
  }

  setOpen = (open: boolean) => this.setKey("open", open);
  setQuery = (query: string) => this.setKey("query", query);
  closeAndReset = () => this.patch({ open: false, query: "" });
}();

export const conversationMainManager = new class extends StateManager<{ fullOutputOpenByMessageId: Record<string, boolean> }> {
  constructor() {
    super({ fullOutputOpenByMessageId: {} });
  }

  setFullOutputOpen = (messageId: string, open: boolean) => this.setKey("fullOutputOpenByMessageId", (current) => ({
    ...current,
    [messageId]: open,
  }));
}();

export const workersSidebarManager = new class extends StateManager<{ activeTab: "active" | "finished" }> {
  constructor() {
    super({ activeTab: "active" });
  }

  setActiveTab = (activeTab: "active" | "finished") => this.setKey("activeTab", activeTab);
}();

export const workerCardManager = new class extends StateManager<{
  openByWorkerId: Record<string, boolean>;
  permissionOpenByWorkerId: Record<string, boolean>;
}> {
  constructor() {
    super({ openByWorkerId: {}, permissionOpenByWorkerId: {} });
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
}();

export const terminalUiManager = new class extends StateManager<{
  terminalZoom: TerminalZoomLevel;
  toolDetailsOpenById: Record<string, boolean>;
  toolOutputExpandedById: Record<string, boolean>;
  thoughtOpenById: Record<string, boolean>;
}> {
  constructor() {
    super({
      terminalZoom: "default",
      toolDetailsOpenById: {},
      toolOutputExpandedById: {},
      thoughtOpenById: {},
    });
  }

  setTerminalZoom = (terminalZoom: TerminalZoomLevel) => this.setKey("terminalZoom", terminalZoom);

  setToolDetailsOpen = (id: string, open: boolean) => this.setKey("toolDetailsOpenById", (current) => ({
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
