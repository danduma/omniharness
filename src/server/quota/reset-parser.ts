export type QuotaResetSource =
  | "retry-after-header"
  | "absolute-timestamp"
  | "relative-duration"
  | "time-of-day"
  | "reset-schedule"
  | "quota-without-reset";

export type QuotaResetConfidence = "high" | "medium" | "low";

export type QuotaResetInfo = {
  isQuotaError: boolean;
  resetAt: Date | null;
  retryAfterMs: number | null;
  source: QuotaResetSource;
  confidence: QuotaResetConfidence;
  rawText: string;
  provider?: string | null;
};

export type QuotaResetParseOptions = {
  now?: Date | number;
  provider?: string | null;
};

export type NormalizeQuotaResumeOptions = {
  now?: Date | number;
  quotaResetGraceMs?: number;
  maxQuotaWaitMs?: number;
  allowQuotaWaitWithoutParsedReset?: boolean;
};

const QUOTA_LANGUAGE_PATTERN = /\b(?:quota|credit|credits|usage limit|subscription limit|billing limit|resource exhausted|insufficient quota|rate limit(?:ed)?|too many requests)\b/i;
const RESET_LANGUAGE_PATTERN = /\b(?:retry-after|retry after|try again|reset|resets|available|until|after)\b/i;
const GENERIC_OVERLOAD_PATTERN = /\b(?:overloaded|busy|temporar(?:y|ily)|service unavailable|server error|capacity|traffic)\b/i;
const CLOCK_SKEW_MS = 60_000;

function nowDate(value: Date | number | undefined) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  return new Date();
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function baseInfo(args: {
  isQuotaError: boolean;
  resetAt?: Date | null;
  retryAfterMs?: number | null;
  source?: QuotaResetSource;
  confidence?: QuotaResetConfidence;
  rawText: string;
  provider?: string | null;
}): QuotaResetInfo {
  return {
    isQuotaError: args.isQuotaError,
    resetAt: isValidDate(args.resetAt) ? args.resetAt : null,
    retryAfterMs: typeof args.retryAfterMs === "number" && Number.isFinite(args.retryAfterMs)
      ? Math.max(0, Math.floor(args.retryAfterMs))
      : null,
    source: args.source ?? "quota-without-reset",
    confidence: args.confidence ?? "low",
    rawText: args.rawText,
    provider: args.provider ?? null,
  };
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function coerceHeaderValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" || typeof item === "number");
    return first === undefined ? null : String(first);
  }
  return null;
}

function getHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  const getter = (headers as { get?: unknown }).get;
  if (typeof getter === "function") {
    try {
      const value = getter.call(headers, name) ?? getter.call(headers, name.toLowerCase());
      const coerced = coerceHeaderValue(value);
      if (coerced) {
        return coerced;
      }
    } catch {
      // Fall through to object-style probing.
    }
  }

  if (headers instanceof Map) {
    for (const [key, value] of headers.entries()) {
      if (String(key).toLowerCase() === name.toLowerCase()) {
        return coerceHeaderValue(value);
      }
    }
    return null;
  }

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return coerceHeaderValue(value);
    }
  }

  return null;
}

function parseRetryAfter(value: string, now: Date): { resetAt: Date; retryAfterMs: number } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    const retryAfterMs = Math.floor(seconds * 1000);
    return { retryAfterMs, resetAt: new Date(now.getTime() + retryAfterMs) };
  }

  const parsed = new Date(trimmed);
  if (!isValidDate(parsed)) {
    return null;
  }

  return {
    resetAt: parsed,
    retryAfterMs: Math.max(0, parsed.getTime() - now.getTime()),
  };
}

function parseAbsoluteTimestamp(text: string): { resetAt: Date; confidence: QuotaResetConfidence } | null {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:\s?(?:Z|[+-]\d{2}:?\d{2}))?)\b/);
  if (iso) {
    const normalized = iso[1].replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    const parsed = new Date(normalized);
    if (isValidDate(parsed)) {
      return { resetAt: parsed, confidence: /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso[1]) ? "high" : "medium" };
    }
  }

  const phrase = text.match(/\b(?:(?:try again|retry)\s+after|until|after|at|on)\s+([A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\s*(?:GMT[+-]\d{1,2}|UTC[+-]\d{1,2}|Z)?)\b/i);
  if (phrase) {
    const parsed = new Date(phrase[1]);
    if (isValidDate(parsed)) {
      return { resetAt: parsed, confidence: "medium" };
    }
  }

  return null;
}

function parseRelativeDuration(text: string): { resetAt: Date; retryAfterMs: number } | null {
  const relativePhrases = [
    /\b(?:try again|retry|reset|resets|available)?\s*(?:in|after)\s+((?:(?:\d+(?:\.\d+)?)\s*(?:days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\s*){1,4})\b/i,
    /\breset\s+in\s+((?:(?:\d+(?:\.\d+)?)\s*(?:days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\s*){1,4})\b/i,
  ];
  const phrase = relativePhrases.map((pattern) => text.match(pattern)).find(Boolean);
  if (!phrase) {
    return null;
  }

  let totalMs = 0;
  const durationText = phrase[1];
  const partPattern = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi;
  for (const match of durationText.matchAll(partPattern)) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    if (unit === "d" || unit.startsWith("day")) {
      totalMs += amount * 24 * 60 * 60_000;
    } else if (unit === "h" || unit.startsWith("h")) {
      totalMs += amount * 60 * 60_000;
    } else if (unit === "m" || unit.startsWith("min")) {
      totalMs += amount * 60_000;
    } else {
      totalMs += amount * 1000;
    }
  }

  if (totalMs <= 0) {
    return null;
  }

  return { retryAfterMs: Math.floor(totalMs), resetAt: new Date(Date.now() + totalMs) };
}

function parseRelativeDurationAt(text: string, now: Date) {
  const parsed = parseRelativeDuration(text);
  if (!parsed) {
    return null;
  }
  return {
    retryAfterMs: parsed.retryAfterMs,
    resetAt: new Date(now.getTime() + parsed.retryAfterMs),
  };
}

function parseTimeOfDay(text: string, now: Date): Date | null {
  const match = text.match(/\b(?:until|after|at|reset(?:s)? at|try again at)\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const marker = match[3].toUpperCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  if (marker === "PM" && hour !== 12) {
    hour += 12;
  } else if (marker === "AM" && hour === 12) {
    hour = 0;
  }

  const resetAt = new Date(now.getTime());
  resetAt.setHours(hour, minute, 0, 0);
  if (resetAt.getTime() <= now.getTime()) {
    resetAt.setDate(resetAt.getDate() + 1);
  }
  return resetAt;
}

function looksLikeQuota(text: string, hasResetSignal: boolean) {
  if (QUOTA_LANGUAGE_PATTERN.test(text)) {
    if (/\b429\b/.test(text) && GENERIC_OVERLOAD_PATTERN.test(text) && !RESET_LANGUAGE_PATTERN.test(text)) {
      return false;
    }
    return true;
  }

  return hasResetSignal && RESET_LANGUAGE_PATTERN.test(text);
}

export function parseQuotaResetText(text: string, options: QuotaResetParseOptions = {}): QuotaResetInfo {
  const rawText = compactText(text);
  const now = nowDate(options.now);
  if (!rawText) {
    return baseInfo({ isQuotaError: false, rawText, provider: options.provider });
  }

  const absolute = parseAbsoluteTimestamp(rawText);
  const relative = parseRelativeDurationAt(rawText, now);
  const timeOnly = parseTimeOfDay(rawText, now);
  const hasResetSignal = Boolean(absolute || relative || timeOnly);
  const quota = looksLikeQuota(rawText, hasResetSignal);

  if (!quota) {
    return baseInfo({ isQuotaError: false, rawText, provider: options.provider });
  }

  if (absolute) {
    if (absolute.resetAt.getTime() < now.getTime() - CLOCK_SKEW_MS && absolute.confidence === "medium") {
      return baseInfo({
        isQuotaError: true,
        source: "quota-without-reset",
        confidence: "low",
        rawText,
        provider: options.provider,
      });
    }
    return baseInfo({
      isQuotaError: true,
      resetAt: absolute.resetAt,
      retryAfterMs: Math.max(0, absolute.resetAt.getTime() - now.getTime()),
      source: "absolute-timestamp",
      confidence: absolute.confidence,
      rawText,
      provider: options.provider,
    });
  }

  if (relative) {
    return baseInfo({
      isQuotaError: true,
      resetAt: relative.resetAt,
      retryAfterMs: relative.retryAfterMs,
      source: "relative-duration",
      confidence: "high",
      rawText,
      provider: options.provider,
    });
  }

  if (timeOnly) {
    return baseInfo({
      isQuotaError: true,
      resetAt: timeOnly,
      retryAfterMs: Math.max(0, timeOnly.getTime() - now.getTime()),
      source: "time-of-day",
      confidence: "medium",
      rawText,
      provider: options.provider,
    });
  }

  return baseInfo({
    isQuotaError: true,
    source: "quota-without-reset",
    confidence: "low",
    rawText,
    provider: options.provider,
  });
}

function collectErrorRecords(value: unknown, seen = new Set<unknown>()): Array<Record<string, unknown>> {
  if (value == null || seen.has(value)) {
    return [];
  }

  if (typeof value !== "object") {
    return [{ message: String(value) }];
  }

  seen.add(value);
  const record = value as Record<string, unknown>;
  return [
    record,
    ...collectErrorRecords(record.cause, seen),
    ...collectErrorRecords(record.error, seen),
    ...collectErrorRecords(record.response, seen),
  ];
}

function errorRecordText(record: Record<string, unknown>) {
  return [
    typeof record.name === "string" ? record.name : "",
    typeof record.code === "string" ? record.code : "",
    typeof record.status === "number" ? `HTTP ${record.status}` : "",
    typeof record.statusCode === "number" ? `HTTP ${record.statusCode}` : "",
    typeof record.message === "string" ? record.message : "",
    typeof record.statusText === "string" ? record.statusText : "",
    typeof record.body === "string" ? record.body : "",
    typeof record.text === "string" ? record.text : "",
  ].filter(Boolean).join(" ");
}

export function extractQuotaResetInfo(error: unknown, options: QuotaResetParseOptions = {}): QuotaResetInfo {
  const now = nowDate(options.now);
  const records = collectErrorRecords(error);
  for (const record of records) {
    const retryAfter = getHeader(record.headers, "retry-after")
      ?? getHeader((record.response as Record<string, unknown> | undefined)?.headers, "retry-after");
    if (!retryAfter) {
      continue;
    }

    const parsed = parseRetryAfter(retryAfter, now);
    if (!parsed) {
      continue;
    }

    const rawText = compactText(errorRecordText(record) || `Retry-After: ${retryAfter}`);
    return baseInfo({
      isQuotaError: true,
      resetAt: parsed.resetAt,
      retryAfterMs: parsed.retryAfterMs,
      source: "retry-after-header",
      confidence: "high",
      rawText,
      provider: options.provider,
    });
  }

  const text = compactText(records.map(errorRecordText).filter(Boolean).join("; ") || String(error ?? ""));
  return parseQuotaResetText(text, { now, provider: options.provider });
}

export function normalizeQuotaResumeAt(
  info: QuotaResetInfo,
  options: NormalizeQuotaResumeOptions = {},
) {
  if (!info.isQuotaError) {
    return null;
  }

  const now = nowDate(options.now);
  if (!info.resetAt) {
    return options.allowQuotaWaitWithoutParsedReset ? new Date(now.getTime()) : null;
  }

  const graceMs = Math.max(0, Math.floor(options.quotaResetGraceMs ?? 1_000));
  const maxWaitMs = Math.max(1, Math.floor(options.maxQuotaWaitMs ?? 24 * 60 * 60_000));
  const resetAtMs = info.resetAt.getTime();
  if (!Number.isFinite(resetAtMs)) {
    return null;
  }

  const waitMs = Math.max(0, resetAtMs - now.getTime());
  if (waitMs > maxWaitMs) {
    return null;
  }

  return new Date(Math.max(now.getTime(), resetAtMs) + graceMs);
}
