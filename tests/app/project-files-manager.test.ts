import { describe, expect, it, vi } from "vitest";
import { isProjectDraftDirty, projectDocumentKey, ProjectFilesManager } from "@/interface/home/ProjectFilesManager";
import type { ProjectFileContentResponse } from "@/shared/home-types";

const base: ProjectFileContentResponse = {
  root: "/project",
  path: "README.md",
  content: "# Before\r\n",
  revision: "before",
  size: 10,
  truncated: false,
};
const target = { root: base.root, file: base.path };
const key = projectDocumentKey("runner-a", base.root, base.path);

describe("ProjectFilesManager", () => {
  it("preserves newer edits while a save is pending and makes them use the saved revision", async () => {
    const manager = new ProjectFilesManager();
    manager.startEditing(key, base);
    manager.change(key, "# First edit\n");

    let finish!: (file: ProjectFileContentResponse) => void;
    const save = vi.fn(() => new Promise<ProjectFileContentResponse>((resolve) => { finish = resolve; }));
    const pending = manager.save(key, target, save);
    manager.change(key, "# Second edit\n");
    manager.close(key);

    expect(save).toHaveBeenCalledWith({ ...target, revision: "before", content: "# First edit\r\n" });
    finish({ ...base, revision: "after", content: "# First edit\r\n" });
    await pending;
    const draft = manager.getSnapshot().drafts[key];
    expect(draft.content).toBe("# Second edit\n");
    expect(draft.base.revision).toBe("after");
    expect(isProjectDraftDirty(draft)).toBe(true);
  });

  it("keeps the draft scoped to its runner and preserves it on a conflict", async () => {
    const manager = new ProjectFilesManager();
    const otherKey = projectDocumentKey("runner-b", base.root, base.path);
    manager.startEditing(key, base);
    manager.change(key, "# Draft\n");
    manager.startEditing(otherKey, base);
    const conflict = { code: "filesystem.file_changed" };
    await manager.save(key, target, vi.fn().mockRejectedValue(conflict));
    expect(manager.getSnapshot().drafts[key]).toMatchObject({ content: "# Draft\n", saving: false, error: conflict });
    expect(manager.getSnapshot().drafts[otherKey]).toMatchObject({ content: "# Before\n", error: null });
  });
});
