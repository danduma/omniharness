export interface VSCodeBridgeRequest {
  id: string;
  type: string;
  payload?: unknown;
}

export type VSCodeBridgeError = {
  code: string;
  message: string;
  surface: "vscode";
  details?: unknown;
};

export type VSCodeBridgeResponse =
  | {
      id: string;
      type: string;
      success: true;
      data?: unknown;
    }
  | {
      id: string;
      type: string;
      success: false;
      error: VSCodeBridgeError;
    };

export interface VSCodeBridgeContext {
  serverUrl: string;
  fetchImpl?: typeof fetch;
  sessionCookie?: string | null;
  postMessage?: (message: VSCodeBridgeResponse) => void;
  sseStreams?: Map<string, AbortController>;
}

type ApiProxyPayload = {
  method?: unknown;
  path?: unknown;
  headers?: unknown;
  bodyText?: unknown;
};

type SseOpenPayload = {
  runId?: unknown;
  lastEventId?: unknown;
};

function bridgeError(request: VSCodeBridgeRequest, code: string, message: string, details?: unknown): VSCodeBridgeResponse {
  return {
    id: request.id,
    type: request.type,
    success: false,
    error: { code, message, surface: "vscode", details },
  };
}

function normalizeServerUrl(serverUrl: string) {
  const trimmed = serverUrl.trim();
  if (!trimmed) {
    throw new Error("OmniHarness server URL is required.");
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeApiPath(path: unknown) {
  if (typeof path !== "string" || !path.trim()) {
    throw new Error("API proxy path is required.");
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error("API proxy path must start with '/'.");
  }
  if (trimmed.startsWith("//") || !trimmed.startsWith("/api/")) {
    throw new Error("API proxy path must target an OmniHarness /api route.");
  }
  return trimmed;
}

function normalizeApiMethod(method: unknown) {
  const normalized = typeof method === "string" && method.trim()
    ? method.trim().toUpperCase()
    : "GET";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(normalized)) {
    throw new Error(`Unsupported API proxy method: ${normalized}.`);
  }
  return normalized;
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return {};
  }
  return Object.fromEntries(Object.entries(headers).flatMap(([key, value]) => {
    if (typeof value !== "string") {
      return [];
    }
    return [[key, value]];
  }));
}

function buildQuery(params: Record<string, string | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

function parseSsePayload(raw: string) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function parseSseFrame(frame: string) {
  let id: string | null = null;
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "id") {
      id = value;
    } else if (field === "event") {
      event = value || "message";
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  return {
    id,
    event,
    payload: parseSsePayload(dataLines.join("\n")),
  };
}

async function streamSseFrames(
  request: VSCodeBridgeRequest,
  response: Response,
  context: VSCodeBridgeContext,
) {
  if (!response.body) {
    throw new Error("Runtime SSE response did not include a readable body.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    buffer += decoder.decode(result.value, { stream: true });
    const frames = buffer.split(/\n\n|\r\n\r\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (!frame.trim()) {
        continue;
      }
      context.postMessage?.({
        id: request.id,
        type: "sse:event",
        success: true,
        data: parseSseFrame(frame),
      });
    }
  }

  const tail = `${buffer}${decoder.decode()}`;
  if (tail.trim()) {
    context.postMessage?.({
      id: request.id,
      type: "sse:event",
      success: true,
      data: parseSseFrame(tail),
    });
  }
}

async function handleApiProxy(
  request: VSCodeBridgeRequest,
  context: VSCodeBridgeContext,
): Promise<VSCodeBridgeResponse> {
  try {
    const payload = (request.payload ?? {}) as ApiProxyPayload;
    const method = normalizeApiMethod(payload.method);
    const path = normalizeApiPath(payload.path);
    const serverUrl = normalizeServerUrl(context.serverUrl);
    const headers = normalizeHeaders(payload.headers);
    if (context.sessionCookie && !headers.cookie) {
      headers.cookie = context.sessionCookie;
    }
    const response = await (context.fetchImpl ?? fetch)(`${serverUrl}${path}`, {
      method,
      headers,
      body: typeof payload.bodyText === "string" ? payload.bodyText : undefined,
    });

    return {
      id: request.id,
      type: request.type,
      success: true,
      data: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        bodyText: await response.text(),
      },
    };
  } catch (error) {
    return bridgeError(
      request,
      "vscode.bridge.proxy_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function handleSseOpen(
  request: VSCodeBridgeRequest,
  context: VSCodeBridgeContext,
): Promise<VSCodeBridgeResponse> {
  try {
    if (!context.postMessage) {
      throw new Error("SSE proxy requires a postMessage callback.");
    }
    const payload = (request.payload ?? {}) as SseOpenPayload;
    const runId = typeof payload.runId === "string" && payload.runId.trim() ? payload.runId.trim() : null;
    const lastEventId = typeof payload.lastEventId === "string" && payload.lastEventId.trim() ? payload.lastEventId.trim() : null;
    const controller = new AbortController();
    context.sseStreams?.set(request.id, controller);

    const headers: Record<string, string> = { accept: "text/event-stream" };
    if (context.sessionCookie) {
      headers.cookie = context.sessionCookie;
    }

    const response = await (context.fetchImpl ?? fetch)(
      `${normalizeServerUrl(context.serverUrl)}/api/events${buildQuery({ runId, lastEventId })}`,
      {
        method: "GET",
        headers,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Runtime SSE request failed with HTTP ${response.status}.`);
    }

    void streamSseFrames(request, response, context)
      .catch((error) => {
        if (!controller.signal.aborted) {
          context.postMessage?.(bridgeError(
            request,
            "vscode.bridge.sse_failed",
            error instanceof Error ? error.message : String(error),
          ));
        }
      })
      .finally(() => {
        context.sseStreams?.delete(request.id);
      });

    return {
      id: request.id,
      type: request.type,
      success: true,
      data: { ok: true },
    };
  } catch (error) {
    return bridgeError(
      request,
      "vscode.bridge.sse_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function handleSseClose(
  request: VSCodeBridgeRequest,
  context: VSCodeBridgeContext,
): VSCodeBridgeResponse {
  const streamId = typeof request.payload === "object" && request.payload
    ? (request.payload as { id?: unknown }).id
    : null;
  const id = typeof streamId === "string" ? streamId : request.id;
  context.sseStreams?.get(id)?.abort();
  context.sseStreams?.delete(id);
  return {
    id: request.id,
    type: request.type,
    success: true,
    data: { ok: true },
  };
}

export async function handleVSCodeBridgeMessage(
  request: VSCodeBridgeRequest,
  context: VSCodeBridgeContext,
): Promise<VSCodeBridgeResponse> {
  if (request.type === "api:proxy") {
    return handleApiProxy(request, context);
  }
  if (request.type === "sse:open") {
    return handleSseOpen(request, context);
  }
  if (request.type === "sse:close") {
    return handleSseClose(request, context);
  }

  return bridgeError(
    request,
    "vscode.bridge.unknown_message",
    `Unknown VS Code bridge message: ${request.type}.`,
  );
}
