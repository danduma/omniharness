const TERMINAL_RUN_STATUSES = new Set(["done", "failed", "cancelled"]);

export function normalizeRunStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

export function isTerminalRunStatus(status: string | null | undefined) {
  return TERMINAL_RUN_STATUSES.has(normalizeRunStatus(status));
}

export function isActiveImplementationRun(run: { mode?: string | null; status?: string | null } | null | undefined) {
  return Boolean(run && run.mode === "implementation" && !isTerminalRunStatus(run.status));
}
