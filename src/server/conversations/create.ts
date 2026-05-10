import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages as dbMessages, plans, runs, workers } from "@/server/db/schema";
import { createAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { startSupervisorRun } from "@/server/supervisor/start";
import { askAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { queueConversationTitleGeneration } from "@/server/conversation-title";
import { normalizeConversationMode, type ConversationMode } from "./modes";
import { normalizeWorkerType, parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { PLANNER_SYSTEM_PROMPT } from "@/server/prompts";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
import { createRunId } from "@/server/runs/ids";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { getAppRoot } from "@/server/app-root";
import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { AUTO_COMMIT_PROJECT_PROMPT } from "@/lib/conversation-visuals";
import { serializeMessageRecord } from "./message-records";


function buildInitialWorkerPrompt(mode: ConversationMode, command: string) {
  if (mode === "planning") {
    return `${PLANNER_SYSTEM_PROMPT}\n\nUser request:\n${command}`;
  }

  return command;
}

function hasVisibleWorkerOutput(responseText: string, snapshot: AgentRecord | null) {
  if (responseText.trim()) {
    return true;
  }

  if (!snapshot) {
    return false;
  }

  return Boolean(
    snapshot.renderedOutput?.trim()
    || snapshot.currentText?.trim()
    || snapshot.lastText?.trim()
    || snapshot.outputEntries?.some((entry) => entry.text.trim()),
  );
}

function buildEmptyWorkerOutputMessage(snapshot: AgentRecord | null, responseState: string) {
  const stopReason = snapshot?.stopReason?.trim();
  if (stopReason) {
    return `Agent stopped without producing output. Stop reason: ${stopReason}.`;
  }

  return `Agent stopped without producing output. Final state: ${responseState || "unknown"}.`;
}

function isAgentBusyError(error: unknown) {
  return /\bagent is busy\b/i.test(formatErrorMessage(error));
}

function getDefaultConversationTitle(mode: ConversationMode, command: string) {
  if (mode === "direct" && command === AUTO_COMMIT_PROJECT_PROMPT) {
    return "Commit";
  }

  return "New conversation";
}

async function buildCreatedConversationResponse(args: {
  planId: string;
  runId: string;
  messageId: string;
  mode: ConversationMode;
}) {
  const plan = await db.select().from(plans).where(eq(plans.id, args.planId)).get();
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  const message = await db.select().from(dbMessages).where(eq(dbMessages.id, args.messageId)).get();

  return {
    planId: args.planId,
    runId: args.runId,
    mode: args.mode,
    plan,
    run,
    message: serializeMessageRecord(message),
  };
}

async function runInitialWorkerTurn(args: {
  runId: string;
  workerId: string;
  workerType: string;
  cwd: string;
  agent: AgentRecord;
  mode: "direct" | "planning";
  command: string;
}) {
  try {
    await db.update(workers).set({
      status: "working",
      type: args.agent.type || args.workerType,
      cwd: args.agent.cwd || args.cwd,
      bridgeSessionId: args.agent.sessionId ?? null,
      bridgeSessionMode: args.agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    if (args.mode === "planning") {
      await db.update(runs).set({
        status: "working",
        updatedAt: new Date(),
      }).where(eq(runs.id, args.runId));
    }
    notifyEventStreamSubscribers();

    const response = await askAgent(args.workerId, buildInitialWorkerPrompt(args.mode, args.command));
    let snapshot: AgentRecord | null = null;
    try {
      snapshot = await getAgent(args.workerId);
      await persistWorkerSnapshot(args.workerId, snapshot);
    } catch {
      // The bridge may have already dropped a failed worker; the ask response still determines the visible state.
    }

    if (!hasVisibleWorkerOutput(response.response, snapshot)) {
      const failureMessage = buildEmptyWorkerOutputMessage(snapshot, response.state);

      await db.update(workers).set({
        type: snapshot?.type || args.agent.type || args.workerType,
        status: "error",
        cwd: snapshot?.cwd || args.agent.cwd || args.cwd,
        outputLog: failureMessage,
        bridgeSessionId: snapshot?.sessionId ?? args.agent.sessionId ?? null,
        bridgeSessionMode: snapshot?.sessionMode ?? args.agent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, args.workerId));

      await persistRunFailure(args.runId, new Error(failureMessage));
      notifyEventStreamSubscribers();
      return;
    }

    await db.update(workers).set({
      type: args.agent.type || args.workerType,
      status: response.state,
      cwd: args.agent.cwd || args.cwd,
      outputLog: response.response.trim() ? response.response : "",
      bridgeSessionId: snapshot?.sessionId ?? args.agent.sessionId ?? null,
      bridgeSessionMode: snapshot?.sessionMode ?? args.agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));

    await db.insert(dbMessages).values({
      id: randomUUID(),
      runId: args.runId,
      role: "worker",
      kind: args.mode,
      content: response.response,
      workerId: args.workerId,
      createdAt: new Date(),
    });

    if (args.mode === "planning") {
      const latestRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
      const latestWorker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
      if (latestRun) {
        await refreshPlanningArtifactsForRun({
          run: latestRun,
          worker: latestWorker,
          snapshot,
          responseText: response.response,
        });
      }
    } else {
      await db.update(runs).set({
        status: "done",
        updatedAt: new Date(),
      }).where(eq(runs.id, args.runId));
    }

    notifyEventStreamSubscribers();
  } catch (error) {
    if (isAgentBusyError(error)) {
      const now = new Date();
      await db.update(workers).set({
        status: "working",
        updatedAt: now,
      }).where(eq(workers.id, args.workerId));
      await db.update(runs).set({
        status: args.mode === "planning" ? "working" : "running",
        failedAt: null,
        lastError: null,
        updatedAt: now,
      }).where(eq(runs.id, args.runId));
      notifyEventStreamSubscribers();
      throw Object.assign(error instanceof Error ? error : new Error(formatErrorMessage(error)), { status: 409 });
    }

    await db.update(workers).set({
      status: "error",
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    await persistRunFailure(args.runId, error);
    notifyEventStreamSubscribers();
    throw error;
  }
}

async function startDirectWorkerConversation(args: {
  runId: string;
  workerId: string;
  workerType: string;
  cwd: string;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  command: string;
}) {
  try {
    const agent = await spawnAgent({
      type: args.workerType,
      cwd: args.cwd,
      name: args.workerId,
      model: args.preferredWorkerModel?.trim() || undefined,
      effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
    });

    await runInitialWorkerTurn({
      runId: args.runId,
      workerId: args.workerId,
      workerType: args.workerType,
      cwd: args.cwd,
      agent,
      mode: "direct",
      command: args.command,
    });
  } catch (error) {
    if (isAgentBusyError(error)) {
      return;
    }

    const failureMessage = formatErrorMessage(error);
    await db.update(workers).set({
      status: "error",
      outputLog: failureMessage,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    await persistRunFailure(args.runId, error);
    notifyEventStreamSubscribers();
    console.error("Initial direct conversation worker failed:", error);
  }
}

export async function createConversation(args: {
  mode?: unknown;
  command: string;
  projectPath?: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string[] | string | null;
  attachments?: ChatAttachment[];
}) {
  const mode = normalizeConversationMode(args.mode);
  const command = args.command.trim();
  const projectPath = args.projectPath?.trim() || getAppRoot();
  const attachments = normalizeChatAttachments(args.attachments ?? []);
  const attachmentsJson = serializeChatAttachments(attachments);
  const workerPrompt = appendAttachmentContext(command, attachments);
  const preferredWorkerType = args.preferredWorkerType?.trim()
    ? normalizeWorkerType(args.preferredWorkerType)
    : null;
  const defaultTitle = getDefaultConversationTitle(mode, command);
  const allowedWorkerTypes = parseAllowedWorkerTypes(
    Array.isArray(args.allowedWorkerTypes)
      ? JSON.stringify(args.allowedWorkerTypes)
      : typeof args.allowedWorkerTypes === "string"
        ? args.allowedWorkerTypes
        : null,
  );

  const planPath = createAdHocPlan(command, attachments);
  const planId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: planPath,
    status: mode === "planning" ? "starting" : "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const runId = createRunId();
  await db.insert(runs).values({
    id: runId,
    planId,
    mode,
    projectPath,
    title: defaultTitle,
    preferredWorkerType,
    preferredWorkerModel: args.preferredWorkerModel?.trim() || null,
    preferredWorkerEffort: args.preferredWorkerEffort?.trim().toLowerCase() || null,
    allowedWorkerTypes: JSON.stringify(allowedWorkerTypes),
    status: mode === "planning" ? "starting" : "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const initialMessageId = randomUUID();
  await db.insert(dbMessages).values({
    id: initialMessageId,
    runId,
    role: "user",
    kind: "checkpoint",
    content: command,
    attachmentsJson,
    createdAt: new Date(),
  });
  notifyEventStreamSubscribers();

  if (mode === "implementation") {
    startSupervisorRun(runId);
  } else {
    const { workerId, workerNumber } = await allocateWorkerIdentity(runId);
    const cwd = projectPath || process.cwd();
    const workerType = preferredWorkerType || allowedWorkerTypes[0] || "codex";

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: workerType,
      status: "starting",
      cwd,
      workerNumber,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });

    if (mode === "direct") {
      startDirectWorkerConversation({
        runId,
        workerId,
        workerType,
        cwd,
        preferredWorkerModel: args.preferredWorkerModel,
        preferredWorkerEffort: args.preferredWorkerEffort,
        command: workerPrompt,
      }).catch((error) => {
        console.error("Initial direct conversation worker failed:", error);
      });
    } else {
      const agent = await spawnAgent({
        type: workerType,
        cwd,
        name: workerId,
        model: args.preferredWorkerModel?.trim() || undefined,
        effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
      });

      runInitialWorkerTurn({
        runId,
        workerId,
        workerType,
        cwd,
        agent,
        mode,
        command: workerPrompt,
      }).catch((error) => {
        if (isAgentBusyError(error)) {
          return;
        }

        console.error(`Initial ${mode} conversation turn failed:`, error);
      });
    }

    if (defaultTitle === "New conversation") {
      queueConversationTitleGeneration({ runId, command }).catch((error) => {
        console.error("Conversation title generation failed:", error);
      });
    }
    return response;
  }

  if (defaultTitle === "New conversation") {
    queueConversationTitleGeneration({ runId, command }).catch((error) => {
      console.error("Conversation title generation failed:", error);
    });
  }

  return buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });
}
