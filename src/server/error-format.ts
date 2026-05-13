function describeErrorValue(error: unknown, seen: Set<unknown>): string {
  if (error == null) {
    return "";
  }

  if (seen.has(error)) {
    return "[circular cause]";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return String(error);
  }

  if (error instanceof Error) {
    seen.add(error);

    const base = error.message?.trim() || error.name;
    const cause = "cause" in error ? describeErrorValue((error as Error & { cause?: unknown }).cause, seen) : "";
    return cause && cause !== base ? `${base} (caused by: ${cause})` : base;
  }

  if (typeof error === "object") {
    seen.add(error);

    const maybeMessage = "message" in error && typeof error.message === "string" ? error.message.trim() : "";
    if (maybeMessage) {
      return maybeMessage;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export function formatErrorMessage(error: unknown) {
  return describeErrorValue(error, new Set()) || "Unknown error";
}
