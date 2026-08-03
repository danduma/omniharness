export interface AppErrorDescriptor {
  message: string;
  source?: string;
  action?: string;
  suggestion?: string;
  details?: string[];
  status?: number;
  /**
   * Conversation this error belongs to. A scoped error is only rendered while
   * that conversation is selected; leaving it unset marks the error as
   * app-global (settings, auth, filesystem) and shows it everywhere. Without
   * this, a failure in one session followed the user into every other session
   * for the rest of the page's life.
   */
  runId?: string | null;
}

export class AppRequestError extends Error {
  descriptor: AppErrorDescriptor;

  constructor(descriptor: AppErrorDescriptor) {
    super(descriptor.message);
    this.name = "AppRequestError";
    this.descriptor = descriptor;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asDetails(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

export function normalizeAppError(
  value: unknown,
  fallback: Partial<AppErrorDescriptor> = {},
): AppErrorDescriptor {
  if (value instanceof AppRequestError) {
    return value.descriptor.runId === undefined && fallback.runId !== undefined
      ? { ...value.descriptor, runId: fallback.runId }
      : value.descriptor;
  }

  if (value instanceof Error) {
    return {
      message: value.message || fallback.message || "Unknown error",
      source: fallback.source,
      action: fallback.action,
      suggestion: fallback.suggestion,
      details: fallback.details,
      status: fallback.status,
      runId: fallback.runId,
    };
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") {
      return {
        message: record.error,
        source: asString(record.source) || fallback.source,
        action: asString(record.action) || fallback.action,
        suggestion: asString(record.suggestion) || fallback.suggestion,
        details: asDetails(record.details).length > 0 ? asDetails(record.details) : fallback.details,
        status: typeof record.status === "number" ? record.status : fallback.status,
        runId: fallback.runId,
      };
    }

    if (typeof record.error === "object" && record.error !== null) {
      return normalizeAppError(record.error, fallback);
    }

    const message = asString(record.message);
    if (message) {
      const details = asDetails(record.details);
      return {
        message,
        source: asString(record.source) || fallback.source,
        action: asString(record.action) || fallback.action,
        suggestion: asString(record.suggestion) || fallback.suggestion,
        details: details.length > 0 ? details : fallback.details,
        status: typeof record.status === "number" ? record.status : fallback.status,
        runId: fallback.runId,
      };
    }
  }

  if (typeof value === "string" && value.trim()) {
    return {
      message: value.trim(),
      source: fallback.source,
      action: fallback.action,
      suggestion: fallback.suggestion,
      details: fallback.details,
      status: fallback.status,
      runId: fallback.runId,
    };
  }

  return {
    message: fallback.message || "Unknown error",
    source: fallback.source,
    action: fallback.action,
    suggestion: fallback.suggestion,
    details: fallback.details,
    status: fallback.status,
    runId: fallback.runId,
  };
}

export async function parseErrorResponse(
  response: Response,
  fallback: Partial<AppErrorDescriptor> = {},
) {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }

  return normalizeAppError(payload, {
    message: fallback.message || `Request failed with status ${response.status}`,
    source: fallback.source,
    action: fallback.action,
    suggestion: fallback.suggestion,
    details: fallback.details,
    status: response.status,
  });
}

export function appErrorKey(error: AppErrorDescriptor) {
  return [
    error.runId || "",
    error.source || "",
    error.action || "",
    error.message,
    error.suggestion || "",
    ...(error.details ?? []),
  ].join("|");
}

/**
 * An error is visible only in the conversation it came from. Errors with no
 * `runId` are app-global and always visible.
 */
export function isAppErrorInScope(error: AppErrorDescriptor, selectedRunId: string | null) {
  return !error.runId || error.runId === selectedRunId;
}

export function mergeAppErrors(current: AppErrorDescriptor[], incoming: AppErrorDescriptor[]) {
  const byKey = new Map<string, AppErrorDescriptor>();

  for (const error of [...current, ...incoming]) {
    byKey.set(appErrorKey(error), error);
  }

  return [...byKey.values()];
}
