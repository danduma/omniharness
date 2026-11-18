import { StateManager } from "@/lib/state-manager";

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

export type SideWindowFilesTab = {
  id: "files";
  kind: "files";
  closeable: false;
};

export type SideWindowTab = SideWindowFilesTab | SideWindowFileTab;

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

const FILES_TAB: SideWindowFilesTab = { id: "files", kind: "files", closeable: false };
const INITIAL_STATE: SideWindowState = { tabs: [FILES_TAB], activeTabId: FILES_TAB.id };

function normalizeRoot(root: string) {
  if (/^[a-z]:[\\/]*$/i.test(root)) return root.slice(0, 2) + "/";
  return root.replace(/\/+$/, "") || (root.startsWith("/") ? "/" : "");
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.replace(/^\/+/, "");
}

export function sideWindowFileTabId(root: string, relativePath: string) {
  const escapeDelimiter = (part: string) => part.replaceAll("%", "%25").replaceAll(":", "%3A");
  return `file:${escapeDelimiter(normalizeRoot(root))}:${escapeDelimiter(normalizeRelativePath(relativePath))}`;
}

function fileTitle(relativePath: string) {
  const parts = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  return parts.at(-1) || relativePath;
}

export class SideWindowManager extends StateManager<SideWindowState> {
  constructor() {
    super(INITIAL_STATE);
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
    if (tabId === FILES_TAB.id) {
      return;
    }

    this.update((current) => {
      const closingIndex = current.tabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex < 0) {
        return current;
      }

      const nextTabs = current.tabs.filter((tab) => tab.id !== tabId);
      const activeTabId = current.activeTabId === tabId
        ? nextTabs[closingIndex - 1]?.id ?? FILES_TAB.id
        : current.activeTabId;

      return {
        tabs: nextTabs,
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
      current.tabs.length === 1
        ? current
        : INITIAL_STATE
    ));
  }
}

export const sideWindowManager = new SideWindowManager();
