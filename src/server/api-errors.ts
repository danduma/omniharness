import { NextResponse } from "next/server";
import { formatErrorMessage } from "@/server/runs/failures";

export interface AppErrorPayload {
  message: string;
  source?: string;
  action?: string;
  suggestion?: string;
  details?: string[];
  status?: number;
}

function uniqueDetails(details: Array<string | null | undefined>) {
  return [...new Set(details.map((detail) => detail?.trim()).filter((detail): detail is string => Boolean(detail)))];
}

export function inferErrorSuggestion(message: string) {
  if (/ACP bridge is not running/i.test(message) || /\bECONNREFUSED\b/i.test(message)) {
    return "Start the ACP bridge and retry. If it is already running, verify OMNIHARNESS_BRIDGE_URL points to the active daemon.";
  }

  if (/API key/i.test(message)) {
    return "Open Settings, verify the required API key is present and decryptable, then retry the action.";
  }

  if (/decrypt/i.test(message)) {
    return "Open Settings, re-enter the affected secret, and save it again so the app can decrypt it at runtime.";
  }

  if (/not found/i.test(message)) {
    return "Verify the requested run, worker, file, or configuration still exists, then retry.";
  }

  if (/empty/i.test(message) || /required/i.test(message)) {
    return "Fill in the required input and retry.";
  }

  return undefined;
}

export function buildAppError(
  error: unknown,
  options: Omit<AppErrorPayload, "message"> & { message?: string } = {},
): AppErrorPayload {
  const message = options.message?.trim() || formatErrorMessage(error);
  const details = uniqueDetails(options.details ?? []);

  return {
    message,
    source: options.source,
    action: options.action,
    suggestion: options.suggestion ?? inferErrorSuggestion(message),
    details: details.length > 0 ? details : undefined,
    status: options.status,
  };
}

export function errorResponse(
  error: unknown,
  options: Omit<AppErrorPayload, "message"> & { message?: string; status?: number } = {},
) {
  const payload = buildAppError(error, options);
  return NextResponse.json({ error: payload }, { status: options.status ?? payload.status ?? 500 });
}
