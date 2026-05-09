import type { RecoveryIncidentRecord, RunRecoveryState } from "./types";

export function recoveryTone(state: RunRecoveryState | null | undefined) {
  if (!state) return "muted" as const;
  if (state.status === "failed") return "error" as const;
  if (state.status === "needs_user" || state.kind === "needs_recovery") return "warning" as const;
  if (state.status === "recovering") return "active" as const;
  return "warning" as const;
}

export function recoveryTitle(state: RunRecoveryState | null | undefined) {
  if (!state) return "Recovery";
  if (state.status === "recovering") return "Recovering worker";
  if (state.status === "failed") return "Recovery failed";
  if (state.kind === "queue_blocked") return "Queued message blocked";
  if (state.kind === "lost_worker_resumable") return "Worker disconnected";
  if (state.kind === "lost_worker_rerunnable") return "Worker disconnected";
  return "Needs recovery";
}

export function recoveryDescription(state: RunRecoveryState | null | undefined) {
  if (!state) return "";
  if (state.message?.trim()) return state.message.trim();
  if (state.lastError?.trim()) return state.lastError.trim();
  if (state.status === "recovering") return "OmniHarness is restoring the worker session or restarting from the latest checkpoint.";
  if (state.kind === "lost_worker_resumable") return "The worker is missing from the runtime, but a saved session can be resumed.";
  if (state.kind === "lost_worker_rerunnable") return "The worker is missing from the runtime. The run can restart from the latest user checkpoint.";
  return "This run needs a recovery action before it can continue.";
}

export function latestRelevantRecoveryIncident(incidents: RecoveryIncidentRecord[]) {
  return [...incidents].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null;
}
