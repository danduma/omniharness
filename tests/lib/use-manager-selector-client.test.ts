import { beforeEach, describe, expect, it, vi } from "vitest";
import { StateManager } from "@/lib/state-manager";

const hookHarness = vi.hoisted(() => {
  const refs: Array<{ current: unknown }> = [];
  let cursor = 0;
  return {
    beginRender() {
      cursor = 0;
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      refs[index] ??= { current: initial };
      return refs[index] as { current: T };
    },
    reset() {
      refs.length = 0;
      cursor = 0;
    },
  };
});

vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useRef: <T>(initial: T) => hookHarness.useRef(initial),
  useSyncExternalStore: <T>(
    _subscribe: (listener: () => void) => () => void,
    getSnapshot: () => T,
  ) => getSnapshot(),
}));

import { useManagerSelector } from "@/lib/use-manager-snapshot";

describe("useManagerSelector client cache", () => {
  beforeEach(() => hookHarness.reset());

  it("reselects when a rerender changes only the selected context", () => {
    const manager = new StateManager({ byId: { first: "First", second: "Second" } });
    const render = (id: "first" | "second") => {
      hookHarness.beginRender();
      return useManagerSelector(manager, (state) => state.byId[id]);
    };

    expect(render("first")).toBe("First");
    expect(render("second")).toBe("Second");
  });

  it("does not reuse an equality result after the equality function changes", () => {
    const manager = new StateManager({ value: 1 });
    const render = (isEqual: (left: { value: number }, right: { value: number }) => boolean) => {
      hookHarness.beginRender();
      return useManagerSelector(manager, (state) => ({ value: state.value }), isEqual);
    };

    const first = render(() => true);
    manager.patch({ value: 2 });
    expect(render(() => true)).toBe(first);

    const afterEqualityChange = render(() => false);
    expect(afterEqualityChange).not.toBe(first);
    expect(afterEqualityChange.value).toBe(2);
  });
});
