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

  it("defaults selectedConversationMode to 'direct'", () => {
    const manager = new HomeUiStateManager();
    expect(manager.getSnapshot().selectedConversationMode).toBe("direct");
  });
});
