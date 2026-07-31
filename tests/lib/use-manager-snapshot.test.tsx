import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { StateManager } from "@/lib/state-manager";
import { useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";

describe("manager server snapshots", () => {
  test("SSR uses the manager's initial state even when a browser-owned value already exists", () => {
    const manager = new StateManager({ textSize: "default", count: 1 });
    manager.patch({ textSize: "large", count: 2 });

    function SnapshotProbe() {
      const state = useManagerSnapshot(manager);
      return <div data-size={state.textSize}>{state.count}</div>;
    }

    function SelectorProbe() {
      const selected = useManagerSelector(manager, (state) => ({
        textSize: state.textSize,
      }));
      return <div data-size={selected.textSize} />;
    }

    expect(renderToStaticMarkup(<SnapshotProbe />)).toBe(
      '<div data-size="default">1</div>',
    );
    expect(renderToStaticMarkup(<SelectorProbe />)).toBe(
      '<div data-size="default"></div>',
    );
  });
});
