import type { RuntimeApiError, RuntimeSurface } from "./types";
import { t } from "@/lib/i18n";

export function buildRuntimeQuery(
  params: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      search.set(key, value);
    }
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function parseRuntimeBody(bodyText: string | undefined) {
  if (!bodyText) {
    return null;
  }
  return JSON.parse(bodyText) as unknown;
}

export function normalizeRuntimeHttpError({
  status,
  body,
  surface,
}: {
  status: number;
  body: unknown;
  surface: RuntimeSurface;
}): RuntimeApiError {
  const payload = body && typeof body === "object" && "error" in body
    ? (body as {
      error?: {
        code?: unknown;
        message?: unknown;
        details?: unknown;
        surface?: unknown;
      };
    }).error
    : null;
  const isBareServerUnavailable = status === 502 && payload === null;
  return {
    code: typeof payload?.code === "string"
      ? payload.code
      : `runtime.http_${status}`,
    message: typeof payload?.message === "string"
      ? payload.message
      : isBareServerUnavailable
        ? t("runtime.connection.serverUnavailable")
      : `Runtime request failed with HTTP ${status}.`,
    details: payload?.details,
    surface: typeof payload?.surface === "string"
      ? payload.surface
      : surface,
  };
}

/**
 * Did the request fail without the server ever answering?
 *
 * Every failure the server reported is thrown as a `RuntimeApiError` carrying a
 * `code`, so a rejection without one never reached a reply at all — a reset
 * connection, a DNS failure, or a process that died mid-request.
 */
export function isRuntimeTransportFailure(error: unknown) {
  return typeof (error as { code?: unknown } | null | undefined)?.code !== "string";
}

/**
 * Human-readable text for a rejection from the runtime API.
 *
 * `RuntimeApiError` is a plain object literal, never an `Error`, so the usual
 * `error instanceof Error ? error.message : String(error)` shorthand renders
 * it as "[object Object]" and throws away the server's message.
 */
export function runtimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message.length > 0 ? message : String(error);
}

export type RuntimeDomainRequest = (
  method: string,
  path: string,
  options?: RuntimeDomainRequestOptions,
) => Promise<unknown>;

export type RuntimeDomainRequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  responseType?: "json" | "blob" | "arrayBuffer";
  signal?: AbortSignal;
  includeResponseMetadata?: boolean;
};

function isBodyInit(value: unknown): value is BodyInit {
  return typeof value === "string"
    || value instanceof Blob
    || value instanceof FormData
    || value instanceof URLSearchParams
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
    || (typeof ReadableStream !== "undefined" && value instanceof ReadableStream);
}

export function createFetchRuntimeRequest({
  baseUrl = "",
  fetchImpl,
  surface,
  bearerToken,
}: {
  baseUrl?: string;
  fetchImpl: typeof fetch;
  surface: RuntimeSurface;
  bearerToken?: string | (() => string | null);
}): RuntimeDomainRequest {
  const joinUrl = (requestPath: string) => baseUrl
    ? `${baseUrl.replace(/\/$/, "")}${requestPath}`
    : requestPath;

  return async (method, requestPath, options = {}) => {
    const headers = new Headers(options.headers);
    const token = typeof bearerToken === "function" ? bearerToken() : bearerToken;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (isBodyInit(options.body)) {
        body = options.body;
      } else {
        headers.set("content-type", "application/json");
        body = JSON.stringify(options.body);
      }
    }
    const response = await fetchImpl(joinUrl(requestPath), {
      method,
      headers,
      body,
      signal: options.signal,
      redirect: "manual",
    });
    if (
      response.type === "opaqueredirect"
      || (response.status >= 300 && response.status < 400)
    ) {
      throw {
        code: "runtime.redirect_refused",
        message: "Runtime requests do not follow redirects.",
        surface,
      } satisfies RuntimeApiError;
    }

    // Failures answer in JSON whatever the success-path body type is. Reading
    // a failed blob/arrayBuffer reply in its declared type would discard the
    // server's `code` and `message` and leave the caller holding a bare status.
    if (!response.ok) {
      const text = await response.text();
      let errorBody: unknown;
      try {
        errorBody = parseRuntimeBody(text);
      } catch {
        errorBody = text;
      }
      throw normalizeRuntimeHttpError({
        status: response.status,
        body: errorBody,
        surface,
      });
    }

    let parsedBody: unknown;
    if (options.responseType === "blob") {
      parsedBody = await response.blob();
    } else if (options.responseType === "arrayBuffer") {
      parsedBody = await response.arrayBuffer();
    } else {
      const text = await response.text();
      try {
        parsedBody = parseRuntimeBody(text);
      } catch {
        parsedBody = text;
      }
    }
    if (options.includeResponseMetadata) {
      return {
        data: parsedBody,
        headers: Object.fromEntries(response.headers.entries()),
      };
    }
    return parsedBody;
  };
}
