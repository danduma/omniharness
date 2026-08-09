import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import type { AddressInfo } from "net";
import type { RuntimeSurface } from "@/server/events/named-events";
import { emitNamedEvent } from "@/server/events/named-events";
import type { OmniRuntime } from "@/runtime";
import type { OmniHttpRegistry } from "./registry";
import { OpenResponseStreams, writeFetchResponse } from "./stream-response";
import {
  prepareStaticInterface,
  type StaticBootstrapBuilder,
} from "./static-files";
import { createDevInterfaceProxy } from "./dev-proxy";
import type { InterfaceSecurityMode } from "./security-headers";
import {
  associateRequestNetworkIdentity,
  resolveRequestNetworkIdentity,
} from "@/server/auth/trusted-proxy";

export interface StartOmniHttpServerOptions {
  host?: string;
  port?: number;
  surface?: RuntimeSurface;
  registry: OmniHttpRegistry;
  staticDir?: string | null;
  staticDirExplicit?: boolean;
  staticMode?: InterfaceSecurityMode;
  buildStaticBootstrap?: StaticBootstrapBuilder;
  /** When set, interface requests are proxied to this Vite dev server for HMR. */
  interfaceDevUrl?: string | null;
}

export interface OmniHttpServerHandle {
  origin: string;
  httpServer: Server;
  staticUiEnabled: boolean;
  getPort(): number;
  stop(): Promise<void>;
}

export interface StartOmniServerOptions extends StartOmniHttpServerOptions {
  runtime: OmniRuntime;
}

export interface OmniServerHandle extends OmniHttpServerHandle {
  runtime: OmniRuntime;
  isReady(): boolean;
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return Buffer.concat(chunks);
}

function requestUrl(request: IncomingMessage, host: string, port: number) {
  const rawUrl = request.url || "/";
  const headerHost = request.headers.host;
  const authority = typeof headerHost === "string" && headerHost.trim()
    ? headerHost.trim()
    : `${host}:${port}`;
  return `http://${authority}${rawUrl}`;
}

async function toFetchRequest(
  request: IncomingMessage,
  host: string,
  port: number,
  signal: AbortSignal,
) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const method = request.method || "GET";
  const requestBody = method === "GET" || method === "HEAD"
    ? undefined
    : await readRequestBody(request);
  const body = requestBody ? new Uint8Array(requestBody) : undefined;

  return new Request(requestUrl(request, host, port), {
    method,
    headers,
    body,
    signal,
  });
}

export async function startOmniHttpServer(options: StartOmniHttpServerOptions): Promise<OmniHttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 0;
  const surface = options.surface ?? "web";
  const openStreams = new OpenResponseStreams();
  const staticInterface = await prepareStaticInterface({
    staticDir: options.staticDir ?? null,
    explicit: options.staticDirExplicit ?? false,
    mode: options.staticMode ?? "web",
    buildBootstrap: options.buildStaticBootstrap,
  });

  const devProxy = createDevInterfaceProxy(options.interfaceDevUrl);

  let activePort = requestedPort;
  const server = createServer((request, response) => {
    if (devProxy) {
      // Ahead of everything else: the fetch conversion below drains the request
      // body, which would leave nothing to forward upstream.
      const pathname = new URL(request.url || "/", "http://localhost").pathname;
      if (devProxy.shouldProxy(pathname)) {
        devProxy.handleRequest(request, response);
        return;
      }
    }
    const requestAbort = new AbortController();
    const abortRequest = () => requestAbort.abort();
    request.once("aborted", abortRequest);
    response.once("close", abortRequest);
    void (async () => {
      const fetchRequest = await toFetchRequest(
        request,
        host,
        activePort,
        requestAbort.signal,
      );
      associateRequestNetworkIdentity(fetchRequest, resolveRequestNetworkIdentity({
        url: fetchRequest.url,
        headers: fetchRequest.headers,
        socketAddress: request.socket.remoteAddress ?? null,
        socketEncrypted: Boolean(
          (request.socket as typeof request.socket & { encrypted?: boolean }).encrypted,
        ),
      }));
      const staticResponse = await staticInterface.handle(fetchRequest);
      if (staticResponse) {
        await writeFetchResponse(request, response, staticResponse, openStreams);
        return;
      }
      const fetchResponse = await options.registry.handle(fetchRequest, { surface });
      await writeFetchResponse(request, response, fetchResponse, openStreams);
    })().catch((error) => {
      if (response.destroyed || response.writableEnded) {
        return;
      }
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        error: {
          code: "runtime.server_failed",
          message: error instanceof Error ? error.message : String(error),
          surface,
        },
      }));
    }).finally(() => {
      request.off("aborted", abortRequest);
      response.off("close", abortRequest);
    });
  });

  if (devProxy) {
    // Vite's HMR client opens a websocket against the page origin, which is the
    // runner (and, remotely, the tunnel in front of it).
    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "/", "http://localhost").pathname;
      if (devProxy.shouldProxy(pathname)) {
        devProxy.handleUpgrade(request, socket, head);
        return;
      }
      socket.destroy();
    });
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      server.off("error", reject);
      activePort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  let stopPromise: Promise<void> | null = null;
  return {
    origin: `http://${host}:${activePort}`,
    httpServer: server,
    staticUiEnabled: staticInterface.enabled,
    getPort: () => activePort,
    stop: () => {
      if (stopPromise) {
        return stopPromise;
      }
      const flushWindowMs = 500;
      emitNamedEvent({
        kind: "runner.stopping",
        surface,
        reason: "shutdown",
        flushWindowMs,
      });
      stopPromise = new Promise<void>((resolve, reject) => {
        const flushTimer = setTimeout(() => {
          void openStreams.cancelAll("runner stopping").finally(() => {
            server.closeAllConnections();
          });
        }, flushWindowMs);
        flushTimer.unref();
        server.close((error) => {
          clearTimeout(flushTimer);
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections();
      });
      return stopPromise;
    },
  };
}

export async function startOmniServer(options: StartOmniServerOptions): Promise<OmniServerHandle> {
  await options.runtime.start();
  const httpHandle = await startOmniHttpServer(options);
  let ready = true;

  return {
    ...httpHandle,
    runtime: options.runtime,
    isReady: () => ready,
    async stop() {
      if (!ready && options.runtime.getStatus() !== "running") {
        return;
      }
      ready = false;
      await httpHandle.stop();
      await options.runtime.stop("shutdown");
    },
  };
}
