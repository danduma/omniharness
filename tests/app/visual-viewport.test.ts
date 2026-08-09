import { describe, expect, test } from "vitest";
import { getVisualViewportDialogStyle } from "@/hooks/use-visual-viewport";

describe("visual viewport dialog positioning", () => {
  test("centers within the visible viewport and leaves room for its gutters", () => {
    expect(getVisualViewportDialogStyle({ height: 480, offsetTop: 24 })).toEqual({
      top: "264px",
      maxHeight: "448px",
    });
  });

  test("does not emit an inline override during the server snapshot", () => {
    expect(getVisualViewportDialogStyle({ height: null, offsetTop: 0 })).toBeUndefined();
  });
});
