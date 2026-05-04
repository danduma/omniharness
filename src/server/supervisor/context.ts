import { desc, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import * as bridge from "@/server/bridge-client";
import { getAppDataPath } from "@/server/app-root";
import { db } from "@/server/db";
import { clarifications, executionEvents, messages, plans, runs, workers } from "@/server/db/schema";
import { appendAttachmentContext, parseChatAttachmentsJson } from "@/lib/chat-attachments";
import { parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export interface WorkerObservation {
  workerId: string;
  type: string;
  status: string;
  purpose: string | null;
  silenceMs: number;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
  currentText: string;
  lastText: string;
  stderrTail: string;
  stopReason: string | null;
}

export interface SupervisorTurnContext {
  runId: string;
  projectPath: string | null;
  goal: string;
  planPath: string | null;
  planContent: string | null;
  readFiles: Array<{ path: string; content: string; truncated: boolean }>;
  workerHistoryReads: Array<{ workerId: string; lines: number; content: string; truncated: boolean }>;
  repoInspections: Array<{ command: string; args: string[]; cwd: string | null; output: string; exitCode: number | null }>;
  preferredWorkerType: string | null;
  allowedWorkerTypes: string[];
  recentUserMessages: string[];
  conversationTurns: Array<{ role: string; content: string; createdAt: string; kind: string | null }>;
  pendingClarifications: Array<{ id: string; question: string }>;
  answeredClarifications: Array<{ question: string; answer: string }>;
  activeWorkers: WorkerObservation[];
  recentEvents: Array<{ eventType: string; summary: string; createdAt: string; workerId: string | null }>;
  compactedMemory: string | null;
}

function parseCompactedMemory(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return typeof parsed.memorySummary === "string" && parsed.memorySummary.trim()
      ? parsed.memorySummary.trim()
      : null;
  } catch {
    return null;
  }
}

function resolvePlanPath(planPath: string) {
  return path.isAbsolute(planPath) ? planPath : getAppDataPath(planPath);
}

function readPlanContent(planPath: string | null) {
  if (!planPath) {
    return null;
  }

  try {
    const absolutePlanPath = resolvePlanPath(planPath);
    if (!fs.existsSync(absolutePlanPath)) {
      return null;
    }
    return fs.readFileSync(absolutePlanPath, "utf8");
  } catch {
    return null;
  }
}

function parseReadFileEvent(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    if (typeof parsed.path !== "string" || typeof parsed.content !== "string") {
      return null;
    }
    return {
      path: parsed.path,
      content: parsed.content,
      truncated: parsed.truncated === true,
    };
  } catch {
    return null;
  }
}

function parseRepoInspectionEvent(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    if (typeof parsed.command !== "string" || typeof parsed.output !== "string") {
      return null;
    }

    return {
      command: parsed.command,
      args: Array.isArray(parsed.args) ? parsed.args.filter((item): item is string => typeof item === "string") : [],
      cwd: typeof parsed.cwd === "string" ? parsed.cwd : null,
      output: parsed.output,
      exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : null,
    };
  } catch {
    return null;
  }
}

function parseWorkerHistoryReadEvent(details: string | null) {
  if (!details) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    if (typeof parsed.workerId !== "string" || typeof parsed.content !== "string") {
      return null;
    }
    return {
      workerId: parsed.workerId,
      lines: typeof parsed.lines === "number" ? parsed.lines : 0,
      content: parsed.content,
      truncated: parsed.truncated === true,
    };
  } catch {
    return null;
  }
}

export async function buildSupervisorTurnContext(runId: string): Promise<SupervisorTurnContext> {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const plan = await db.select().from(plans).where(eq(plans.id, run.planId)).get();
  const planPath = plan?.path ?? null;
  const planContent = readPlanContent(planPath);
  const allMessages = (await db.select().from(messages).where(eq(messages.runId, runId)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const userMessages = allMessages.filter((message) => message.role === "user");
  const goal = userMessages.map((message) => appendAttachmentContext(
    message.content,
    parseChatAttachmentsJson(message.attachmentsJson),
  )).join("\n\n").trim();
  const conversationTurns = allMessages
    .filter((message) => message.role === "user" || message.role === "supervisor")
    .map((message) => ({
      role: message.role,
      content: message.role === "user"
        ? appendAttachmentContext(message.content, parseChatAttachmentsJson(message.attachmentsJson))
        : message.content,
      createdAt: message.createdAt.toISOString(),
      kind: message.kind ?? null,
    }));
  const allClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, runId));
  const pendingClarifications = allClarifications
    .filter((clarification) => clarification.status === "pending")
    .map((clarification) => ({ id: clarification.id, question: clarification.question }));
  const answeredClarifications = allClarifications
    .filter((clarification) => clarification.status === "answered" && clarification.answer)
    .map((clarification) => ({ question: clarification.question, answer: clarification.answer ?? "" }));
  const runWorkers = (await db.select().from(workers).where(eq(workers.runId, runId)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const activeWorkers: WorkerObservation[] = [];
  const now = Date.now();

  for (const worker of runWorkers) {
    const agent = await bridge.getAgent(worker.id).catch(() => null);
    if (!agent) {
      continue;
    }

    const silenceMs = Math.max(0, now - worker.updatedAt.getTime());

    await db.update(workers).set({
      status: agent.state,
      updatedAt: worker.updatedAt,
    }).where(eq(workers.id, worker.id));

    activeWorkers.push({
      workerId: worker.id,
      type: worker.type,
      status: agent.state,
      purpose: null,
      silenceMs,
      requestedModel: agent.requestedModel ?? null,
      effectiveModel: agent.effectiveModel ?? null,
      requestedEffort: agent.requestedEffort ?? null,
      effectiveEffort: agent.effectiveEffort ?? null,
      pendingPermissions: agent.pendingPermissions ?? [],
      currentText: truncate(agent.currentText || "", 2000),
      lastText: truncate(agent.lastText || "", 2000),
      stderrTail: truncate(agent.stderrBuffer.slice(-20).join("\n"), 1000),
      stopReason: agent.stopReason,
    });
  }

  const allEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).orderBy(desc(executionEvents.createdAt));
  const compactedMemory =
    allEvents
      .filter((event) => event.eventType === "supervisor_context_compacted")
      .map((event) => parseCompactedMemory(event.details))
      .find((memory): memory is string => Boolean(memory)) ?? null;
  const readFiles = allEvents
    .filter((event) => event.eventType === "supervisor_file_read")
    .map((event) => parseReadFileEvent(event.details))
    .filter((file): file is { path: string; content: string; truncated: boolean } => Boolean(file))
    .slice(0, 6);
  const workerHistoryReads = allEvents
    .filter((event) => event.eventType === "supervisor_worker_history_read")
    .map((event) => parseWorkerHistoryReadEvent(event.details))
    .filter((history): history is { workerId: string; lines: number; content: string; truncated: boolean } => Boolean(history))
    .slice(0, 6);
  const repoInspections = allEvents
    .filter((event) => event.eventType === "supervisor_repo_inspected")
    .map((event) => parseRepoInspectionEvent(event.details))
    .filter((inspection): inspection is { command: string; args: string[]; cwd: string | null; output: string; exitCode: number | null } => Boolean(inspection))
    .slice(0, 6);
  const recentEvents = allEvents
    .slice(0, 80)
    .map((event) => {
      let summary = event.eventType;
      if (event.details) {
        try {
          const details = JSON.parse(event.details) as Record<string, unknown>;
          if (typeof details.summary === "string") {
            summary = details.summary;
          } else if (typeof details.reason === "string") {
            summary = details.reason;
          }
        } catch {
          summary = event.details;
        }
      }
      return {
        eventType: event.eventType,
        summary: truncate(summary, 240),
        createdAt: event.createdAt.toISOString(),
        workerId: event.workerId,
      };
    });

  return {
    runId,
    projectPath: run.projectPath,
    goal,
    planPath,
    planContent,
    readFiles,
    workerHistoryReads,
    repoInspections,
    preferredWorkerType: run.preferredWorkerType,
    allowedWorkerTypes: parseAllowedWorkerTypes(run.allowedWorkerTypes),
    recentUserMessages: userMessages.map((message) => appendAttachmentContext(
      message.content,
      parseChatAttachmentsJson(message.attachmentsJson),
    )),
    conversationTurns,
    pendingClarifications,
    answeredClarifications,
    activeWorkers,
    recentEvents,
    compactedMemory,
  };
}
