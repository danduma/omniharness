import { describe, expect, it } from "vitest";
import { HomeUiStateManager } from "@/app/home/HomeUiStateManager";
import { PROJECT_SESSION_DISPLAY_BATCH_SIZE } from "@/app/home/constants";

describe("HomeUiStateManager", () => {
  it("tracks project session reveal counts without persisting them as collapsed state", () => {
    const manager = new HomeUiStateManager();
    const controls = manager as unknown as {
      revealMoreProjectSessions?: (projectPath: string) => void;
      resetProjectSessionDisplayLimit?: (projectPath: string) => void;
    };

    expect(manager.getSnapshot().visibleProjectSessionCounts).toEqual({});
    expect(typeof controls.revealMoreProjectSessions).toBe("function");
    expect(typeof controls.resetProjectSessionDisplayLimit).toBe("function");

    controls.revealMoreProjectSessions?.("/workspace/app");
    expect(manager.getSnapshot().visibleProjectSessionCounts["/workspace/app"]).toBe(
      PROJECT_SESSION_DISPLAY_BATCH_SIZE * 2,
    );

    manager.setKey("collapsedProjectPaths", new Set(["/workspace/app"]));
    expect(manager.getSnapshot().visibleProjectSessionCounts["/workspace/app"]).toBe(
      PROJECT_SESSION_DISPLAY_BATCH_SIZE * 2,
    );

    controls.resetProjectSessionDisplayLimit?.("/workspace/app");
    expect(manager.getSnapshot().visibleProjectSessionCounts).toEqual({});
  });

  it("collapses projects without resetting session counts for unrelated groups", () => {
    const manager = new HomeUiStateManager();
    manager.revealMoreProjectSessions("/workspace/app");
    manager.revealMoreProjectSessions("/workspace/other");

    manager.collapseProjects(["/workspace/app"]);

    const snapshot = manager.getSnapshot();
    expect(snapshot.collapsedProjectPaths).toEqual(new Set(["/workspace/app"]));
    expect(snapshot.visibleProjectSessionCounts).toEqual({
      "/workspace/other": PROJECT_SESSION_DISPLAY_BATCH_SIZE * 2,
    });
  });

  it("defaults selectedConversationMode to 'direct'", () => {
    const manager = new HomeUiStateManager();
    expect(manager.getSnapshot().selectedConversationMode).toBe("direct");
  });

  it("updates composer command and cursor with a single notification", () => {
    const manager = new HomeUiStateManager();
    let notifications = 0;
    manager.subscribe(() => {
      notifications += 1;
    });

    manager.setComposerDraft({ command: "hello", commandCursor: 5 });

    expect(manager.getSnapshot().command).toBe("hello");
    expect(manager.getSnapshot().commandCursor).toBe(5);
    expect(notifications).toBe(1);
  });

  it("restores saved composer drafts when switching between selected runs", () => {
    const manager = new HomeUiStateManager();

    manager.selectRun("run-a");
    manager.setComposerDraft({ command: "draft for A", commandCursor: 11 });
    manager.selectRun("run-b");
    manager.setComposerDraft({ command: "draft for B", commandCursor: 7 });
    manager.selectRun("run-a");

    expect(manager.getSnapshot().command).toBe("draft for A");
    expect(manager.getSnapshot().commandCursor).toBe(11);
  });
});
