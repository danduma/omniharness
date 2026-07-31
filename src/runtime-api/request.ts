import type { RuntimeApiError, RuntimeSurface } from "./types";

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
  return {
    code: typeof payload?.code === "string"
      ? payload.code
      : `runtime.http_${status}`,
    message: typeof payload?.message === "string"
      ? payload.message
      : `Runtime request failed with HTTP ${status}.`,
    details: payload?.details,
    surface: typeof payload?.surface === "string"
      ? payload.surface
      : surface,
  };
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
    if (!response.ok) {
      throw normalizeRuntimeHttpError({
        status: response.status,
        body: parsedBody,
        surface,
      });
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
