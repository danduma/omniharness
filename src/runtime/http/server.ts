import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { readFile, stat } from "fs/promises";
import type { AddressInfo } from "net";
import path from "path";
import type { RuntimeSurface } from "@/server/events/named-events";
import type { OmniRuntime } from "@/runtime";
import type { OmniHttpRegistry } from "./registry";

export interface StartOmniHttpServerOptions {
  host?: string;
  port?: number;
  surface?: RuntimeSurface;
  registry: OmniHttpRegistry;
  staticDir?: string | null;
}

export interface OmniHttpServerHandle {
  origin: string;
  httpServer: Server;
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

async function toFetchRequest(request: IncomingMessage, host: string, port: number) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const method = request.method || "GET";
  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await readRequestBody(request);

  return new Request(requestUrl(request, host, port), { method, headers, body });
}

async function writeFetchResponse(response: ServerResponse, fetchResponse: Response) {
  response.statusCode = fetchResponse.status;
  fetchResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });
  const body = Buffer.from(await fetchResponse.arrayBuffer());
  response.end(body);
}

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

async function tryServeStatic(
  request: IncomingMessage,
  response: ServerResponse,
  staticDir: string | null | undefined,
) {
  if (!staticDir || request.method !== "GET") {
    return false;
  }

  const rawUrl = request.url || "/";
  const pathname = new URL(rawUrl, "http://runtime.local").pathname;
  if (pathname.startsWith("/api/")) {
    return false;
  }

  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const root = path.resolve(staticDir);
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return true;
  }

  const fallback = path.join(root, "index.html");
  let filePath = candidate;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    filePath = fallback;
  }

  try {
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("content-type", MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end("Not found");
  }

  return true;
}

export async function startOmniHttpServer(options: StartOmniHttpServerOptions): Promise<OmniHttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 0;
  const surface = options.surface ?? "web";

  let activePort = requestedPort;
  const server = createServer((request, response) => {
    void (async () => {
      if (await tryServeStatic(request, response, options.staticDir)) {
        return;
      }
      const fetchRequest = await toFetchRequest(request, host, activePort);
      const fetchResponse = await options.registry.handle(fetchRequest, { surface });
      await writeFetchResponse(response, fetchResponse);
    })().catch((error) => {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        error: {
          code: "runtime.server_failed",
          message: error instanceof Error ? error.message : String(error),
          surface,
        },
      }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      server.off("error", reject);
      activePort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  return {
    origin: `http://${host}:${activePort}`,
    httpServer: server,
    getPort: () => activePort,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
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
