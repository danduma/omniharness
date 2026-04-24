import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages as dbMessages, plans, runs, workers } from "@/server/db/schema";
import { createAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { startSupervisorRun } from "@/server/supervisor/start";
import { askAgent, spawnAgent } from "@/server/bridge-client";
import { queueConversationTitleGeneration } from "@/server/conversation-title";
import { normalizeConversationMode, type ConversationMode } from "./modes";
import { normalizeWorkerType, parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { PLANNER_SYSTEM_PROMPT } from "@/server/prompts";

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
    const workerId = randomUUID();
    const cwd = projectPath || process.cwd();
    const workerType = preferredWorkerType || allowedWorkerTypes[0] || "codex";

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: workerType,
      status: "starting",
      cwd,
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

    await db.update(workers).set({
      type: agent.type || workerType,
      status: response.state,
      cwd: agent.cwd || cwd,
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
