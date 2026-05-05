const WORKER_COMPLETION_TEXT_WAKE_THRESHOLD_CHARS = 600;

export function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

export function isLongWorkerCompletionText(text: string | null | undefined) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length >= WORKER_COMPLETION_TEXT_WAKE_THRESHOLD_CHARS;
}

export function workerTurnRecheckDelayMs(args: {
  responseText: string | null | undefined;
  stopReason?: string | null;
  defaultDelayMs: number;
}) {
  if (args.stopReason?.trim() || isLongWorkerCompletionText(args.responseText)) {
    return 0;
  }

  return args.defaultDelayMs;
}
