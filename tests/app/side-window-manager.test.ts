import { describe, expect, it } from "vitest";
import { SideWindowManager } from "@/app/home/SideWindowManager";

describe("SideWindowManager", () => {
  it("starts with a pinned workers tab", () => {
    const manager = new SideWindowManager();

    expect(manager.getSnapshot()).toMatchObject({
      activeTabId: "workers",
      tabs: [{ id: "workers", kind: "workers", title: "Session workers", closeable: false }],
    });
  });

  it("opens a project file tab and focuses it", () => {
    const manager = new SideWindowManager();

    manager.openFile({ root: "/repo", relativePath: "src/app.ts", line: 12 });

    expect(manager.getSnapshot().activeTabId).toBe("file:/repo:src/app.ts");
    expect(manager.getSnapshot().tabs[1]).toMatchObject({
      id: "file:/repo:src/app.ts",
      kind: "file",
      root: "/repo",
      relativePath: "src/app.ts",
      line: 12,
      title: "app.ts",
      closeable: true,
    });
  });

  it("dedupes open file tabs while updating the requested line", () => {
    const manager = new SideWindowManager();

    manager.openFile({ root: "/repo", relativePath: "src/app.ts", line: 12 });
    manager.openFile({ root: "/repo", relativePath: "src/other.ts" });
    manager.openFile({ root: "/repo", relativePath: "src/app.ts", line: 27 });

    expect(manager.getSnapshot().tabs).toHaveLength(3);
    expect(manager.getSnapshot().activeTabId).toBe("file:/repo:src/app.ts");
    expect(manager.getSnapshot().tabs.find((tab) => tab.id === "file:/repo:src/app.ts")).toMatchObject({
      line: 27,
    });
  });

  it("keeps the workers tab pinned and falls back when active files close", () => {
    const manager = new SideWindowManager();

    manager.openFile({ root: "/repo", relativePath: "src/app.ts" });
    manager.openFile({ root: "/repo", relativePath: "src/other.ts" });

    manager.closeTab("workers");
    expect(manager.getSnapshot().tabs.map((tab) => tab.id)).toEqual([
      "workers",
      "file:/repo:src/app.ts",
      "file:/repo:src/other.ts",
    ]);

    manager.closeTab("file:/repo:src/other.ts");
    expect(manager.getSnapshot().activeTabId).toBe("file:/repo:src/app.ts");

    manager.closeTab("file:/repo:src/app.ts");
    expect(manager.getSnapshot().activeTabId).toBe("workers");
    expect(manager.getSnapshot().tabs).toHaveLength(1);
  });

  it("resets file tabs without closing workers", () => {
    const manager = new SideWindowManager();

    manager.openFile({ root: "/repo", relativePath: "src/app.ts" });
    manager.resetFileTabs();

    expect(manager.getSnapshot().activeTabId).toBe("workers");
    expect(manager.getSnapshot().tabs.map((tab) => tab.id)).toEqual(["workers"]);
  });
});
