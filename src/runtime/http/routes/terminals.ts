/**
 * Interactive terminal endpoints backing the UI terminal panel.
 *
 *   POST   /api/terminals               -> spawn a pty, returns { terminalId, cols, rows }
 *   GET    /api/terminals/:id/stream     -> SSE of pty output (resumable via Last-Event-ID)
 *   POST   /api/terminals/:id/input      -> write stdin { data }
 *   POST   /api/terminals/:id/resize     -> { cols, rows }
 *   DELETE /api/terminals/:id            -> kill the pty
 *
 * Transport is SSE (output) + POST (input) because this runtime has no
 * websocket server. See src/server/terminal/terminal-manager.ts.
 */
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { getTerminalManager } from "@/server/terminal/terminal-manager";
import { resolveConversationCwd } from "@/server/terminal/cwd";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

const AUTH_SOURCE = "Terminal";

function methodNotAllowed(allow: string) {
  return Response.json(
    { error: { code: "method_not_allowed", message: "Method not allowed." } },
    { status: 405, headers: { allow } },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const handleTerminalCreateRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  const auth = await requireApiSession(toNextRequest(request), {
    source: AUTH_SOURCE,
    action: "Open terminal",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    const cwd = await resolveConversationCwd(conversationId);
    const created = getTerminalManager().createTerminal({
      cwd,
      cols: toDimension(body.cols),
      rows: toDimension(body.rows),
    });
    return Response.json({ terminalId: created.id, cols: created.cols, rows: created.rows, cwd });
  } catch (error) {
    return errorResponse(error, { status: 500, source: AUTH_SOURCE, action: "Open terminal" });
  }
};

export const handleTerminalStreamRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") {
    return methodNotAllowed("GET");
  }
  const auth = await requireApiSession(toNextRequest(request), {
    source: AUTH_SOURCE,
    action: "Stream terminal",
  });
  if (auth.response) {
    return auth.response;
  }

  const id = context.params?.id?.trim();
  if (!id) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }
  const manager = getTerminalManager();
  if (!manager.has(id)) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const fromSeq = parseSeq(request.headers.get("last-event-id") ?? url.searchParams.get("lastEventId"));

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // stream closed
        }
      };

      unsubscribe = manager.subscribe(id, fromSeq, {
        onChunk: (chunk) => {
          enqueue(`id: ${chunk.seq}\nevent: data\ndata: ${JSON.stringify(chunk.data)}\n\n`);
        },
        onExit: (exit) => {
          enqueue(`event: exit\ndata: ${JSON.stringify(exit)}\n\n`);
          try {
            controller.close();
          } catch {
            // already closed
          }
        },
      });

      if (!unsubscribe) {
        enqueue(`event: exit\ndata: ${JSON.stringify({ exitCode: -1 })}\n\n`);
        try {
          controller.close();
        } catch {
          // already closed
        }
        return;
      }

      // Prime the connection so the client's onopen fires promptly.
      enqueue(": connected\n\n");

      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const handleTerminalInputRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  const auth = await requireApiSession(toNextRequest(request), {
    source: AUTH_SOURCE,
    action: "Send terminal input",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const id = context.params?.id?.trim();
  if (!id) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }
  const body = await readJsonBody(request);
  const data = typeof body.data === "string" ? body.data : null;
  if (data === null) {
    return Response.json({ error: { code: "invalid_input", message: "Missing input data." } }, { status: 400 });
  }
  const ok = getTerminalManager().write(id, data);
  if (!ok) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
};

export const handleTerminalResizeRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  const auth = await requireApiSession(toNextRequest(request), {
    source: AUTH_SOURCE,
    action: "Resize terminal",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const id = context.params?.id?.trim();
  if (!id) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }
  const body = await readJsonBody(request);
  const cols = toDimension(body.cols);
  const rows = toDimension(body.rows);
  if (cols === undefined || rows === undefined) {
    return Response.json({ error: { code: "invalid_input", message: "Missing cols/rows." } }, { status: 400 });
  }
  const ok = getTerminalManager().resize(id, cols, rows);
  if (!ok) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
};

export const handleTerminalDeleteRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "DELETE") {
    return methodNotAllowed("DELETE");
  }
  const auth = await requireApiSession(toNextRequest(request), {
    source: AUTH_SOURCE,
    action: "Close terminal",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const id = context.params?.id?.trim();
  if (!id) {
    return Response.json({ error: "Terminal not found" }, { status: 404 });
  }
  getTerminalManager().kill(id);
  return Response.json({ ok: true });
};

function toDimension(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function parseSeq(value: string | null): number {
  if (value == null) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
