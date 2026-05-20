const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ELOCKED",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const RECOVERABLE_CONNECTION_ERROR_CODES = new Set([
  "EAI_AGAIN",
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
  /\b(?:ECONNABORTED|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETDOWN|ENETUNREACH|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_SOCKET)\b/i,
  /\bENOTFOUND\b/i,
  /\bNo spawnable worker is available\b/i,
  /\bACP adapter is not installed\b/i,
  /\bAgent session did not include a session id\b/i,
  /\bagent is busy\b/i,
  /\bgetaddrinfo\b/i,
  /\bfetch failed\b/i,
  /\bworker output lock\b/i,
  /\block file is already being held\b/i,
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
  /\bworker binary is not installed\b/i,
];

export interface RetrySupervisorRequestOptions {
  attempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  operationTimeoutMs?: number;
  operationLabel?: string;
  retryIndefinitelyWhen?: (error: unknown) => boolean;
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
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    retryable?: unknown;
    cause?: unknown;
  };

  return [
    {
      name: typeof record.name === "string" ? record.name : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
      statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
      retryable: typeof record.retryable === "boolean" ? record.retryable : undefined,
    },
    ...extractErrorChain(record.cause, seen),
  ];
}

function compactLogText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function describeRetryError(error: unknown) {
  const details = extractErrorChain(error)
    .map((entry) => {
      const name = typeof entry.name === "string" ? compactLogText(entry.name) : "";
      const message = typeof entry.message === "string" ? compactLogText(entry.message) : "";
      const code = typeof entry.code === "string" ? compactLogText(entry.code).toUpperCase() : "";
      const status = typeof entry.status === "number" ? entry.status : entry.statusCode;

      if (message) {
        if (code) {
          return `${code}: ${message}`;
        }
        if (name && name !== "Error") {
          return `${name}: ${message}`;
        }
        return message;
      }

      if (code) {
        return code;
      }
      if (typeof status === "number") {
        return `HTTP ${status}`;
      }
      return "";
    })
    .filter((detail) => detail.length > 0);

  return details.length > 0 ? details.join("; caused by ") : String(error);
}

function formatMaxDelayMs(maxDelayMs: number) {
  return Number.isFinite(maxDelayMs) ? `${maxDelayMs}ms` : "uncapped";
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

export function isRecoverableConnectionSupervisorError(error: unknown) {
  return extractErrorChain(error).some((entry) => {
    const message = typeof entry.message === "string" ? entry.message : "";
    const code = typeof entry.code === "string" ? entry.code.toUpperCase() : "";
    return (
      RECOVERABLE_CONNECTION_ERROR_CODES.has(code) ||
      /\b(?:EAI_AGAIN|ECONNABORTED|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETDOWN|ENETUNREACH|ENOTFOUND|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_SOCKET)\b/i.test(message) ||
      /\bgetaddrinfo\b/i.test(message) ||
      /\bfetch failed\b/i.test(message) ||
      /\bnetwork\b/i.test(message) ||
      /\bsocket hang up\b/i.test(message) ||
      /\bother side closed\b/i.test(message)
    );
  });
}

function exponentialDelayMs(attempt: number, initialDelayMs: number, maxDelayMs: number) {
  if (initialDelayMs === 0 || maxDelayMs === 0) {
    return 0;
  }
  return Math.min(maxDelayMs, initialDelayMs * 2 ** Math.min(30, attempt - 1));
}

function runWithOperationTimeout<T>(operation: () => Promise<T>, timeoutMs: number | undefined) {
  if (timeoutMs === undefined || timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    return operation();
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Supervisor request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export async function retrySupervisorRequest<T>(
  operation: () => Promise<T>,
  options: RetrySupervisorRequestOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? 1000);
  const maxDelayMs = Math.max(0, options.maxDelayMs ?? Number.POSITIVE_INFINITY);
  const sleep = options.sleep ?? defaultSleep;
  const operationLabel = options.operationLabel ? compactLogText(options.operationLabel) : "";
  const requestSubject = operationLabel ? `Supervisor request ${operationLabel}` : "Supervisor request";

  let lastError: unknown;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runWithOperationTimeout(operation, options.operationTimeoutMs);
    } catch (error) {
      lastError = error;

      const retryIndefinitely = options.retryIndefinitelyWhen?.(error) === true;
      if (!isTransientSupervisorError(error) || (!retryIndefinitely && attempt === attempts)) {
        throw error;
      }

      const delayMs = exponentialDelayMs(attempt, initialDelayMs, maxDelayMs);
      const attemptLabel = retryIndefinitely
        ? `attempt ${attempt}`
        : `attempt ${attempt} of ${attempts}`;
      console.warn(
        `${requestSubject} failed with a retryable error (${attemptLabel}; ` +
        `${retryIndefinitely ? "retrying indefinitely" : "retrying while attempts remain"}; ` +
        `next delay ${delayMs}ms; max delay ${formatMaxDelayMs(maxDelayMs)}): ${describeRetryError(error)}`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
