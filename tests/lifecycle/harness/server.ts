/**
 * In-process control-plane host for lifecycle scenarios.
 *
 * Boots a tiny Node HTTP server that forwards GET/POST/DELETE to the
 * real Next route handlers (NextRequest in, Response out). No `next
 * build`, no Chromium, no subprocess; just the route modules under
 * test plus the named-event ring buffer they emit into.
 *
 * Trade-off vs the plan's `pnpm start` subprocess: this cannot exercise
 * a true process restart (the module graph and the ring buffer share
 * the test process). It compensates by exposing `simulateRestart()`,
 * which resets the named-event ring + cursor — the exact thing that
 * happens to a real client across a server restart (their
 * `Last-Event-ID` becomes unresolvable and they get
 * `stream.resync_required`). For protocol-contract assertions that is
 * sufficient. The day we need real fork-and-kill isolation, drop
 * `pnpm start` in at this seam.
 */
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

import { __resetNamedEventsForTests } from "@/server/events/named-events";

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

type RouteModule = Partial<Record<"GET" | "POST" | "DELETE", RouteHandler>>;

export interface LifecycleHarnessOptions {
  routes: Array<{
    /** Express-style path with `:param` placeholders. */
    pattern: string;
    // Route modules' real signatures are param-specific (e.g.
    // `params: Promise<{ id: string }>`), so we accept `unknown` here
    // and lean on the runtime params extraction below for safety.
    module: unknown;
  }>;
}

export interface LifecycleServer {
  baseUrl: string;
  port: number;
  omniRoot: string;
  stop(): Promise<void>;
  /** Reset module-level state to simulate a server restart. */
  simulateRestart(): void;
}

function compilePattern(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const escaped = pattern.replace(/[.+?^${}()|\\]/g, "\\$&");
  const regex = new RegExp("^" + escaped.replace(/:([a-zA-Z_]+)/g, (_match, key: string) => {
    keys.push(key);
    return "([^/]+)";
  }) + "$");
  return { regex, keys };
}

async function nodeReqToWebRequest(req: http.IncomingMessage, url: string): Promise<Request> {
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value != null) {
      headers.set(key, value);
    }
  }
  let body: Uint8Array | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length > 0) {
      // Buffer.concat returns a Buffer (Uint8Array view). Using
      // `.buffer` here would yield the pooled underlying ArrayBuffer,
      // which contains bytes outside our buffer's view and produces
      // corrupt request bodies. Pass the Uint8Array directly.
      body = new Uint8Array(Buffer.concat(chunks));
    }
  }
  // BodyInit accepts BufferSource (which includes Uint8Array) at runtime
  // but the lib.dom types don't always reflect that. Cast through any to
  // keep typecheck honest without changing runtime semantics.
  return new Request(url, { method, headers, body: body as unknown as BodyInit });
}

async function webResponseToNodeRes(res: Response, nodeRes: http.ServerResponse): Promise<void> {
  nodeRes.statusCode = res.status;
  res.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });
  if (!res.body) {
    nodeRes.end();
    return;
  }
  const nodeStream = Readable.fromWeb(res.body as never);
  nodeStream.pipe(nodeRes);
  await new Promise<void>((resolve) => {
    nodeStream.on("end", () => resolve());
    nodeStream.on("close", () => resolve());
    nodeRes.on("close", () => resolve());
  });
}

export async function startLifecycleHarness(options: LifecycleHarnessOptions): Promise<LifecycleServer> {
  const compiled = options.routes.map((route) => ({
    ...route,
    ...compilePattern(route.pattern),
  }));
  const omniRoot = mkdtempSync(path.join(tmpdir(), "omni-lifecycle-"));
  process.env.OMNIHARNESS_ROOT = omniRoot;
  process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
  process.env.OMNIHARNESS_E2E_BYPASS_AUTH = "true";

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const pathname = url.pathname;
      const match = compiled
        .map((route) => ({ route, m: route.regex.exec(pathname) }))
        .find((entry) => entry.m !== null);
      if (!match || !match.m) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const params: Record<string, string> = {};
      match.route.keys.forEach((key, idx) => {
        params[key] = decodeURIComponent(match.m![idx + 1]!);
      });
      const webReq = await nodeReqToWebRequest(req, url.toString());
      const nextReq = new NextRequest(webReq);
      const method = (req.method ?? "GET").toUpperCase() as "GET" | "POST" | "DELETE";
      const handler = (match.route.module as RouteModule)[method];
      if (!handler) {
        res.statusCode = 405;
        res.end("Method not allowed");
        return;
      }
      const response = await handler(nextReq, { params: Promise.resolve(params) });
      await webResponseToNodeRes(response, res);
    } catch (error) {
      console.error("[lifecycle-harness] route error", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(`Internal harness error: ${(error as Error).message}`);
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    port,
    omniRoot,
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((err) => (err ? reject(err) : resolve()));
      });
      try {
        rmSync(omniRoot, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
    simulateRestart() {
      __resetNamedEventsForTests();
    },
  };
}
