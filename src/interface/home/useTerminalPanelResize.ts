"use client";

import { useEffect, type RefObject } from "react";
import { clampTerminalPanelWidth } from "./constants";
import { homeUiSetters } from "./HomeUiStateManager";

/**
 * Drag-to-resize for the desktop terminal pane. The pane sits between the
 * conversation and the workspace rail, so its width is measured from the pane's
 * own right edge (captured at drag start) rather than the viewport edge — this
 * stays correct whether or not the right rail is open.
 */
export function useTerminalPanelResize(
  isResizing: boolean,
  paneRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!isResizing || typeof window === "undefined") {
      return;
    }

    const rightEdge = paneRef.current?.getBoundingClientRect().right ?? window.innerWidth;
    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = rightEdge - event.clientX;
      homeUiSetters.setTerminalPanelWidth(clampTerminalPanelWidth(nextWidth, window.innerWidth));
    };
    const stopResizing = () => {
      homeUiSetters.setIsResizingTerminalPanel(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizing, paneRef]);
}
