/**
 * Entrypoint executed in a child process by the real-restart harness.
 *
 * Boots the same in-process HTTP host that the in-process lifecycle
 * harness uses, but in a fresh Node process. Killing this process
 * truly:
 *   - resets the named-event ring buffer (it's module-level state),
 *   - drops any in-flight SSE connections (TCP RST),
 *   - clears all module-level caches,
 * which is exactly what a production restart does. The sqlite file
 * (under OMNIHARNESS_ROOT) persists across restarts, mirroring prod.
 *
 * The route table is hard-coded here because the parent process cannot
 * pass module references across the process boundary. Add new routes
 * to this list when scenarios need them.
 */
import http from "node:http";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

import * as eventsRoute from "@/app/api/events/route";
import * as eventsLogRoute from "@/app/api/events/log/route";
import * as conversationsRoute from "@/app/api/conversations/route";
import * as messagesRoute from "@/app/api/conversations/[id]/messages/route";
import * as runRoute from "@/app/api/runs/[id]/route";
import * as planningReviewRoute from "@/app/api/planning/[id]/review/route";

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

type RouteModule = Partial<Record<"GET" | "POST" | "DELETE", RouteHandler>>;

const ROUTES: Array<{ pattern: string; module: RouteModule }> = [
  { pattern: "/api/events", module: eventsRoute as unknown as RouteModule },
  { pattern: "/api/events/log", module: eventsLogRoute as unknown as RouteModule },
  { pattern: "/api/conversations", module: conversationsRoute as unknown as RouteModule },
  { pattern: "/api/conversations/:id/messages", module: messagesRoute as unknown as RouteModule },
  { pattern: "/api/runs/:id", module: runRoute as unknown as RouteModule },
  { pattern: "/api/planning/:id/review", module: planningReviewRoute as unknown as RouteModule },
];

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
      body = new Uint8Array(Buffer.concat(chunks));
    }
  }
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

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 0);
  const compiled = ROUTES.map((route) => ({ ...route, ...compilePattern(route.pattern) }));

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
      const handler = match.route.module[method];
      if (!handler) {
        res.statusCode = 405;
        res.end("Method not allowed");
        return;
      }
      const response = await handler(nextReq, { params: Promise.resolve(params) });
      await webResponseToNodeRes(response, res);
    } catch (error) {
      console.error("[subprocess-runner] route error", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(`Internal harness error: ${(error as Error).message}`);
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const boundPort = addr && typeof addr === "object" ? addr.port : 0;
  // Stdout signal that the parent waits on.
  process.stdout.write(`SUBPROCESS_READY ${boundPort}\n`);

  // Keep the process alive until externally killed.
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
}

void main().catch((error) => {
  console.error("[subprocess-runner] fatal:", error);
  process.exit(1);
});
