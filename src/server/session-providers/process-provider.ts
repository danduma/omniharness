import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, processSessions, runs, workers } from "@/server/db/schema";
import { createAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { createRunId } from "@/server/runs/ids";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { getDefaultCapabilities } from "./capabilities";
import {
  normalizeProcessArgv,
  redactCommandPreview,
  spawnProcessSession,
  stopProcessSession,
  validateProcessCwd,
  writeProcessStdin,
} from "./process-store";
import type {
  CreateSessionInput,
  CreateSessionResult,
  ProviderSessionRecord,
  SendSessionInput,
  SendSessionInputResult,
  SessionProvider,
  StopSessionInput,
  StopSessionResult,
} from "./types";

function defaultProcessTitle(commandPreview: string) {
  return commandPreview.length <= 80 ? commandPreview : `${commandPreview.slice(0, 77)}...`;
}

function readEnvPolicy(value: unknown) {
  return value === "inherit_safe" ? "inherit_safe" as const : "minimal" as const;
}

export const processSessionProvider: SessionProvider = {
  type: "process",

  async create(input: CreateSessionInput): Promise<CreateSessionResult> {
    const argv = normalizeProcessArgv({
      argv: input.process?.argv,
      command: input.process?.command,
    }, input.command);
    const commandPreview = redactCommandPreview(argv);
    const cwd = await validateProcessCwd(input.process?.cwd ?? input.projectPath, input.projectPath);
    const envPolicy = readEnvPolicy(input.process?.envPolicy);
    const planPath = createAdHocPlan(`Process session:\n\n${commandPreview}`);
    const planId = randomUUID();
    const runId = input.requestedRunId?.trim() || createRunId();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      sessionType: "process",
      mode: "direct",
      projectPath: input.projectPath?.trim() || cwd,
      title: defaultProcessTitle(commandPreview),
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    const { workerId, workerNumber } = await allocateWorkerIdentity(runId);
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "process",
      status: "starting",
      cwd,
      workerNumber,
      title: commandPreview,
      initialPrompt: commandPreview,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(processSessions).values({
      runId,
      workerId,
      cwd,
      commandJson: JSON.stringify(argv),
      commandPreview,
      envPolicy,
      status: "starting",
      createdAt: now,
      updatedAt: now,
    });

    const message = {
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: commandPreview,
      createdAt: now,
    };
    await db.insert(messages).values(message);

    emitNamedEvent({ kind: "session.created", runId, sessionType: "process", actorIds: [workerId] });
    emitNamedEvent({ kind: "worker.spawned", runId, workerId, workerType: "process" });
    notifyEventStreamSubscribers();

    void spawnProcessSession({
      runId,
      workerId,
      cwd,
      argv,
      envPolicy,
      commandPreview,
    });

    const plan = await db.select().from(plans).where(eq(plans.id, planId)).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    return {
      planId,
      runId,
      mode: "direct",
      plan,
      run,
      message: serializeMessageRecord(message),
    };
  },

  async sendInput(input: SendSessionInput): Promise<SendSessionInputResult> {
    const content = input.content.trim();
    if (!content) {
      throw Object.assign(new Error("Input is required."), { status: 400 });
    }
    await writeProcessStdin({
      runId: input.runId,
      inputId: randomUUID(),
      text: content,
    });
    return { ok: true };
  },

  async stop(input: StopSessionInput): Promise<StopSessionResult> {
    const result = await stopProcessSession({ runId: input.runId, reason: input.reason ?? "user" });
    return {
      ok: true,
      runId: input.runId,
      alreadyStopped: result.alreadyStopped,
      status: result.status,
    };
  },

  getCapabilities(session: ProviderSessionRecord) {
    return getDefaultCapabilities({ ...session, sessionType: "process" });
  },

  serialize(session: ProviderSessionRecord) {
    return {
      id: session.runId,
      runId: session.runId,
      sessionType: "process",
      status: session.status,
      capabilities: this.getCapabilities(session),
      primaryActorId: session.primaryActorId ?? null,
      title: session.title ?? null,
      projectPath: session.projectPath ?? null,
      providerMetadata: session.providerMetadata ?? null,
    };
  },
};
