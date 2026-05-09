import { useMemo } from "react";
import type { EventStreamState, RecoveryIncidentRecord, RunRecoveryState } from "./types";

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
      selectedRecoveryState: state.recoveryState?.workerId || state.recoveryState?.kind
        ? state.recoveryState
        : null,
      selectedRecoveryIncidents: (state.recoveryIncidents || []).filter((incident) => incident.runId === selectedRunId),
    };
  }, [selectedRunId, state.recoveryIncidents, state.recoveryState]);
}
