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
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

type PublicProject = { id: string; path: string };
type PublicApiConfig = { key: string; projects: PublicProject[] };

function publicApiConfig(): PublicApiConfig {
  const key = process.env.OMNIHARNESS_PUBLIC_API_KEY?.trim() ?? "";
  const configuredProjects = process.env.OMNIHARNESS_PUBLIC_API_PROJECTS?.trim();
  if (configuredProjects) {
    try {
      const parsed = JSON.parse(configuredProjects) as unknown;
      if (Array.isArray(parsed)) {
        const projects = parsed.flatMap((item): PublicProject[] => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as { id?: unknown; path?: unknown };
          const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
          const path = typeof candidate.path === "string" ? candidate.path.trim() : "";
          return PROJECT_ID_PATTERN.test(id) && path ? [{ id, path }] : [];
        });
        if (projects.length > 0 && new Set(projects.map((project) => project.id)).size === projects.length) {
          return { key, projects };
        }
      }
    } catch {
      // A malformed environment value leaves the public API unavailable.
    }
    return { key, projects: [] };
  }

  const projectPath = process.env.OMNIHARNESS_PUBLIC_API_PROJECT_PATH?.trim() ?? "";
  return { key, projects: projectPath ? [{ id: "default", path: projectPath }] : [] };
}

function hasValidApiKey(request: Request, expected: string) {
  const value = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!expected || !value) return false;
  const actual = Buffer.from(value);
  const configured = Buffer.from(expected);
  return actual.length === configured.length && crypto.timingSafeEqual(actual, configured);
}

function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function unauthorized() {
  return apiError(401, "public_api.unauthorized", "A valid public API key is required.");
}

function unavailable() {
  return apiError(503, "public_api.unconfigured", "The public chat API is not configured.");
}

function validateRequest(request: Request) {
  const config = publicApiConfig();
  if (!config.key || config.projects.length === 0) return { response: unavailable(), config: null };
  if (!hasValidApiKey(request, config.key)) return { response: unauthorized(), config: null };
  return { response: null, config };
}

function projectForRequest(config: PublicApiConfig, projectId: string | undefined) {
  const id = projectId?.trim() ?? "";
  return config.projects.find((project) => project.id === id) ?? null;
}

function defaultProject(config: PublicApiConfig) {
  return config.projects.find((project) => project.id === "default") ?? config.projects[0] ?? null;
}

function messageFromBody(body: unknown) {
  const message = typeof (body as { message?: unknown } | null)?.message === "string"
    ? (body as { message: string }).message.trim()
    : "";
  return message && message.length <= MAX_MESSAGE_LENGTH ? message : null;
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

function publicUrls(request: Request, projectId: string, runId: string) {
  const origin = getPublicOriginFromRequest(request.url, request.headers);
  const path = `/api/public/v1/projects/${encodeURIComponent(projectId)}/chats/${encodeURIComponent(runId)}`;
  return { pollUrl: `${origin}${path}`, streamUrl: `${origin}${path}/stream` };
}

async function createChat(request: Request, project: PublicProject, message: string) {
  const created = await createConversation({
    mode: "direct",
    command: message,
    projectPath: project.path,
    preferredWorkerType: "codex",
    allowedWorkerTypes: ["codex"],
  });
  return Response.json({ ok: true, conversationId: created.runId, status: "accepted", ...publicUrls(request, project.id, created.runId) }, { status: 202 });
}

async function sendChatMessage(request: Request, project: PublicProject, runId: string, message: string) {
  const run = await getPublicRun(runId, project.path);
  if (!run) return apiError(404, "public_api.conversation_not_found", "Conversation not found for the selected project.");
  await sendConversationMessage({ runId: run.id, content: message, preferredWorkerType: "codex", allowedWorkerTypes: ["codex"] });
  return Response.json({ ok: true, conversationId: run.id, status: "accepted", ...publicUrls(request, project.id, run.id) }, { status: 202 });
}

async function streamChat(request: Request, project: PublicProject, runId: string) {
  if (!await getPublicRun(runId, project.path)) {
    return apiError(404, "public_api.conversation_not_found", "Conversation not found for the selected project.");
  }
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async () => {
        if (closed) return;
        const state = await getConversationState(runId, project.path);
        if (!state) {
          controller.enqueue(encoder.encode("event: error\ndata: {\"code\":\"public_api.conversation_not_found\"}\n\n"));
          controller.close();
          closed = true;
          if (timer) clearInterval(timer);
          return;
        }
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(state)}\n\n`));
        if (["done", "failed", "cancelled"].includes(state.status)) {
          controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ conversationId: state.conversationId, status: state.status })}\n\n`));
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
}

export const handlePublicProjectsRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  return Response.json({ ok: true, projects: auth.config.projects.map((project) => ({ id: project.id })) });
};

export const handlePublicProjectChatsRequest: OmniHttpHandler = async (request, context) => {
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  if (request.method === "POST") {
    const message = messageFromBody(await request.json().catch(() => null));
    return message ? createChat(request, project, message) : apiError(400, "public_api.invalid_message", `message must contain 1 to ${MAX_MESSAGE_LENGTH} characters.`);
  }
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const url = new URL(request.url);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const chats = await db.select({
    id: runs.id,
    title: runs.title,
    status: runs.status,
    workerType: runs.preferredWorkerType,
    model: runs.preferredWorkerModel,
    createdAt: runs.createdAt,
    updatedAt: runs.updatedAt,
    lastActivityAt: runs.lastActivityAt,
  }).from(runs).where(eq(runs.projectPath, project.path))
    .orderBy(desc(runs.lastActivityAt), desc(runs.createdAt)).limit(limit);
  return Response.json({ ok: true, project: { id: project.id }, chats });
};

export const handlePublicProjectChatRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  const state = await getConversationState(context.params?.chatId ?? "", project.path);
  return state ? Response.json({ ok: true, ...state }) : apiError(404, "public_api.conversation_not_found", "Conversation not found for the selected project.");
};

export const handlePublicProjectChatMessageRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  const message = messageFromBody(await request.json().catch(() => null));
  return message
    ? sendChatMessage(request, project, context.params?.chatId ?? "", message)
    : apiError(400, "public_api.invalid_message", `message must contain 1 to ${MAX_MESSAGE_LENGTH} characters.`);
};

export const handlePublicProjectChatStreamRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  return streamChat(request, project, context.params?.chatId ?? "");
};

// Legacy single-project endpoints remain available for existing callers.
export const handlePublicChatRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = defaultProject(auth.config);
  if (!project) return unavailable();
  const body = await request.json().catch(() => null) as { message?: unknown; conversationId?: unknown } | null;
  const message = messageFromBody(body);
  if (!message) return apiError(400, "public_api.invalid_message", `message must contain 1 to ${MAX_MESSAGE_LENGTH} characters.`);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
  return conversationId ? sendChatMessage(request, project, conversationId, message) : createChat(request, project, message);
};

export const handlePublicChatStatusRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = defaultProject(auth.config);
  if (!project) return unavailable();
  const state = await getConversationState(context.params?.id ?? "", project.path);
  return state ? Response.json({ ok: true, ...state }) : apiError(404, "public_api.conversation_not_found", "Conversation not found for the configured project.");
};

export const handlePublicChatStreamRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = defaultProject(auth.config);
  return project ? streamChat(request, project, context.params?.id ?? "") : unavailable();
};