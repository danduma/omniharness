export type RunState = "analyzing" | "awaiting_user" | "executing" | "validating" | "completed";

export interface RunSnapshot {
  status: RunState | string;
  pendingClarifications: number;
  unvalidatedDoneItems: number;
  pendingItems: number;
}

export function nextRunState(snapshot: RunSnapshot): RunState {
  if (snapshot.pendingClarifications > 0) return "awaiting_user";
  if (snapshot.unvalidatedDoneItems > 0) return "validating";
  if (snapshot.pendingItems > 0) return "executing";
  return "completed";
}

export function describeRunState(snapshot: RunSnapshot) {
  return {
    current: snapshot.status,
    next: nextRunState(snapshot),
  };
}
