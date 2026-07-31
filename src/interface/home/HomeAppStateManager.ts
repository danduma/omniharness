import { StateManager } from "@/lib/state-manager";
import type { HomeUiState } from "./HomeUiStateManager";

export class AutoResumeExhaustionManager extends StateManager<Set<string>> {
  constructor() {
    super(new Set());
  }

  clear(runId: string) {
    this.update((current) => {
      if (!current.has(runId)) return current;
      const next = new Set(current);
      next.delete(runId);
      return next;
    });
  }

  mark(runId: string) {
    this.update((current) => {
      if (current.has(runId)) return current;
      return new Set(current).add(runId);
    });
  }
}

export const autoResumeExhaustionManager = new AutoResumeExhaustionManager();

export type HomeAppState = Omit<
  HomeUiState,
  "command" | "commandCursor" | "mentionIndex" | "attachments"
>;

export function selectHomeAppState(state: HomeUiState): HomeAppState {
  const selected: Partial<HomeUiState> = { ...state };
  delete selected.command;
  delete selected.commandCursor;
  delete selected.mentionIndex;
  delete selected.attachments;
  return selected as HomeAppState;
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeReadMarkers(
  persisted: Record<string, string> | null | undefined,
  optimistic: Record<string, string>,
) {
  const merged = { ...(persisted ?? {}) };
  for (const [runId, readAt] of Object.entries(optimistic)) {
    if (timestampMs(readAt) >= timestampMs(merged[runId])) {
      merged[runId] = readAt;
    }
  }
  return merged;
}
