"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { StateManager } from "@/lib/state-manager";

export function useManagerSnapshot<TState>(manager: StateManager<TState>) {
  return useSyncExternalStore(
    useCallback((listener) => manager.subscribe(listener), [manager]),
    useCallback(() => manager.getSnapshot(), [manager]),
    () => manager.getSnapshot(),
  );
}
