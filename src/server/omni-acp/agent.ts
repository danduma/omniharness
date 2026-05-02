import { randomUUID } from "crypto";
import { asc, desc, eq } from "drizzle-orm";
import * as acp from "@agentclientprotocol/sdk";
import { db } from "@/server/db";
import { executionEvents, messages, runs, workers } from "@/server/db/schema";
import { createConversation } from "@/server/conversations/create";
import { sendConversationMessage } from "@/server/conversations/send-message";
import { waitForEventStreamNotification } from "@/server/events/live-updates";
import { CONVERSATION_MODES, type ConversationMode } from "@/server/conversations/modes";

const OMNI_ACP_MODES: acp.SessionMode[] = [
  {
    id: "implementation",
    name: "Implement plan",
    description: "Start a supervisor-managed OmniHarness implementation run.",
  },
  {
    id: "planning",
    name: "Create plan",
    description: "Use a single ACP-backed worker to create or refine a plan.",
  },
  {
    id: "direct",
    name: "Direct control",
    description: "Use a single ACP-backed worker as a direct conversation surface.",
  },
];

type SessionState = {
  sessionId: string;
  cwd: string;
  mode: ConversationMode;
  runId: string | null;
  abortController: AbortController | null;
  seenMessageIds: Set<string>;
  seenEventIds: Set<string>;
  workerTextById: Map<string, string>;
};

type WaitForTurnResult = {
  stopReason: acp.StopReason;
};

type WaitForTurnArgs = {
  sessionId: string;
  runId: string;
  signal: AbortSignal;
  emit: (text: string) => Promise<void>;
  state?: SessionState;
};

export type OmniHarnessAcpAgentDeps = {
  createConversation: typeof createConversation;
  sendConversationMessage: typeof sendConversationMessage;
  waitForTurn: (args: WaitForTurnArgs) => Promise<WaitForTurnResult>;
};

function isConversationMode(value: string): value is ConversationMode {
  return CONVERSATION_MODES.includes(value as ConversationMode);
}

function normalizeRunMode(value: string): ConversationMode {
  return isConversationMode(value) ? value : "implementation";
}

function modeState(currentModeId: ConversationMode): acp.SessionModeState {
  return {
    currentModeId,
    availableModes: OMNI_ACP_MODES,
  };
}

function textFromPrompt(prompt: acp.PromptRequest["prompt"]) {
  const chunks: string[] = [];
  for (const block of prompt) {
    if (block.type === "text" && block.text.trim()) {
      chunks.push(block.text.trim());
    } else if (block.type === "resource_link") {
      chunks.push(`Resource: ${block.uri}`);
    }
  }
  return chunks.join("\n\n").trim();
}

function parseEventSummary(details: string | null, fallback: string) {
  if (!details?.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    for (const key of ["summary", "reason", "error"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    return details.trim();
  }

  return fallback;
}

function activeWorkerStatus(status: string) {
  return status === "starting" || status === "working" || status === "running";
}

function sessionInfoFromRun(run: typeof runs.$inferSelect): acp.SessionInfo {
  return {
    sessionId: run.id,
    cwd: run.projectPath || process.cwd(),
    title: run.title || run.id,
    updatedAt: run.updatedAt.toISOString(),
  };
}

function waitForNotificationOrAbort(signal: AbortSignal, timeoutMs: number) {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return Promise.race([
    waitForEventStreamNotification(timeoutMs),
    new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => resolve(), { once: true });
    }),
  ]);
}

async function emitCurrentRunState(args: WaitForTurnArgs) {
  const state = args.state;
  if (!state) {
    return {
      run: await db.select().from(runs).where(eq(runs.id, args.runId)).get(),
      workerRecords: await db.select().from(workers).where(eq(workers.runId, args.runId)),
    };
  }

  const [run, runMessages, workerRecords, runEvents] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, args.runId)).get(),
    db.select().from(messages).where(eq(messages.runId, args.runId)).orderBy(asc(messages.createdAt)),
    db.select().from(workers).where(eq(workers.runId, args.runId)).orderBy(asc(workers.createdAt)),
    db.select().from(executionEvents).where(eq(executionEvents.runId, args.runId)).orderBy(asc(executionEvents.createdAt)),
  ]);

  for (const message of runMessages) {
    if (state.seenMessageIds.has(message.id)) {
      continue;
    }
    state.seenMessageIds.add(message.id);
    await args.emit(`${message.role}${message.workerId ? `:${message.workerId}` : ""}: ${message.content}`);
  }

  for (const event of runEvents) {
    if (state.seenEventIds.has(event.id)) {
      continue;
    }
    state.seenEventIds.add(event.id);
    await args.emit(`${event.eventType}: ${parseEventSummary(event.details, event.eventType)}`);
  }

  for (const worker of workerRecords) {
    const text = worker.currentText.trim() || worker.lastText.trim() || worker.outputLog.trim();
    if (!text || state.workerTextById.get(worker.id) === text) {
      continue;
    }
    state.workerTextById.set(worker.id, text);
    await args.emit(`worker:${worker.id}: ${text}`);
  }

  return { run, workerRecords };
}

export async function waitForOmniConversationTurn(args: WaitForTurnArgs): Promise<WaitForTurnResult> {
  while (!args.signal.aborted) {
    const snapshot = await emitCurrentRunState(args);
    if (!snapshot.run) {
      await args.emit(`Run ${args.runId} disappeared.`);
      return { stopReason: "end_turn" };
    }

    if (snapshot.run.status === "failed") {
      await args.emit(`Run failed: ${snapshot.run.lastError || snapshot.run.id}`);
      return { stopReason: "refusal" };
    }

    if (snapshot.run.status === "done") {
      await args.emit(`Run completed: ${snapshot.run.title || snapshot.run.id}`);
      return { stopReason: "end_turn" };
    }

    if (snapshot.run.mode !== "implementation" && !snapshot.workerRecords.some((worker) => activeWorkerStatus(worker.status))) {
      return { stopReason: "end_turn" };
    }

    await waitForNotificationOrAbort(args.signal, 1_000);
  }

  return { stopReason: "cancelled" };
}

export class OmniHarnessAcpAgent implements acp.Agent {
  private readonly sessions = new Map<string, SessionState>();
  private readonly deps: OmniHarnessAcpAgentDeps;

  constructor(
    private readonly connection: Pick<acp.AgentSideConnection, "sessionUpdate">,
    deps: Partial<OmniHarnessAcpAgentDeps> = {},
  ) {
    this.deps = {
      createConversation,
      sendConversationMessage,
      waitForTurn: waitForOmniConversationTurn,
      ...deps,
    };
  }

  async initialize(_params: acp.InitializeRequest): Promise<acp.InitializeResponse> {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentInfo: {
        name: "OmniHarness",
        version: "0.1.0",
      },
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {},
        sessionCapabilities: {
          list: {},
          resume: {},
          fork: {},
        },
      },
    };
  }

  async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      cwd: params.cwd,
      mode: "implementation",
      runId: null,
      abortController: null,
      seenMessageIds: new Set(),
      seenEventIds: new Set(),
      workerTextById: new Map(),
    });

    return {
      sessionId,
      modes: modeState("implementation"),
    };
  }

  async loadSession(params: acp.LoadSessionRequest): Promise<acp.LoadSessionResponse> {
    const run = await this.requireRun(params.sessionId);
    const state = this.createSessionStateFromRun(run, params.cwd);
    this.sessions.set(params.sessionId, state);
    await this.replayRunHistory(params.sessionId);

    return {
      modes: modeState(state.mode),
    };
  }

  async unstable_listSessions(params: acp.ListSessionsRequest = {}): Promise<acp.ListSessionsResponse> {
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) : 0;
    const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const pageSize = 50;
    const allRuns = await db.select().from(runs).orderBy(desc(runs.updatedAt));
    const cwd = params.cwd?.trim() || null;
    const filteredRuns = cwd
      ? allRuns.filter((run) => (run.projectPath || process.cwd()) === cwd)
      : allRuns;
    const page = filteredRuns.slice(safeOffset, safeOffset + pageSize);
    const nextOffset = safeOffset + pageSize;

    return {
      sessions: page.map(sessionInfoFromRun),
      nextCursor: nextOffset < filteredRuns.length ? String(nextOffset) : null,
    };
  }

  async unstable_resumeSession(params: acp.ResumeSessionRequest): Promise<acp.ResumeSessionResponse> {
    const run = await this.requireRun(params.sessionId);
    const state = this.createSessionStateFromRun(run, params.cwd);
    this.sessions.set(params.sessionId, state);

    return {
      modes: modeState(state.mode),
    };
  }

  async unstable_forkSession(params: acp.ForkSessionRequest): Promise<acp.ForkSessionResponse> {
    const source = await this.resolveSessionOrRun(params.sessionId);
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      cwd: params.cwd || source.cwd,
      mode: source.mode,
      runId: null,
      abortController: null,
      seenMessageIds: new Set(),
      seenEventIds: new Set(),
      workerTextById: new Map(),
    });

    return {
      sessionId,
      modes: modeState(source.mode),
    };
  }

  async setSessionMode(params: acp.SetSessionModeRequest): Promise<acp.SetSessionModeResponse> {
    const session = this.requireSession(params.sessionId);
    if (!isConversationMode(params.modeId)) {
      throw new Error(`Unsupported OmniHarness mode "${params.modeId}".`);
    }
    session.mode = params.modeId;
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: "current_mode_update",
        currentModeId: params.modeId,
      },
    });
    return {};
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    const session = this.requireSession(params.sessionId);
    const command = textFromPrompt(params.prompt);
    if (!command) {
      throw new Error("OmniHarness ACP prompts must include text content.");
    }

    session.abortController?.abort();
    const abortController = new AbortController();
    session.abortController = abortController;

    const emit = (text: string) => this.emitText(params.sessionId, text);

    try {
      if (!session.runId) {
        const created = await this.deps.createConversation({
          mode: session.mode,
          command,
          projectPath: session.cwd,
        });
        session.runId = created.runId;
        await emit(`Started ${created.mode} OmniHarness conversation ${created.runId}.`);
      } else {
        await this.deps.sendConversationMessage({
          runId: session.runId,
          content: command,
        });
      }

      return await this.deps.waitForTurn({
        sessionId: params.sessionId,
        runId: session.runId,
        signal: abortController.signal,
        emit,
        state: session,
      });
    } finally {
      if (session.abortController === abortController) {
        session.abortController = null;
      }
    }
  }

  async cancel(params: acp.CancelNotification) {
    const session = this.sessions.get(params.sessionId);
    session?.abortController?.abort();
  }

  async authenticate(_params: acp.AuthenticateRequest) {
    return {};
  }

  private requireSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`OmniHarness ACP session not found: ${sessionId}`);
    }
    return session;
  }

  private async requireRun(runId: string) {
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      throw new Error(`OmniHarness run not found: ${runId}`);
    }
    return run;
  }

  private createSessionStateFromRun(run: typeof runs.$inferSelect, cwd: string): SessionState {
    return {
      sessionId: run.id,
      cwd: run.projectPath || cwd,
      mode: normalizeRunMode(run.mode),
      runId: run.id,
      abortController: null,
      seenMessageIds: new Set(),
      seenEventIds: new Set(),
      workerTextById: new Map(),
    };
  }

  private async resolveSessionOrRun(sessionId: string) {
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      return {
        cwd: existingSession.cwd,
        mode: existingSession.mode,
      };
    }

    const run = await this.requireRun(sessionId);
    return {
      cwd: run.projectPath || process.cwd(),
      mode: normalizeRunMode(run.mode),
    };
  }

  private async replayRunHistory(sessionId: string) {
    const state = this.requireSession(sessionId);
    const runMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.runId, state.runId || sessionId))
      .orderBy(asc(messages.createdAt));

    for (const message of runMessages) {
      state.seenMessageIds.add(message.id);
      await this.connection.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: message.role === "user" ? "user_message_chunk" : "agent_message_chunk",
          content: {
            type: "text",
            text: message.content,
          },
        },
      });
    }
  }

  private async emitText(sessionId: string, text: string) {
    if (!text.trim()) {
      return;
    }
    await this.connection.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          type: "text",
          text,
        },
      },
    });
  }
}
