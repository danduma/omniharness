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
  expandedFile: SideWindowFileTab | null;
  layout: { expanded: boolean; projectRoot: string | null };
};

export type OpenSideWindowFileInput = {
  root: string;
  relativePath: string;
  line?: number;
  column?: number;
};

const FILES_TAB: SideWindowFilesTab = { id: "files", kind: "files", closeable: false };
const DEFAULT_LAYOUT: SideWindowState["layout"] = { expanded: false, projectRoot: null };
const INITIAL_STATE: SideWindowState = { tabs: [FILES_TAB], activeTabId: FILES_TAB.id, expandedFile: null, layout: DEFAULT_LAYOUT };

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

function selectDockedFile(state: SideWindowState, file: SideWindowFileTab): SideWindowState {
  const isOpen = state.tabs.some((tab) => tab.id === file.id);
  return {
    ...state,
    tabs: isOpen ? state.tabs.map((tab) => tab.id === file.id ? file : tab) : [...state.tabs, file],
    activeTabId: file.id,
  };
}

function getSelectedDockedFile(state: SideWindowState) {
  const selected = state.tabs.find((tab) => tab.id === state.activeTabId);
  if (selected?.kind === "file") return selected;
  const last = state.tabs.at(-1);
  return last?.kind === "file" ? last : null;
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

    const file: SideWindowFileTab = {
      id: sideWindowFileTabId(root, relativePath),
      kind: "file",
      title: fileTitle(relativePath),
      closeable: true,
      root,
      relativePath,
      ...(input.line ? { line: input.line } : {}),
      ...(input.column ? { column: input.column } : {}),
    };
    this.update((current) => current.layout.expanded
      ? { ...current, expandedFile: file }
      : selectDockedFile(current, file));
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
        ...current,
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

  setExpanded(expanded: boolean) {
    this.update((current) => {
      if (current.layout.expanded === expanded) return current;
      const next = !expanded && current.expandedFile
        ? selectDockedFile(current, current.expandedFile)
        : current;
      return {
        ...next,
        expandedFile: expanded ? getSelectedDockedFile(current) : null,
        layout: { ...current.layout, expanded },
      };
    });
  }

  closeExpandedFile() {
    this.setKey("expandedFile", null);
  }

  openProject(root: string, conversationRoot: string | null, expanded: boolean) {
    const projectRoot = normalizeRoot(root);
    const defaultRoot = conversationRoot && normalizeRoot(conversationRoot);
    this.update((current) => {
      const sameProject = (current.layout.projectRoot ?? defaultRoot) === projectRoot;
      const base = sameProject ? current : INITIAL_STATE;
      return {
        ...base,
        activeTabId: expanded ? base.activeTabId : FILES_TAB.id,
        expandedFile: expanded ? (base.layout.expanded ? base.expandedFile : getSelectedDockedFile(base)) : null,
        layout: { expanded, projectRoot: projectRoot === defaultRoot ? null : projectRoot },
      };
    });
  }

  closeWorkspace() {
    if (this.getSnapshot().layout.projectRoot) {
      this.update(INITIAL_STATE);
    } else {
      this.setExpanded(false);
    }
  }

  resetFileTabs() {
    this.update((current) => (
      current.tabs.length === 1 && current.layout === DEFAULT_LAYOUT
        ? current
        : INITIAL_STATE
    ));
  }
}

export const sideWindowManager = new SideWindowManager();
