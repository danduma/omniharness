import { describe, expect, it } from "vitest";
import { SideWindowManager } from "@/interface/home/SideWindowManager";

describe("SideWindowManager", () => {
  it("starts with the pinned Files tab", () => {
    const manager = new SideWindowManager();

    expect(manager.getSnapshot()).toMatchObject({
      activeTabId: "files",
      tabs: [
        { id: "files", kind: "files", closeable: false },
      ],
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

  it("keeps the Files tab pinned and falls back when active files close", () => {
    const manager = new SideWindowManager();

    manager.openFile({ root: "/repo", relativePath: "src/app.ts" });
    manager.openFile({ root: "/repo", relativePath: "src/other.ts" });

    manager.closeTab("files");
    expect(manager.getSnapshot().tabs.map((tab) => tab.id)).toEqual([
      "files",
      "file:/repo:src/app.ts",
      "file:/repo:src/other.ts",
    ]);

    manager.closeTab("file:/repo:src/other.ts");
    expect(manager.getSnapshot().activeTabId).toBe("file:/repo:src/app.ts");

    manager.closeTab("file:/repo:src/app.ts");
    expect(manager.getSnapshot().activeTabId).toBe("files");
    expect(manager.getSnapshot().tabs).toHaveLength(1);
  });

  it("resets open documents to the Files tab", () => {
    const manager = new SideWindowManager();

    manager.openFile({ root: "/repo", relativePath: "src/app.ts" });
    manager.resetFileTabs();

    expect(manager.getSnapshot().activeTabId).toBe("files");
    expect(manager.getSnapshot().tabs.map((tab) => tab.id)).toEqual(["files"]);
  });

  it("keeps open documents and selection when docking and expanding", () => {
    const manager = new SideWindowManager();
    manager.openFile({ root: "/repo", relativePath: "README.md" });
    const selected = manager.getSnapshot().activeTabId;
    manager.selectTab("files");

    manager.setExpanded(true);
    expect(manager.getSnapshot()).toMatchObject({ expandedFile: { id: selected }, layout: { expanded: true } });
    manager.setExpanded(false);
    expect(manager.getSnapshot()).toMatchObject({ activeTabId: selected, layout: { expanded: false } });
    expect(manager.getSnapshot().tabs).toHaveLength(2);
  });

  it("replaces the expanded file and docks only the current preview", () => {
    const manager = new SideWindowManager();
    manager.openFile({ root: "/repo", relativePath: "pinned.md" });
    manager.setExpanded(true);

    manager.openFile({ root: "/repo", relativePath: "first.md" });
    manager.openFile({ root: "/repo", relativePath: "second.md" });
    expect(manager.getSnapshot().expandedFile?.relativePath).toBe("second.md");
    expect(manager.getSnapshot().tabs.map((tab) => tab.id)).toEqual(["files", "file:/repo:pinned.md"]);

    manager.setExpanded(false);
    expect(manager.getSnapshot().tabs.map((tab) => tab.id)).toEqual([
      "files", "file:/repo:pinned.md", "file:/repo:second.md",
    ]);
    expect(manager.getSnapshot().activeTabId).toBe("file:/repo:second.md");

    manager.setExpanded(true);
    manager.closeExpandedFile();
    expect(manager.getSnapshot().expandedFile).toBeNull();
    expect(manager.getSnapshot().tabs).toHaveLength(3);
  });

  it("opens the menu-selected project without inheriting another project's tabs", () => {
    const manager = new SideWindowManager();
    manager.openFile({ root: "/conversation", relativePath: "README.md" });
    manager.openProject("/another", "/conversation", true);

    expect(manager.getSnapshot()).toMatchObject({
      activeTabId: "files",
      tabs: [{ id: "files" }],
      layout: { expanded: true, projectRoot: "/another" },
    });
    manager.openFile({ root: "/another", relativePath: "notes.md" });
    manager.setExpanded(false);
    expect(manager.getSnapshot().layout.projectRoot).toBe("/another");

    manager.closeWorkspace();
    expect(manager.getSnapshot()).toMatchObject({
      activeTabId: "files",
      tabs: [{ id: "files" }],
      layout: { expanded: false, projectRoot: null },
    });
  });
});
