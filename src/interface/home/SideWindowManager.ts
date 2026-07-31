import { StateManager } from "@/lib/state-manager";

export type SideWindowWorkersTab = {
  id: "workers";
  kind: "workers";
  title: string;
  closeable: false;
};

export type SideWindowFileTab = {
  id: string;
  kind: "file";
  title: string;
  closeable: true;
  root: string;
  relativePath: string;
  line?: number;
  column?: number;
};

export type SideWindowTab = SideWindowWorkersTab | SideWindowFileTab;

export type SideWindowState = {
  tabs: SideWindowTab[];
  activeTabId: string;
};

export type OpenSideWindowFileInput = {
  root: string;
  relativePath: string;
  line?: number;
  column?: number;
};

const WORKERS_TAB: SideWindowWorkersTab = {
  id: "workers",
  kind: "workers",
  title: "Session workers",
  closeable: false,
};

function normalizeRoot(root: string) {
  return root.trim().replace(/[\\/]+$/, "");
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

export function sideWindowFileTabId(root: string, relativePath: string) {
  return `file:${normalizeRoot(root)}:${normalizeRelativePath(relativePath)}`;
}

function fileTitle(relativePath: string) {
  const parts = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  return parts.at(-1) || relativePath;
}

export class SideWindowManager extends StateManager<SideWindowState> {
  constructor() {
    super({
      tabs: [WORKERS_TAB],
      activeTabId: WORKERS_TAB.id,
    });
  }

  openFile(input: OpenSideWindowFileInput): boolean {
    const root = normalizeRoot(input.root);
    const relativePath = normalizeRelativePath(input.relativePath);
    if (!root || !relativePath) {
      return false;
    }

    const id = sideWindowFileTabId(root, relativePath);
    this.update((current) => {
      const existingIndex = current.tabs.findIndex((tab) => tab.id === id);
      const nextFileTab: SideWindowFileTab = {
        id,
        kind: "file",
        title: fileTitle(relativePath),
        closeable: true,
        root,
        relativePath,
        ...(input.line ? { line: input.line } : {}),
        ...(input.column ? { column: input.column } : {}),
      };

      if (existingIndex >= 0) {
        return {
          tabs: current.tabs.map((tab, index) => index === existingIndex ? nextFileTab : tab),
          activeTabId: id,
        };
      }

      return {
        tabs: [...current.tabs, nextFileTab],
        activeTabId: id,
      };
    });
    return true;
  }

  closeTab(tabId: string) {
    if (tabId === WORKERS_TAB.id) {
      return;
    }

    this.update((current) => {
      const closingIndex = current.tabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex < 0) {
        return current;
      }

      const nextTabs = current.tabs.filter((tab) => tab.id !== tabId);
      const activeTabId = current.activeTabId === tabId
        ? nextTabs[Math.max(0, closingIndex - 1)]?.id ?? WORKERS_TAB.id
        : current.activeTabId;

      return {
        tabs: nextTabs.length > 0 ? nextTabs : [WORKERS_TAB],
        activeTabId,
      };
    });
  }

  selectTab(tabId: string) {
    this.update((current) => (
      current.tabs.some((tab) => tab.id === tabId)
        ? { ...current, activeTabId: tabId }
        : current
    ));
  }

  resetFileTabs() {
    this.update((current) => (
      current.tabs.length === 1 && current.activeTabId === WORKERS_TAB.id
        ? current
        : { tabs: [WORKERS_TAB], activeTabId: WORKERS_TAB.id }
    ));
  }
}

export const sideWindowManager = new SideWindowManager();
