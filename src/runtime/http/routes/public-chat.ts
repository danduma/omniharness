import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { createConversation } from "@/server/conversations/create";
import { sendConversationMessage } from "@/server/conversations/send-message";
import { readWorkerEntriesTail } from "@/server/workers/output-store";
import { RUN_ID_PATTERN } from "@/server/runs/ids";
import { getPublicOriginFromRequest } from "@/server/auth/config";
import type { OmniHttpHandler } from "@/runtime/http/registry";

const MAX_MESSAGE_LENGTH = 100_000;

function publicApiConfig() {
  const key = process.env.OMNIHARNESS_PUBLIC_API_KEY?.trim() ?? "";
  const projectPath = process.env.OMNIHARNESS_PUBLIC_API_PROJECT_PATH?.trim() ?? "";
  return { key, projectPath };
}

function hasValidApiKey(request: Request, expected: string) {
  const value = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!expected || !value) return false;
  const actual = Buffer.from(value);
  const configured = Buffer.from(expected);
  return actual.length === configured.length && crypto.timingSafeEqual(actual, configured);
}

function unauthorized() {
  return Response.json({ error: { code: "public_api.unauthorized", message: "A valid public API key is required." } }, { status: 401 });
}

function unavailable() {
  return Response.json({ error: { code: "public_api.unconfigured", message: "The public chat API is not configured." } }, { status: 503 });
}

async function getPublicRun(runId: string, projectPath: string) {
  if (!RUN_ID_PATTERN.test(runId)) return null;
  return db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.projectPath, projectPath))).get();
}

async function getConversationState(runId: string, projectPath: string) {
  const run = await getPublicRun(runId, projectPath);
  if (!run) return null;
  const worker = await db.select().from(workers)
    .where(eq(workers.runId, runId))
    .orderBy(desc(workers.workerNumber), desc(workers.createdAt))
    .get();
  const tail = worker ? await readWorkerEntriesTail(runId, worker.id, 100) : null;
  const entries = tail?.entries ?? [];
  return {
    conversationId: run.id,
    status: run.status,
    error: run.lastError,
    worker: worker ? { id: worker.id, status: worker.status, type: worker.type } : null,
    entries: entries.map((entry) => ({ seq: entry.seq, type: entry.type, text: entry.text, timestamp: entry.timestamp })),
    latestSeq: tail?.latestSeq ?? 0,
  };
}

function publicUrls(request: Request, runId: string) {
  const origin = getPublicOriginFromRequest(request.url, request.headers);
  const path = `/api/public/v1/chat/${encodeURIComponent(runId)}`;
  return { pollUrl: `${origin}${path}`, streamUrl: `${origin}${path}/stream` };
}

function validateRequest(request: Request) {
  const config = publicApiConfig();
  if (!config.key || !config.projectPath) return { response: unavailable(), config: null };
  if (!hasValidApiKey(request, config.key)) return { response: unauthorized(), config: null };
  return { response: null, config };
}

export const handlePublicChatRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, { status: 405, headers: { allow: "POST" } });
  }
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const body = await request.json().catch(() => null) as { message?: unknown; conversationId?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: { code: "public_api.invalid_message", message: `message must contain 1 to ${MAX_MESSAGE_LENGTH} characters.` } }, { status: 400 });
  }
  const requestedRunId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
  let runId: string;
  if (requestedRunId) {
    const run = await getPublicRun(requestedRunId, auth.config.projectPath);
    if (!run) return Response.json({ error: { code: "public_api.conversation_not_found", message: "Conversation not found for the configured project." } }, { status: 404 });
    await sendConversationMessage({ runId: run.id, content: message, preferredWorkerType: "codex", allowedWorkerTypes: ["codex"] });
    runId = run.id;
  } else {
    const created = await createConversation({
      mode: "direct",
      command: message,
      projectPath: auth.config.projectPath,
      preferredWorkerType: "codex",
      allowedWorkerTypes: ["codex"],
    });
    runId = created.runId;
  }
  return Response.json({ ok: true, conversationId: runId, status: "accepted", ...publicUrls(request, runId) }, { status: 202 });
};

export const handlePublicChatStatusRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, { status: 405, headers: { allow: "GET" } });
  }
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const state = await getConversationState(context.params?.id ?? "", auth.config.projectPath);
  return state
    ? Response.json({ ok: true, ...state })
    : Response.json({ error: { code: "public_api.conversation_not_found", message: "Conversation not found for the configured project." } }, { status: 404 });
};

export const handlePublicChatStreamRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, { status: 405, headers: { allow: "GET" } });
  }
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const runId = context.params?.id ?? "";
  if (!await getPublicRun(runId, auth.config.projectPath)) {
    return Response.json({ error: { code: "public_api.conversation_not_found", message: "Conversation not found for the configured project." } }, { status: 404 });
  }
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async () => {
        if (closed) return;
        const state = await getConversationState(runId, auth.config!.projectPath);
        if (!state) {
          controller.enqueue(encoder.encode("event: error\\ndata: {\\\"code\\\":\\\"public_api.conversation_not_found\\\"}\\n\\n"));
          controller.close();
          closed = true;
          return;
        }
        controller.enqueue(encoder.encode(`event: update\\ndata: ${JSON.stringify(state)}\\n\\n`));
        if (["done", "failed", "cancelled"].includes(state.status)) {
          controller.enqueue(encoder.encode(`event: done\\ndata: ${JSON.stringify({ conversationId: state.conversationId, status: state.status })}\\n\\n`));
          controller.close();
          closed = true;
          if (timer) clearInterval(timer);
        }
      };
      void send().catch((error) => controller.error(error));
      timer = setInterval(() => { void send().catch((error) => controller.error(error)); }, 1_000);
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearInterval(timer);
      }, { once: true });
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" } });
};
