type SqliteBusyRetryOptions = {
  attempts?: number;
  delayMs?: number;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function isSqliteBusyError(error: unknown) {
  const visited = new Set<unknown>();
  let cause = error;
  while (cause && !visited.has(cause)) {
    visited.add(cause);
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/\b(SQLITE_BUSY|database is locked)\b/i.test(message)) return true;
    cause = typeof cause === "object" && "cause" in cause ? cause.cause : undefined;
  }
  return false;
}

export async function withSqliteBusyRetry<T>(
  operation: () => Promise<T> | T,
  options: SqliteBusyRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 6);
  const baseDelayMs = Math.max(0, options.delayMs ?? 50);

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === attempts - 1) {
        throw error;
      }
      await delay(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}
