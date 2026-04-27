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
import { persistRunFailure } from "@/server/runs/failures";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";

interface AttachmentInput {
  kind?: string;
  name?: string;
  path?: string;
}

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

export async function createConversation(args: {
  mode?: unknown;
  command: string;
  projectPath?: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string[] | string | null;
  attachments?: AttachmentInput[];
}) {
  const mode = normalizeConversationMode(args.mode);
  const command = args.command.trim();
  const projectPath = args.projectPath?.trim() || null;
  const attachments = args.attachments ?? [];
  const preferredWorkerType = args.preferredWorkerType?.trim()
    ? normalizeWorkerType(args.preferredWorkerType)
    : null;
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
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const runId = randomUUID();
  await db.insert(runs).values({
    id: runId,
    planId,
    mode,
    projectPath,
    title: "New conversation",
    preferredWorkerType,
    preferredWorkerModel: args.preferredWorkerModel?.trim() || null,
    preferredWorkerEffort: args.preferredWorkerEffort?.trim().toLowerCase() || null,
    allowedWorkerTypes: JSON.stringify(allowedWorkerTypes),
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(dbMessages).values({
    id: randomUUID(),
    runId,
    role: "user",
    kind: "checkpoint",
    content: command,
    createdAt: new Date(),
  });

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

    const agent = await spawnAgent({
      type: workerType,
      cwd,
      name: workerId,
      model: args.preferredWorkerModel?.trim() || undefined,
      effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
    });
    const response = await askAgent(workerId, buildInitialWorkerPrompt(mode, command));
    let snapshot: AgentRecord | null = null;
    try {
      snapshot = await getAgent(workerId);
      await persistWorkerSnapshot(workerId, snapshot);
    } catch {
      // The bridge may have already dropped a failed direct worker; the ask response still determines the visible state.
    }

    if (!hasVisibleWorkerOutput(response.response, snapshot)) {
      const failureMessage = buildEmptyWorkerOutputMessage(snapshot, response.state);

      await db.update(workers).set({
        type: snapshot?.type || agent.type || workerType,
        status: "error",
        cwd: snapshot?.cwd || agent.cwd || cwd,
        outputLog: failureMessage,
        bridgeSessionId: snapshot?.sessionId ?? agent.sessionId ?? null,
        bridgeSessionMode: snapshot?.sessionMode ?? agent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, workerId));

      await persistRunFailure(runId, new Error(failureMessage));

      return { planId, runId, mode };
    }

    await db.update(workers).set({
      type: agent.type || workerType,
      status: response.state,
      cwd: agent.cwd || cwd,
      outputLog: response.response.trim() ? response.response : "",
      bridgeSessionId: snapshot?.sessionId ?? agent.sessionId ?? null,
      bridgeSessionMode: snapshot?.sessionMode ?? agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, workerId));

    await db.insert(dbMessages).values({
      id: randomUUID(),
      runId,
      role: "worker",
      kind: mode,
      content: response.response,
      workerId,
      createdAt: new Date(),
    });
  }

  queueConversationTitleGeneration({ runId, command }).catch((error) => {
    console.error("Conversation title generation failed:", error);
  });

  return { planId, runId, mode };
}
