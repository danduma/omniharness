import { StateManager } from "@/lib/state-manager";

export interface ProjectMemoryFileEntry {
  path: string;
  size: number;
  updatedAt: string;
}

export interface ProjectMemoryPanelState {
  projectPath: string | null;
  enabled: boolean;
  files: ProjectMemoryFileEntry[];
  selectedPath: string | null;
  content: string;
  originalContent: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveStatus: "idle" | "saved";
}

const INITIAL_STATE: ProjectMemoryPanelState = {
  projectPath: null,
  enabled: true,
  files: [],
  selectedPath: null,
  content: "",
  originalContent: "",
  loading: false,
  saving: false,
  error: null,
  saveStatus: "idle",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const message = typeof (error as { message?: string }).message === "string"
      ? (error as { message: string }).message
      : response.statusText;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

interface ListResponse {
  enabled: boolean;
  files: ProjectMemoryFileEntry[];
}

interface FileResponse {
  enabled: boolean;
  file: {
    path: string;
    content: string;
    truncated: boolean;
    size: number;
    updatedAt: string;
  };
}

export class ProjectMemoryPanelManager extends StateManager<ProjectMemoryPanelState> {
  private requestSeq = 0;
  private activeListRequestId = 0;
  private activeFileRequestId = 0;
  private activeToggleRequestId = 0;
  private activeSaveRequestId = 0;

  constructor() {
    super({ ...INITIAL_STATE });
  }

  setProjectPath(nextPath: string | null) {
    const current = this.getSnapshot();
    if (current.projectPath === nextPath) {
      return;
    }
    this.activeListRequestId = ++this.requestSeq;
    this.activeFileRequestId = ++this.requestSeq;
    this.activeToggleRequestId = ++this.requestSeq;
    this.activeSaveRequestId = ++this.requestSeq;
    this.update({
      ...INITIAL_STATE,
      projectPath: nextPath,
    });
  }

  async reloadList() {
    const { projectPath } = this.getSnapshot();
    if (!projectPath) {
      this.patch({ files: [] });
      return;
    }
    const requestId = ++this.requestSeq;
    this.activeListRequestId = requestId;
    this.patch({ loading: true, error: null });
    try {
      const data = await fetchJson<ListResponse>(
        `/api/projects/memory?projectPath=${encodeURIComponent(projectPath)}`,
      );
      const current = this.getSnapshot();
      if (this.activeListRequestId !== requestId || current.projectPath !== projectPath) {
        return;
      }
      const nextSelected = current.selectedPath
        ?? (data.files.length > 0 ? data.files[0].path : null);
      this.patch({
        enabled: data.enabled,
        files: data.files,
        selectedPath: nextSelected,
        loading: false,
      });
    } catch (error) {
      if (this.activeListRequestId !== requestId || this.getSnapshot().projectPath !== projectPath) {
        return;
      }
      this.patch({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async selectPath(path: string | null) {
    const current = this.getSnapshot();
    if (current.selectedPath === path) {
      return;
    }
    this.patch({
      selectedPath: path,
      content: "",
      originalContent: "",
      saveStatus: "idle",
    });
    this.activeFileRequestId = ++this.requestSeq;
    this.activeSaveRequestId = ++this.requestSeq;
    if (path) {
      await this.loadFile();
    }
  }

  async loadFile() {
    const { projectPath, selectedPath } = this.getSnapshot();
    if (!projectPath || !selectedPath) {
      return;
    }
    const requestId = ++this.requestSeq;
    this.activeFileRequestId = requestId;
    this.patch({ loading: true, error: null });
    try {
      const data = await fetchJson<FileResponse>(
        `/api/projects/memory?projectPath=${encodeURIComponent(projectPath)}&path=${encodeURIComponent(selectedPath)}`,
      );
      const current = this.getSnapshot();
      if (
        this.activeFileRequestId !== requestId
        || current.projectPath !== projectPath
        || current.selectedPath !== selectedPath
      ) {
        return;
      }
      this.patch({
        content: data.file.content,
        originalContent: data.file.content,
        saveStatus: "idle",
        loading: false,
      });
    } catch (error) {
      const current = this.getSnapshot();
      if (
        this.activeFileRequestId !== requestId
        || current.projectPath !== projectPath
        || current.selectedPath !== selectedPath
      ) {
        return;
      }
      this.patch({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  setContent(content: string) {
    this.patch({ content, saveStatus: "idle" });
  }

  async toggleEnabled(next: boolean) {
    const { projectPath } = this.getSnapshot();
    if (!projectPath) {
      return;
    }
    const requestId = ++this.requestSeq;
    this.activeToggleRequestId = requestId;
    this.patch({ error: null });
    try {
      await fetchJson("/api/projects/memory", {
        method: "POST",
        body: JSON.stringify({ projectPath, enabled: next }),
      });
      if (this.activeToggleRequestId !== requestId || this.getSnapshot().projectPath !== projectPath) {
        return;
      }
      this.patch({ enabled: next });
    } catch (error) {
      if (this.activeToggleRequestId !== requestId || this.getSnapshot().projectPath !== projectPath) {
        return;
      }
      this.patch({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async save() {
    const { projectPath, selectedPath, content } = this.getSnapshot();
    if (!projectPath || !selectedPath) {
      return;
    }
    const requestId = ++this.requestSeq;
    this.activeSaveRequestId = requestId;
    this.patch({ saving: true, error: null });
    try {
      await fetchJson("/api/projects/memory", {
        method: "POST",
        body: JSON.stringify({ projectPath, path: selectedPath, content }),
      });
      const current = this.getSnapshot();
      if (
        this.activeSaveRequestId !== requestId
        || current.projectPath !== projectPath
        || current.selectedPath !== selectedPath
      ) {
        return;
      }
      if (current.content !== content) {
        this.patch({
          saving: false,
          saveStatus: "idle",
        });
        return;
      }
      this.patch({
        originalContent: content,
        saveStatus: "saved",
        saving: false,
      });
      window.setTimeout(() => {
        const latest = this.getSnapshot();
        if (
          this.activeSaveRequestId === requestId
          && latest.projectPath === projectPath
          && latest.selectedPath === selectedPath
          && latest.saveStatus === "saved"
        ) {
          this.patch({ saveStatus: "idle" });
        }
      }, 2000);
      await this.reloadList();
    } catch (error) {
      const current = this.getSnapshot();
      if (
        this.activeSaveRequestId !== requestId
        || current.projectPath !== projectPath
        || current.selectedPath !== selectedPath
      ) {
        return;
      }
      this.patch({
        saving: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const projectMemoryPanelManager = new ProjectMemoryPanelManager();
