import type { RecoveryIncidentRecord, RunRecoveryState } from "./types";

export function recoveryTone(state: RunRecoveryState | null | undefined) {
  if (!state) return "muted" as const;
  if (state.status === "failed") return "error" as const;
  if (state.status === "needs_user" || state.kind === "needs_recovery") return "warning" as const;
  if (state.status === "recovering") return "active" as const;
  return "warning" as const;
}

export function recoveryTitleKey(state: RunRecoveryState | null | undefined) {
  if (!state) return "recovery.notice.title.default";
  if (state.kind === "quota_waiting") return "recovery.notice.title.quotaWaiting";
  if (state.status === "recovering") return "recovery.notice.title.recovering";
  if (state.status === "failed") return "recovery.notice.title.failed";
  if (state.kind === "queue_blocked") return "recovery.notice.title.queueBlocked";
  if (state.kind === "lost_worker_resumable") return "recovery.notice.title.workerDisconnected";
  if (state.kind === "lost_worker_rerunnable") return "recovery.notice.title.workerDisconnected";
  return "recovery.notice.title.needsRecovery";
}

export function recoveryDescriptionKey(state: RunRecoveryState | null | undefined) {
  if (!state) return "recovery.notice.description.empty";
  if (state.kind === "quota_waiting") return "recovery.notice.description.quotaWaiting";
  if (state.message?.trim()) return state.message.trim();
  if (state.lastError?.trim()) return state.lastError.trim();
  if (state.status === "recovering") return "recovery.notice.description.recovering";
  if (state.kind === "lost_worker_resumable") return "recovery.notice.description.lostWorkerResumable";
  if (state.kind === "lost_worker_rerunnable") return "recovery.notice.description.lostWorkerRerunnable";
  return "recovery.notice.description.needsRecovery";
}

export function latestRelevantRecoveryIncident(incidents: RecoveryIncidentRecord[]) {
  return [...incidents].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null;
}
