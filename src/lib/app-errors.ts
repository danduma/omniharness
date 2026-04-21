export interface AppErrorDescriptor {
  message: string;
  source?: string;
  action?: string;
  suggestion?: string;
  details?: string[];
  status?: number;
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
    return value.descriptor;
  }

  if (value instanceof Error) {
    return {
      message: value.message || fallback.message || "Unknown error",
      source: fallback.source,
      action: fallback.action,
      suggestion: fallback.suggestion,
      details: fallback.details,
      status: fallback.status,
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
    };
  }

  return {
    message: fallback.message || "Unknown error",
    source: fallback.source,
    action: fallback.action,
    suggestion: fallback.suggestion,
    details: fallback.details,
    status: fallback.status,
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

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback: Partial<AppErrorDescriptor> = {},
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new AppRequestError(await parseErrorResponse(response, fallback));
  }
  return response.json() as Promise<T>;
}

export function appErrorKey(error: AppErrorDescriptor) {
  return [
    error.source || "",
    error.action || "",
    error.message,
    error.suggestion || "",
    ...(error.details ?? []),
  ].join("|");
}

export function mergeAppErrors(current: AppErrorDescriptor[], incoming: AppErrorDescriptor[]) {
  const byKey = new Map<string, AppErrorDescriptor>();

  for (const error of [...current, ...incoming]) {
    byKey.set(appErrorKey(error), error);
  }

  return [...byKey.values()];
}
