const WORKER_COMPLETION_TEXT_WAKE_THRESHOLD_CHARS = 600;
const COMPLETION_CUE_PATTERNS = [
  /\b(done|complete[sd]?|implemented|fixed|verified|passed|updated|added|removed|changed|delivered)\b/i,
  /\bverification\s*:/i,
  /\bsummary\s*:/i,
  /\btests?\s+(passed|pass|verified|succeeded)\b/i,
];
const INCOMPLETE_CUE_PATTERNS = [
  /\bi will\b/i,
  /\bwhich option do you prefer\b/i,
  /\bonce you confirm\b/i,
  /\bi will proceed\b/i,
  /\bwould you like\b/i,
  /\bdo you want\b/i,
  /\bplease confirm\b/i,
  /\bfor your feedback\b/i,
];

export function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

export function isLongWorkerCompletionText(text: string | null | undefined) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length >= WORKER_COMPLETION_TEXT_WAKE_THRESHOLD_CHARS
    && !INCOMPLETE_CUE_PATTERNS.some((pattern) => pattern.test(normalized))
    && COMPLETION_CUE_PATTERNS.some((pattern) => pattern.test(normalized));
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
