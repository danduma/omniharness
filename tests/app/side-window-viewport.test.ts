import { describe, expect, it } from "vitest";
import { shouldOpenMobileSideWindow } from "@/app/home/side-window-viewport";

describe("shouldOpenMobileSideWindow", () => {
  it("uses the desktop rail at lg viewports", () => {
    expect(shouldOpenMobileSideWindow({
      matchMedia: (query) => ({
        matches: query === "(min-width: 1024px)",
      }),
    })).toBe(false);
  });

  it("uses the mobile sheet below lg viewports", () => {
    expect(shouldOpenMobileSideWindow({
      matchMedia: () => ({ matches: false }),
    })).toBe(true);
  });
});
