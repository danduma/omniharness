import { desc, eq } from "drizzle-orm";
import * as bridge from "@/server/bridge-client";
import { db } from "@/server/db";
import { clarifications, executionEvents, messages, runs, workers } from "@/server/db/schema";
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
  preferredWorkerType: string | null;
  allowedWorkerTypes: string[];
  recentUserMessages: string[];
  pendingClarifications: Array<{ id: string; question: string }>;
  answeredClarifications: Array<{ question: string; answer: string }>;
  activeWorkers: WorkerObservation[];
  recentEvents: Array<{ eventType: string; summary: string; createdAt: string }>;
}

export async function buildSupervisorTurnContext(runId: string): Promise<SupervisorTurnContext> {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const allMessages = (await db.select().from(messages).where(eq(messages.runId, runId)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const userMessages = allMessages.filter((message) => message.role === "user");
  const goal = userMessages.map((message) => message.content).join("\n\n").trim();
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

  const recentEvents = (await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).orderBy(desc(executionEvents.createdAt)))
    .slice(0, 8)
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
      };
    });

  return {
    runId,
    projectPath: run.projectPath,
    goal,
    preferredWorkerType: run.preferredWorkerType,
    allowedWorkerTypes: parseAllowedWorkerTypes(run.allowedWorkerTypes),
    recentUserMessages: userMessages.slice(-6).map((message) => message.content),
    pendingClarifications,
    answeredClarifications,
    activeWorkers,
    recentEvents,
  };
}
