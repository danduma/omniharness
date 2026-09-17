import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, settings, workers } from "@/server/db/schema";
import { createConversation } from "@/server/conversations/create";
import { sendConversationMessage } from "@/server/conversations/send-message";
import { readWorkerEntriesTail } from "@/server/workers/output-store";
import { RUN_ID_PATTERN } from "@/server/runs/ids";
import { getPublicOriginFromRequest } from "@/server/auth/config";
import { decryptSettingValue } from "@/server/settings/crypto";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  notifyEventStreamSubscribers,
  waitForEventStreamNotification,
} from "@/server/events/live-updates";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { stopConversationForApi } from "./runs";

const MAX_MESSAGE_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 200;
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const CREATE_CHAT_LIMIT = 10;
const CREATE_CHAT_WINDOW_MS = 60_000;

type CreateChatLimitRecord = { count: number; windowStartedAt: number };
const createChatRateLimits = new Map<string, CreateChatLimitRecord>();

type PublicProject = { id: string; path: string };
type PublicApiConfig = { key: string; projects: PublicProject[] };
const PUBLIC_API_KEY_SETTING = "OMNIHARNESS_PUBLIC_API_KEY";
const PUBLIC_API_PROJECTS_SETTING = "OMNIHARNESS_PUBLIC_API_PROJECTS";
const PUBLIC_API_PROJECT_PATH_SETTING = "OMNIHARNESS_PUBLIC_API_PROJECT_PATH";

function parsePublicProjects(configuredProjects: string | undefined, projectPath: string | undefined) {
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
          return projects;
        }
      }
    } catch {
      // A malformed environment value leaves the public API unavailable.
    }
    return [];
  }

  return projectPath ? [{ id: "default", path: projectPath }] : [];
}

async function publicApiConfig(): Promise<PublicApiConfig> {
  const stored = await db.select().from(settings).where(inArray(settings.key, [
    PUBLIC_API_KEY_SETTING,
    PUBLIC_API_PROJECTS_SETTING,
    PUBLIC_API_PROJECT_PATH_SETTING,
  ]));
  const values = new Map<string, string>();
  for (const setting of stored) {
    if (typeof setting.key === "string" && typeof setting.value === "string") {
      values.set(setting.key, setting.value);
    }
  }
  const storedKey = values.get(PUBLIC_API_KEY_SETTING);
  let key = process.env.OMNIHARNESS_PUBLIC_API_KEY?.trim() ?? "";
  if (storedKey?.trim()) {
    try {
      key = decryptSettingValue(storedKey).trim();
    } catch {
      // A stale or corrupt stored value must not disable a valid deployment
      // key supplied by the environment.
    }
  }
  const configuredProjects = values.get(PUBLIC_API_PROJECTS_SETTING)?.trim()
    || process.env.OMNIHARNESS_PUBLIC_API_PROJECTS?.trim();
  const projectPath = values.get(PUBLIC_API_PROJECT_PATH_SETTING)?.trim()
    || process.env.OMNIHARNESS_PUBLIC_API_PROJECT_PATH?.trim();
  return { key, projects: parsePublicProjects(configuredProjects, projectPath) };
}

function hasValidApiKey(request: Request, expected: string) {
  const value = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!expected || !value) return false;
  const actual = crypto.createHash("sha256").update(value).digest();
  const configured = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(actual, configured);
}

function checkCreateChatRateLimit(projectId: string) {
  const now = Date.now();
  const current = createChatRateLimits.get(projectId);
  const record = !current || now - current.windowStartedAt >= CREATE_CHAT_WINDOW_MS
    ? { count: 0, windowStartedAt: now }
    : current;
  record.count += 1;
  createChatRateLimits.set(projectId, record);
  return record.count <= CREATE_CHAT_LIMIT
    ? { allowed: true as const }
    : { allowed: false as const, retryAfterMs: CREATE_CHAT_WINDOW_MS - (now - record.windowStartedAt) };
}

export function resetPublicChatRateLimitsForTests() {
  createChatRateLimits.clear();
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

async function validateRequest(request: Request) {
  const config = await publicApiConfig();
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

function titleFromBody(body: unknown) {
  const title = typeof (body as { title?: unknown } | null)?.title === "string"
    ? (body as { title: string }).title.trim().replace(/\s+/g, " ")
    : "";
  return title && title.length <= MAX_TITLE_LENGTH ? title : null;
}

function queryBoundedInteger(request: Request, name: string, fallback: number, maximum: number) {
  const value = Number.parseInt(new URL(request.url).searchParams.get(name) ?? "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), maximum) : fallback;
}

async function getPublicRun(runId: string, projectPath: string) {
  if (!RUN_ID_PATTERN.test(runId)) return null;
  return db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.projectPath, projectPath))).get();
}

async function getConversationState(runId: string, projectPath: string, entriesLimit = 100) {
  const run = await getPublicRun(runId, projectPath);
  if (!run) return null;
  const worker = await db.select().from(workers)
    .where(eq(workers.runId, runId))
    .orderBy(desc(workers.workerNumber), desc(workers.createdAt))
    .get();
  const tail = worker ? await readWorkerEntriesTail(runId, worker.id, entriesLimit) : null;
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
          return;
        }
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(state)}\n\n`));
        if (["done", "failed", "cancelled"].includes(state.status)) {
          controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ conversationId: state.conversationId, status: state.status })}\n\n`));
          controller.close();
          closed = true;
        }
      };
      const pump = async () => {
        try {
          while (!closed) {
            await send();
            if (!closed) {
              await waitForEventStreamNotification(30_000, undefined, request.signal);
            }
          }
        } catch (error) {
          closed = true;
          controller.error(error);
        }
      };
      void pump();
      request.signal.addEventListener("abort", () => {
        closed = true;
      }, { once: true });
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" } });
}

export const handlePublicProjectsRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  return Response.json({ ok: true, projects: auth.config.projects.map((project) => ({ id: project.id })) });
};

export const handlePublicApiDiscoveryRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  return Response.json({
    ok: true,
    version: "v1",
    projects: auth.config.projects.map((project) => ({ id: project.id })),
    endpoints: {
      projects: "GET /api/public/v1/projects",
      sessions: "GET|POST /api/public/v1/projects/:projectId/chats",
      session: "GET|PATCH /api/public/v1/projects/:projectId/chats/:chatId",
      messages: "POST /api/public/v1/projects/:projectId/chats/:chatId/messages",
      stop: "POST /api/public/v1/projects/:projectId/chats/:chatId/stop",
      stream: "GET /api/public/v1/projects/:projectId/chats/:chatId/stream",
    },
  });
};

export const handlePublicProjectChatsRequest: OmniHttpHandler = async (request, context) => {
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  if (request.method === "POST") {
    const message = messageFromBody(await request.json().catch(() => null));
    if (!message) {
      return apiError(400, "public_api.invalid_message", `message must contain 1 to ${MAX_MESSAGE_LENGTH} characters.`);
    }
    const rateLimit = checkCreateChatRateLimit(project.id);
    if (!rateLimit.allowed) {
      return Response.json({ error: { code: "public_api.rate_limited", message: "Too many chats were created. Try again shortly." } }, {
        status: 429,
        headers: { "retry-after": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))) },
      });
    }
    return createChat(request, project, message);
  }
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const url = new URL(request.url);
  const limit = queryBoundedInteger(request, "limit", 50, 100);
  const requestedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
  const status = url.searchParams.get("status")?.trim();
  const conditions = status
    ? and(eq(runs.projectPath, project.path), eq(runs.status, status))
    : eq(runs.projectPath, project.path);
  const chats = await db.select({
    id: runs.id,
    title: runs.title,
    status: runs.status,
    workerType: runs.preferredWorkerType,
    model: runs.preferredWorkerModel,
    createdAt: runs.createdAt,
    updatedAt: runs.updatedAt,
    lastActivityAt: runs.lastActivityAt,
  }).from(runs).where(conditions)
    .orderBy(desc(runs.lastActivityAt), desc(runs.createdAt)).limit(limit).offset(offset);
  return Response.json({
    ok: true,
    project: { id: project.id },
    chats,
    page: { limit, offset, nextOffset: chats.length === limit ? offset + chats.length : null },
  });
};

export const handlePublicProjectChatRequest: OmniHttpHandler = async (request, context) => {
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  const chatId = context.params?.chatId ?? "";
  if (request.method === "PATCH") {
    const title = titleFromBody(await request.json().catch(() => null));
    if (!title) return apiError(400, "public_api.invalid_title", `title must contain 1 to ${MAX_TITLE_LENGTH} characters.`);
    const run = await getPublicRun(chatId, project.path);
    if (!run) return apiError(404, "public_api.conversation_not_found", "Conversation not found for the selected project.");
    await db.update(runs).set({ title, updatedAt: new Date() }).where(eq(runs.id, run.id));
    emitNamedEvent({ kind: "conversation.title_updated", runId: run.id, source: "public_api", title });
    notifyEventStreamSubscribers();
    return Response.json({ ok: true, conversationId: run.id, title });
  }
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const state = await getConversationState(chatId, project.path, queryBoundedInteger(request, "entriesLimit", 100, 1_000));
  return state ? Response.json({ ok: true, ...state }) : apiError(404, "public_api.conversation_not_found", "Conversation not found for the selected project.");
};

export const handlePublicProjectChatStopRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  const chatId = context.params?.chatId ?? "";
  if (!await getPublicRun(chatId, project.path)) {
    return apiError(404, "public_api.conversation_not_found", "Conversation not found for the selected project.");
  }
  const result = await stopConversationForApi(chatId);
  return result.ok
    ? Response.json(result)
    : apiError(result.status, result.status === 404 ? "public_api.conversation_not_found" : "public_api.conversation_stop_refused", result.error.message);
};

export const handlePublicProjectChatMessageRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = await validateRequest(request);
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
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = projectForRequest(auth.config, context.params?.projectId);
  if (!project) return apiError(404, "public_api.project_not_found", "Project is not available through the public API.");
  return streamChat(request, project, context.params?.chatId ?? "");
};

// Legacy single-project endpoints remain available for existing callers.
export const handlePublicChatRequest: OmniHttpHandler = async (request) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = await validateRequest(request);
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
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = defaultProject(auth.config);
  if (!project) return unavailable();
  const state = await getConversationState(context.params?.id ?? "", project.path);
  return state ? Response.json({ ok: true, ...state }) : apiError(404, "public_api.conversation_not_found", "Conversation not found for the configured project.");
};

export const handlePublicChatStreamRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Method not allowed.");
  const auth = await validateRequest(request);
  if (auth.response || !auth.config) return auth.response!;
  const project = defaultProject(auth.config);
  return project ? streamChat(request, project, context.params?.id ?? "") : unavailable();
};
