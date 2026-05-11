import { describe, expect, it } from "vitest";
import { FileViewerPanelManager } from "@/components/component-state-managers";

describe("FileViewerPanelManager", () => {
  it("toggles word wrap as a shared file viewer preference", () => {
    const manager = new FileViewerPanelManager();

    expect(manager.getSnapshot().wordWrap).toBe(true);

    manager.toggleWordWrap();
    expect(manager.getSnapshot().wordWrap).toBe(false);

    manager.toggleWordWrap();
    expect(manager.getSnapshot().wordWrap).toBe(true);
  });
});
