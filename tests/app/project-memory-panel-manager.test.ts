import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectMemoryPanelManager } from "@/app/home/ProjectMemoryPanelManager";

function deferredResponse(payload: unknown) {
  let resolve!: () => void;
  const gate = new Promise<void>((next) => {
    resolve = next;
  });
  return {
    resolve,
    response: Promise.resolve({
      ok: true,
      json: async () => {
        await gate;
        return payload;
      },
    } as Response),
  };
}

describe("ProjectMemoryPanelManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores a stale list response after the project changes", async () => {
    const manager = new ProjectMemoryPanelManager();
    const first = deferredResponse({
      enabled: true,
      files: [{ path: "a.md", size: 1, updatedAt: "2026-05-20T00:00:00.000Z" }],
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(first.response));

    manager.setProjectPath("/project-a");
    const load = manager.reloadList();
    manager.setProjectPath("/project-b");
    first.resolve();
    await load;

    expect(manager.getSnapshot()).toMatchObject({
      projectPath: "/project-b",
      files: [],
      selectedPath: null,
      loading: false,
    });
  });

  it("ignores a stale file response after the selected path changes", async () => {
    const manager = new ProjectMemoryPanelManager();
    const first = deferredResponse({
      enabled: true,
      file: {
        path: "a.md",
        content: "old file",
        truncated: false,
        size: 8,
        updatedAt: "2026-05-20T00:00:00.000Z",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(first.response));

    manager.patch({
      projectPath: "/project",
      selectedPath: "a.md",
    });
    const load = manager.loadFile();
    manager.patch({
      selectedPath: "b.md",
      content: "new draft",
      originalContent: "new draft",
      loading: false,
    });
    first.resolve();
    await load;

    expect(manager.getSnapshot()).toMatchObject({
      selectedPath: "b.md",
      content: "new draft",
      originalContent: "new draft",
      loading: false,
    });
  });
});
