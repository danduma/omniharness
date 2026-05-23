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

  it("does not mark a newer draft as saved when an older save finishes", async () => {
    const manager = new ProjectMemoryPanelManager();
    const saveResponse = deferredResponse({ ok: true });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(saveResponse.response));

    manager.patch({
      projectPath: "/project",
      selectedPath: "memory.md",
      content: "first draft",
      originalContent: "original",
    });
    const save = manager.save();
    manager.setContent("second draft");
    saveResponse.resolve();
    await save;

    expect(manager.getSnapshot()).toMatchObject({
      selectedPath: "memory.md",
      content: "second draft",
      originalContent: "original",
      saving: false,
      saveStatus: "idle",
    });
  });

  it("ignores a stale toggle response after the project changes", async () => {
    const manager = new ProjectMemoryPanelManager();
    const first = deferredResponse({ ok: true });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(first.response));

    manager.patch({
      projectPath: "/project-a",
      enabled: false,
    });
    const toggle = manager.toggleEnabled(true);
    manager.setProjectPath("/project-b");
    first.resolve();
    await toggle;

    expect(manager.getSnapshot()).toMatchObject({
      projectPath: "/project-b",
      enabled: true,
      error: null,
    });
  });

  it("lets the latest same-project toggle own the enabled state", async () => {
    const manager = new ProjectMemoryPanelManager();
    const first = deferredResponse({ ok: true });
    const second = deferredResponse({ ok: true });
    vi.stubGlobal("fetch", vi.fn()
      .mockReturnValueOnce(first.response)
      .mockReturnValueOnce(second.response));

    manager.patch({
      projectPath: "/project",
      enabled: false,
    });
    const enable = manager.toggleEnabled(true);
    const disable = manager.toggleEnabled(false);
    second.resolve();
    await disable;
    first.resolve();
    await enable;

    expect(manager.getSnapshot()).toMatchObject({
      projectPath: "/project",
      enabled: false,
      error: null,
    });
  });
});
