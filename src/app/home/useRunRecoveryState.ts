import { useMemo } from "react";
import { isTerminalRunStatus } from "@/lib/run-status";
import type { EventStreamState, RecoveryIncidentRecord, RunRecoveryState } from "./types";

export function resolveSelectedRecoveryState(
  state: EventStreamState,
  selectedRunId: string | null,
): RunRecoveryState | null {
  if (!selectedRunId) {
    return null;
  }

  const selectedRun = (state.runs || []).find((run) => run.id === selectedRunId) ?? null;
  if (isTerminalRunStatus(selectedRun?.status)) {
    return null;
  }

  return state.recoveryState?.workerId || state.recoveryState?.kind
    ? state.recoveryState
    : null;
}

export function useRunRecoveryState({
  state,
  selectedRunId,
}: {
  state: EventStreamState;
  selectedRunId: string | null;
}): {
  selectedRecoveryState: RunRecoveryState | null;
  selectedRecoveryIncidents: RecoveryIncidentRecord[];
} {
  return useMemo(() => {
    if (!selectedRunId) {
      return {
        selectedRecoveryState: null,
        selectedRecoveryIncidents: [],
      };
    }

    return {
      selectedRecoveryState: resolveSelectedRecoveryState(state, selectedRunId),
      selectedRecoveryIncidents: (state.recoveryIncidents || []).filter((incident) => incident.runId === selectedRunId),
    };
  }, [selectedRunId, state]);
}
