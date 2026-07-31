import type { ElectronCredentialStore } from "./credential-store";

export type ElectronRunnerTarget = {
  profileId: string;
  baseUrl: string;
  credentialRef: string | null;
  runnerInstanceId: string | null;
};

export type ElectronRuntimeBridgeRequest = {
  id: string;
  type: "api:proxy" | "sse:open" | "sse:close" | "auth:native";
  target?: ElectronRunnerTarget;
  payload?: unknown;
};

export type ElectronRuntimeBridgeResponse = {
  id: string;
  type: string;
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    surface: "electron";
    details?: unknown;
  };
};

type ApiPayload = {
  method?: unknown;
  path?: unknown;
  headers?: unknown;
  bodyText?: unknown;
  formData?: unknown;
  responseType?: unknown;
};

type StreamPayload = {
  path?: unknown;
  lastEventId?: unknown;
};

function safeMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:ticket|token|code)=)[^&\s]+/gi, "$1[redacted]");
}

function bridgeError(
  request: ElectronRuntimeBridgeRequest,
  code: string,
  error: unknown,
  details?: unknown,
): ElectronRuntimeBridgeResponse {
  return {
    id: request.id,
    type: request.type,
    success: false,
    error: {
      code,
      message: safeMessage(error),
      surface: "electron",
      ...(details === undefined ? {} : { details }),
    },
  };
}

function validateTarget(value: unknown): ElectronRunnerTarget {
  if (!value || typeof value !== "object") {
    throw new TypeError("Electron runtime target is required.");
  }
  const target = value as Partial<ElectronRunnerTarget>;
  if (typeof target.profileId !== "string" || !target.profileId.trim()) {
    throw new TypeError("Electron runtime profile id is required.");
  }
  if (typeof target.baseUrl !== "string") {
    throw new TypeError("Electron runtime base URL is required.");
  }
  const url = new URL(target.baseUrl);
  if (
    url.origin !== target.baseUrl
    || (url.protocol !== "https:" && url.protocol !== "http:")
    || url.username
    || url.password
  ) {
    throw new TypeError("Electron runtime base URL must be an exact HTTP origin.");
  }
  if (
    target.credentialRef !== null
    && typeof target.credentialRef !== "string"
  ) {
    throw new TypeError("Electron credential reference is invalid.");
  }
  if (
    target.runnerInstanceId !== null
    && typeof target.runnerInstanceId !== "string"
  ) {
    throw new TypeError("Electron runner identity is invalid.");
  }
  return {
    profileId: target.profileId,
    baseUrl: url.origin,
    credentialRef: target.credentialRef,
    runnerInstanceId: target.runnerInstanceId,
  };
}

function apiPath(value: unknown) {
  if (
    typeof value !== "string"
    || !value.startsWith("/api/")
    || value.startsWith("//")
  ) {
    throw new TypeError("Electron runtime path must target an /api route.");
  }
  return value;
}

function apiMethod(value: unknown) {
  const method = typeof value === "string" ? value.toUpperCase() : "GET";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) {
    throw new TypeError(`Unsupported Electron runtime method: ${method}.`);
  }
  return method;
}

function safeHeaders(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const headers: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value)) {
    const lower = name.toLowerCase();
    if (
      typeof raw === "string"
      && lower !== "authorization"
      && lower !== "cookie"
      && lower !== "origin"
      && lower !== "host"
    ) {
      headers[lower] = raw;
    }
  }
  return headers;
}

function parseFrame(frame: string) {
  let type = "message";
  let lastEventId: string | undefined;
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const name = separator < 0 ? line : line.slice(0, separator);
    const raw = separator < 0 ? "" : line.slice(separator + 1);
    const value = raw.startsWith(" ") ? raw.slice(1) : raw;
    if (name === "event") type = value || "message";
    if (name === "id") lastEventId = value;
    if (name === "data") data.push(value);
  }
  return { type, lastEventId, data: data.join("\n") };
}

export class BoundedElectronFrameQueue {
  private frames: Array<{ value: unknown; bytes: number }> = [];
  private bytes = 0;
  private scheduled = false;

  constructor(
    private readonly send: (frame: unknown) => void,
    private readonly maximumFrames = 256,
    private readonly maximumBytes = 1024 * 1024,
    private readonly onOverflow: () => void = () => {},
  ) {}

  push(value: unknown) {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (
      this.frames.length >= this.maximumFrames
      || this.bytes + bytes > this.maximumBytes
    ) {
      this.frames = [];
      this.bytes = 0;
      this.onOverflow();
      return false;
    }
    this.frames.push({ value, bytes });
    this.bytes += bytes;
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
    return true;
  }

  private flush() {
    this.scheduled = false;
    for (const frame of this.frames) this.send(frame.value);
    this.frames = [];
    this.bytes = 0;
  }
}

export class ElectronRuntimeHost {
  private readonly streams = new Map<string, AbortController>();

  constructor(private readonly options: {
    credentials: ElectronCredentialStore;
    fetchImpl?: typeof fetch;
    fetchForTarget?: (
      target: ElectronRunnerTarget,
      input: string,
      init: RequestInit,
    ) => Promise<Response>;
    postFrame: (response: ElectronRuntimeBridgeResponse) => void;
    getTlsFailure?: (target: ElectronRunnerTarget) => {
      fingerprint: string;
      origin: string;
    } | null;
  }) {}

  private fetchTarget(
    target: ElectronRunnerTarget,
    input: string,
    init: RequestInit,
  ) {
    return this.options.fetchForTarget
      ? this.options.fetchForTarget(target, input, init)
      : (this.options.fetchImpl ?? fetch)(input, init);
  }

  private tokenFor<T>(target: ElectronRunnerTarget, consumer: (token: string) => T) {
    if (!target.credentialRef) {
      throw new Error("Runner authorization is required.");
    }
    return this.options.credentials.useCredential(target.credentialRef, {
      profileId: target.profileId,
      origin: target.baseUrl,
      runnerInstanceId: target.runnerInstanceId,
    }, consumer);
  }

  private async requestWithToken(
    target: ElectronRunnerTarget,
    path: string,
    init: RequestInit,
  ) {
    return this.tokenFor(target, (token) => {
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${token}`);
      return this.fetchTarget(target, `${target.baseUrl}${path}`, {
        ...init,
        headers,
        redirect: "manual",
      });
    });
  }

  private async requestForTarget(
    target: ElectronRunnerTarget,
    path: string,
    init: RequestInit,
  ) {
    if (target.credentialRef) {
      return this.requestWithToken(target, path, init);
    }
    const pathname = new URL(path, "http://electron.invalid").pathname;
    if (
      init.method === "GET"
      && (pathname === "/api/runtime/bootstrap" || pathname === "/api/auth/session")
    ) {
      return this.fetchTarget(target, `${target.baseUrl}${path}`, {
        ...init,
        redirect: "manual",
      });
    }
    throw new Error("Runner authorization is required.");
  }

  private async proxy(request: ElectronRuntimeBridgeRequest) {
    const target = validateTarget(request.target);
    const payload = (request.payload ?? {}) as ApiPayload;
    const method = apiMethod(payload.method);
    const path = apiPath(payload.path);
    const headers = safeHeaders(payload.headers);
    let body: BodyInit | undefined;
    if (Array.isArray(payload.formData)) {
      const form = new FormData();
      for (const raw of payload.formData) {
        const entry = raw as {
          name?: unknown;
          value?: unknown;
          file?: { name?: unknown; type?: unknown; bytes?: unknown };
        };
        if (typeof entry.name !== "string") throw new TypeError("Invalid multipart entry.");
        if (typeof entry.value === "string") {
          form.append(entry.name, entry.value);
        } else if (
          entry.file
          && typeof entry.file.name === "string"
          && typeof entry.file.type === "string"
          && Array.isArray(entry.file.bytes)
        ) {
          form.append(
            entry.name,
            new Blob([Uint8Array.from(entry.file.bytes)], { type: entry.file.type }),
            entry.file.name,
          );
        } else {
          throw new TypeError("Invalid multipart entry.");
        }
      }
      body = form;
      delete headers["content-type"];
    } else if (typeof payload.bodyText === "string") {
      body = payload.bodyText;
    }
    const response = await this.requestForTarget(target, path, {
      method,
      headers,
      body,
    });
    const binary = payload.responseType === "blob" || payload.responseType === "arrayBuffer";
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      bodyText: binary ? undefined : await response.text(),
      bodyBytes: binary
        ? Array.from(new Uint8Array(await response.arrayBuffer()))
        : undefined,
    };
  }

  private async authorize(request: ElectronRuntimeBridgeRequest) {
    const target = validateTarget(request.target);
    const payload = request.payload as { password?: unknown; clientLabel?: unknown };
    const password = typeof payload?.password === "string" ? payload.password : "";
    if (!password) throw new TypeError("Runner password is required.");
    const response = await this.fetchTarget(
      target,
      `${target.baseUrl}/api/auth/login`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password,
          tokenTransport: "bearer",
          clientLabel: typeof payload.clientLabel === "string"
            ? payload.clientLabel
            : "OmniHarness Desktop",
        }),
        redirect: "manual",
      },
    );
    const body = await response.json() as {
      token?: unknown;
      sessionId?: unknown;
      expiresAt?: unknown;
      error?: { message?: unknown };
    };
    if (!response.ok || typeof body.token !== "string") {
      throw new Error(
        typeof body.error?.message === "string"
          ? body.error.message
          : `Runner login failed with HTTP ${response.status}.`,
      );
    }
    const credentialRef = this.options.credentials.save({
      profileId: target.profileId,
      origin: target.baseUrl,
      runnerInstanceId: target.runnerInstanceId,
      token: body.token,
    });
    return {
      credentialRef,
      sessionId: body.sessionId,
      expiresAt: body.expiresAt,
    };
  }

  private async openStream(request: ElectronRuntimeBridgeRequest) {
    const target = validateTarget(request.target);
    const payload = (request.payload ?? {}) as StreamPayload;
    const path = apiPath(payload.path);
    const lastEventId = typeof payload.lastEventId === "string"
      ? payload.lastEventId.trim()
      : "";
    const controller = new AbortController();
    this.streams.get(request.id)?.abort();
    this.streams.set(request.id, controller);
    const streamPath = lastEventId
      ? `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(lastEventId)}`
      : path;
    const response = await this.requestWithToken(target, streamPath, {
      method: "GET",
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Runtime stream failed with HTTP ${response.status}.`);
    }
    const queue = new BoundedElectronFrameQueue(
      (data) => this.options.postFrame({
        id: request.id,
        type: "sse:event",
        success: true,
        data,
      }),
      256,
      1024 * 1024,
      () => controller.abort("Electron stream queue overflow."),
    );
    void (async () => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (!controller.signal.aborted) {
          const next = await reader.read();
          if (next.done) break;
          buffer += decoder.decode(next.value, { stream: true });
          const frames = buffer.split(/\n\n|\r\n\r\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            if (frame.trim() && !queue.push(parseFrame(frame))) return;
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          this.options.postFrame(bridgeError(
            request,
            "electron.bridge.sse_failed",
            error,
          ));
        }
      } finally {
        this.streams.delete(request.id);
      }
    })();
    return { ok: true };
  }

  async handle(request: ElectronRuntimeBridgeRequest): Promise<ElectronRuntimeBridgeResponse> {
    try {
      if (!request || typeof request.id !== "string" || typeof request.type !== "string") {
        throw new TypeError("Invalid Electron bridge request.");
      }
      let data: unknown;
      if (request.type === "api:proxy") data = await this.proxy(request);
      else if (request.type === "auth:native") data = await this.authorize(request);
      else if (request.type === "sse:open") data = await this.openStream(request);
      else if (request.type === "sse:close") {
        const streamId = typeof request.payload === "object" && request.payload
          ? (request.payload as { id?: unknown }).id
          : null;
        if (typeof streamId !== "string") throw new TypeError("Stream id is required.");
        this.streams.get(streamId)?.abort();
        this.streams.delete(streamId);
        data = { ok: true };
      } else {
        throw new TypeError(`Unknown Electron bridge message: ${request.type}.`);
      }
      return { id: request.id, type: request.type, success: true, data };
    } catch (error) {
      const target = (() => {
        try {
          return validateTarget(request.target);
        } catch {
          return null;
        }
      })();
      const tlsFailure = target ? this.options.getTlsFailure?.(target) : null;
      return bridgeError(
        request,
        tlsFailure ? "tls.untrusted" : "electron.bridge.request_failed",
        error,
        tlsFailure ?? undefined,
      );
    }
  }

  close() {
    for (const stream of this.streams.values()) stream.abort();
    this.streams.clear();
  }
}
