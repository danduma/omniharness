const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const RETRYABLE_MESSAGE_PATTERNS = [
  /\bENOTFOUND\b/i,
  /\bgetaddrinfo\b/i,
  /\bfetch failed\b/i,
  /\brate limit\b/i,
  /\btemporar(?:y|ily)\b/i,
  /\btimed out\b/i,
  /\btimeout\b/i,
  /\btoo many requests\b/i,
  /\bservice unavailable\b/i,
  /\bbad gateway\b/i,
  /\bgateway timeout\b/i,
  /\boverloaded\b/i,
  /\bnetwork\b/i,
  /\bsocket hang up\b/i,
  /\bother side closed\b/i,
];

export interface RetrySupervisorRequestOptions {
  attempts?: number;
  initialDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function extractErrorChain(error: unknown, seen = new Set<unknown>()): Array<Record<string, unknown>> {
  if (error == null || seen.has(error)) {
    return [];
  }

  if (typeof error !== "object") {
    return [{ message: String(error) }];
  }

  seen.add(error);

  const record = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    retryable?: unknown;
    cause?: unknown;
  };

  return [
    {
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
      statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
      retryable: typeof record.retryable === "boolean" ? record.retryable : undefined,
    },
    ...extractErrorChain(record.cause, seen),
  ];
}

export function isTransientSupervisorError(error: unknown) {
  const chain = extractErrorChain(error);

  const explicitOverride = chain.find((entry) => typeof entry.retryable === "boolean");
  if (explicitOverride && typeof explicitOverride.retryable === "boolean") {
    return explicitOverride.retryable;
  }

  return chain.some((entry) => {
    const message = typeof entry.message === "string" ? entry.message : "";
    const code = typeof entry.code === "string" ? entry.code.toUpperCase() : "";
    const statusCandidates = [entry.status, entry.statusCode].filter((value): value is number => typeof value === "number");

    return (
      (code.length > 0 && RETRYABLE_ERROR_CODES.has(code)) ||
      statusCandidates.some((status) => RETRYABLE_STATUS_CODES.has(status)) ||
      RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
    );
  });
}

export async function retrySupervisorRequest<T>(
  operation: () => Promise<T>,
  options: RetrySupervisorRequestOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? 250);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientSupervisorError(error) || attempt === attempts) {
        throw error;
      }

      const delayMs = initialDelayMs * 2 ** (attempt - 1);
      console.warn(
        `Supervisor model request failed with a retryable error (attempt ${attempt} of ${attempts}). Retrying in ${delayMs}ms.`,
        error,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
