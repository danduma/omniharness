interface LoginRateLimitRecord {
  failedAttempts: number;
  firstFailedAt: number;
  lastFailedAt: number;
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const records = new Map<string, LoginRateLimitRecord>();

function now() {
  return Date.now();
}

function getRecord(key: string, timestamp = now()) {
  const existing = records.get(key);
  if (!existing) {
    return null;
  }

  if (timestamp - existing.firstFailedAt > WINDOW_MS && existing.lockedUntil <= timestamp) {
    records.delete(key);
    return null;
  }

  return existing;
}

function getLockoutMs(record: LoginRateLimitRecord, timestamp = now()) {
  return Math.max(0, record.lockedUntil - timestamp);
}

function keysForLoginAttempt(ipAddress: string | null) {
  return [
    "account:omniharness",
    `ip:${ipAddress || "unknown"}`,
  ];
}

export function getLoginRateLimitStatus(ipAddress: string | null) {
  const timestamp = now();
  const locked = keysForLoginAttempt(ipAddress)
    .map((key) => getRecord(key, timestamp))
    .filter((record): record is LoginRateLimitRecord => Boolean(record))
    .map((record) => getLockoutMs(record, timestamp))
    .filter((remainingMs) => remainingMs > 0)
    .sort((left, right) => right - left)[0] ?? 0;

  return {
    locked: locked > 0,
    retryAfterSeconds: locked > 0 ? Math.ceil(locked / 1000) : 0,
  };
}

export function recordFailedLoginAttempt(ipAddress: string | null) {
  const timestamp = now();

  for (const key of keysForLoginAttempt(ipAddress)) {
    const existing = getRecord(key, timestamp);
    const nextFailedAttempts = (existing?.failedAttempts ?? 0) + 1;
    const lockedUntil = nextFailedAttempts >= MAX_FAILED_ATTEMPTS
      ? timestamp + LOCKOUT_MS
      : 0;

    records.set(key, {
      failedAttempts: nextFailedAttempts,
      firstFailedAt: existing?.firstFailedAt ?? timestamp,
      lastFailedAt: timestamp,
      lockedUntil,
    });
  }
}

export function recordSuccessfulLoginAttempt(ipAddress: string | null) {
  for (const key of keysForLoginAttempt(ipAddress)) {
    records.delete(key);
  }
}

export function resetLoginRateLimitsForTests() {
  records.clear();
}
