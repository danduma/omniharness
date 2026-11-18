import { StateManager } from "@/lib/state-manager";
import type { RuntimeAPIs } from "@/runtime-api/types";
import type { ProjectFileContentResponse } from "@/shared/home-types";

type Directory = { path: string; filter: string };
const ROOT_DIRECTORY: Directory = { path: "", filter: "" };

type FileDraft = {
  base: ProjectFileContentResponse;
  baseText: string;
  content: string;
  mode: "edit" | "preview" | "disk";
  saving: boolean;
  error: unknown;
};

export function projectDirectoryKey(runnerId: string, root: string) {
  return JSON.stringify([runnerId, root]);
}

export function projectDocumentKey(runnerId: string, root: string, file: string) {
  return JSON.stringify([runnerId, root, file]);
}

function editableText(content: string) {
  return content.replace(/\r\n?/g, "\n");
}

export function isProjectDraftDirty(draft: FileDraft | undefined) {
  return !!draft && draft.content !== draft.baseText;
}

function restoreLineEndings(text: string, original: string) {
  const endings = original.match(/\r\n|\r|\n/g);
  const firstEnding = endings?.[0];
  if (firstEnding && firstEnding !== "\n" && endings.every((ending) => ending === firstEnding)) {
    return text.replace(/\n/g, firstEnding);
  }
  return text;
}

export class ProjectFilesManager extends StateManager<{
  directories: Record<string, Directory>;
  drafts: Record<string, FileDraft>;
}> {
  constructor() {
    super({ directories: {}, drafts: {} });
  }

  private readonly warnBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = true;
  };

  directory(key: string) {
    return this.getSnapshot().directories[key] ?? ROOT_DIRECTORY;
  }

  navigate(key: string, path: string) {
    this.setKey("directories", (directories) => ({ ...directories, [key]: { path, filter: "" } }));
  }

  filter(key: string, filter: string) {
    this.setKey("directories", (directories) => ({ ...directories, [key]: { ...this.directory(key), filter } }));
  }

  startEditing(key: string, base: ProjectFileContentResponse) {
    if (!base.revision) return;
    const baseText = editableText(base.content);
    this.setDraft(key, this.getSnapshot().drafts[key] ?? {
      base, baseText, content: baseText, mode: "edit", saving: false, error: null,
    });
  }

  private setDraft(key: string, draft: FileDraft | undefined) {
    const previous = this.getSnapshot().drafts[key];
    if (previous === draft) return;
    this.setKey("drafts", (drafts) => {
      const next = { ...drafts };
      if (draft) next[key] = draft;
      else delete next[key];
      return next;
    });
    if (typeof window === "undefined" || isProjectDraftDirty(previous) === isProjectDraftDirty(draft)) return;
    if (Object.values(this.getSnapshot().drafts).some(isProjectDraftDirty)) {
      window.addEventListener("beforeunload", this.warnBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", this.warnBeforeUnload);
    }
  }

  change(key: string, content: string) {
    const draft = this.getSnapshot().drafts[key];
    if (draft && draft.content !== content) this.setDraft(key, { ...draft, content });
  }

  setMode(key: string, mode: FileDraft["mode"]) {
    const draft = this.getSnapshot().drafts[key];
    if (draft && draft.mode !== mode) this.setDraft(key, { ...draft, mode });
  }

  discard(key: string) {
    if (!this.getSnapshot().drafts[key]?.saving) this.setDraft(key, undefined);
  }

  close(key: string) {
    if (!isProjectDraftDirty(this.getSnapshot().drafts[key])) this.discard(key);
  }

  useDiskRevision(key: string, base: ProjectFileContentResponse) {
    const draft = this.getSnapshot().drafts[key];
    if (draft && !draft.saving && base.revision) {
      this.setDraft(key, { ...draft, base, baseText: editableText(base.content), mode: "edit", error: null });
    }
  }

  async save(key: string, target: { root: string; file: string }, save: RuntimeAPIs["files"]["save"]) {
    const draft = this.getSnapshot().drafts[key];
    const revision = draft?.base.revision;
    if (!draft || !revision || draft.saving || !isProjectDraftDirty(draft)) return;

    this.setDraft(key, { ...draft, saving: true, error: null });
    try {
      const result = await save({
        ...target,
        revision,
        content: restoreLineEndings(draft.content, draft.base.content),
      });
      const current = this.getSnapshot().drafts[key];
      if (current?.base === draft.base) {
        this.setDraft(key, { ...current, base: result, baseText: editableText(result.content), saving: false });
      }
      return result;
    } catch (error) {
      const current = this.getSnapshot().drafts[key];
      if (current?.base === draft.base) this.setDraft(key, { ...current, saving: false, error });
    }
  }
}

export const projectFilesManager = new ProjectFilesManager();
