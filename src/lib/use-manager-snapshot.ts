"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { StateManager } from "@/lib/state-manager";

export function useManagerSnapshot<TState>(manager: StateManager<TState>) {
  return useSyncExternalStore(
    useCallback((listener) => manager.subscribe(listener), [manager]),
    useCallback(() => manager.getSnapshot(), [manager]),
    useCallback(() => manager.getInitialSnapshot(), [manager]),
  );
}

export function shallowEqualRecord<TRecord extends Record<string, unknown>>(
  left: TRecord,
  right: TRecord,
) {
  if (Object.is(left, right)) {
    return true;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key)
    && Object.is(left[key], right[key]));
}

export function useManagerSelector<TState, TSelected>(
  manager: StateManager<TState>,
  selector: (state: TState) => TSelected,
  isEqual: (left: TSelected, right: TSelected) => boolean = Object.is,
) {
  const selectionRef = useRef<{
    state: TState;
    selection: TSelected;
  } | null>(null);
  const serverSelectionRef = useRef<{
    state: TState;
    selector: (state: TState) => TSelected;
    selection: TSelected;
  } | null>(null);

  const getSelectedSnapshot = useCallback(() => {
    const state = manager.getSnapshot();
    const previous = selectionRef.current;
    if (previous?.state === state) {
      return previous.selection;
    }

    const nextSelection = selector(state);
    if (previous && isEqual(previous.selection, nextSelection)) {
      selectionRef.current = {
        state,
        selection: previous.selection,
      };
      return previous.selection;
    }

    selectionRef.current = {
      state,
      selection: nextSelection,
    };
    return nextSelection;
  }, [isEqual, manager, selector]);
  const getServerSelectedSnapshot = useCallback(() => {
    const state = manager.getInitialSnapshot();
    const previous = serverSelectionRef.current;
    if (previous?.state === state && previous.selector === selector) {
      return previous.selection;
    }
    const selection = selector(state);
    serverSelectionRef.current = { state, selector, selection };
    return selection;
  }, [manager, selector]);

  return useSyncExternalStore(
    useCallback((listener) => manager.subscribe(listener), [manager]),
    getSelectedSnapshot,
    getServerSelectedSnapshot,
  );
}
