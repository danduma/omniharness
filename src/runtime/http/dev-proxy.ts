import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

/**
 * Forwards interface traffic to a Vite dev server while the runner keeps
 * owning the public origin. That matters for remote work: the tunnel points at
 * the runner, so proxying (rather than exposing Vite on its own port) is what
 * lets a phone hot-reload over the same URL it already uses.
 *
 * `/api` stays on the runner — only the interface is forwarded.
 */
export interface DevInterfaceProxy {
  target: URL;
  shouldProxy(pathname: string): boolean;
  handleRequest(request: IncomingMessage, response: ServerResponse): void;
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
}

export function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function forwardedHeaders(request: IncomingMessage, target: URL) {
  const headers = { ...request.headers };
  // Vite rejects unknown Host values (`server.allowedHosts`). Presenting the
  // dev server's own authority keeps tunnel hostnames working without asking
  // every deployment to enumerate itself in the Vite config.
  headers.host = target.host;
  return headers;
}

export function createDevInterfaceProxy(targetUrl: string | null | undefined): DevInterfaceProxy | null {
  const raw = targetUrl?.trim();
  if (!raw) {
    return null;
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new TypeError(`Interface dev server URL must be a valid URL. Received: ${raw}`);
  }
  if (target.protocol !== "http:") {
    throw new TypeError(`Interface dev server URL must use http. Received: ${raw}`);
  }

  const unavailable = (detail: string) =>
    `The interface dev server at ${target.origin} is not reachable (${detail}). `
    + "It may still be starting up — reload in a moment.";

  return {
    target,
    shouldProxy(pathname: string) {
      return !isApiPath(pathname);
    },
    handleRequest(request, response) {
      const upstream = httpRequest(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          method: request.method,
          path: request.url,
          headers: forwardedHeaders(request, target),
        },
        (upstreamResponse) => {
          response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
          upstreamResponse.pipe(response);
        },
      );

      upstream.on("error", (error) => {
        if (response.headersSent) {
          response.destroy();
          return;
        }
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        response.end(unavailable(error.message));
      });

      request.pipe(upstream);
    },
    handleUpgrade(request, socket, head) {
      const upstream = httpRequest({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: request.method,
        path: request.url,
        headers: forwardedHeaders(request, target),
      });

      upstream.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
        const statusLine = [
          `HTTP/1.1 ${upstreamResponse.statusCode ?? 101} ${upstreamResponse.statusMessage ?? "Switching Protocols"}`,
          ...Object.entries(upstreamResponse.headers).flatMap(([key, value]) =>
            Array.isArray(value) ? value.map((item) => `${key}: ${item}`) : value ? [`${key}: ${value}`] : []
          ),
          "",
          "",
        ].join("\r\n");
        socket.write(statusLine);
        if (upstreamHead?.length) {
          socket.unshift(upstreamHead);
        }
        upstreamSocket.pipe(socket);
        socket.pipe(upstreamSocket);
        upstreamSocket.on("error", () => socket.destroy());
        socket.on("error", () => upstreamSocket.destroy());
      });

      // A dev server that is down should drop the socket rather than leave the
      // browser's HMR client waiting on a handshake that will never complete.
      upstream.on("response", () => socket.destroy());
      upstream.on("error", () => socket.destroy());

      if (head?.length) {
        upstream.write(head);
      }
      upstream.end();
    },
  };
}
