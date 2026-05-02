import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, runs, workers } from "@/server/db/schema";
import { createConversation } from "@/server/conversations/create";
import { ensureSupervisorRuntimeStarted } from "@/server/supervisor/runtime-watchdog";
import { waitForEventStreamNotification } from "@/server/events/live-updates";
import { getAgent, type AgentRecord } from "@/server/bridge-client";
import { OmniCliUsageError, omniCliUsage, parseOmniCliArgs, type OmniCliOptions } from "./options";

type WritableStreamLike = Pick<NodeJS.WritableStream, "write">;

interface OmniCliIo {
  stdout: WritableStreamLike;
  stderr: WritableStreamLike;
}

interface WatchState {
  messageIds: Set<string>;
  eventIds: Set<string>;
  workerTextById: Map<string, string>;
  printedTerminal: boolean;
}

function writeLine(stream: WritableStreamLike, line = "") {
  stream.write(`${line}\n`);
}

function describeExecutionEvent(details: string | null, fallback: string) {
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

function displayWorkerText(worker: typeof workers.$inferSelect, agent: AgentRecord | null) {
  return (
    agent?.renderedOutput?.trim()
    || agent?.currentText?.trim()
    || agent?.lastText?.trim()
    || worker.currentText.trim()
    || worker.lastText.trim()
    || worker.outputLog.trim()
  );
}

async function buildWorkerAgentMap(workerRecords: Array<typeof workers.$inferSelect>) {
  const entries = await Promise.all(
    workerRecords.map(async (worker) => {
      const agent = await getAgent(worker.id).catch(() => null);
      return [worker.id, agent] as const;
    }),
  );
  return new Map(entries);
}

async function printRunUpdates(runId: string, state: WatchState, io: OmniCliIo) {
  const [run, runMessages, runWorkers, runEvents] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, runId)).get(),
    db.select().from(messages).where(eq(messages.runId, runId)).orderBy(asc(messages.createdAt)),
    db.select().from(workers).where(eq(workers.runId, runId)).orderBy(asc(workers.createdAt)),
    db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).orderBy(asc(executionEvents.createdAt)),
  ]);
  const agentByWorkerId = await buildWorkerAgentMap(runWorkers);

  for (const message of runMessages) {
    if (state.messageIds.has(message.id)) {
      continue;
    }
    state.messageIds.add(message.id);
    const workerLabel = message.workerId ? `:${message.workerId}` : "";
    writeLine(io.stdout, `[message:${message.role}${workerLabel}] ${message.content}`);
  }

  for (const event of runEvents) {
    if (state.eventIds.has(event.id)) {
      continue;
    }
    state.eventIds.add(event.id);
    writeLine(io.stdout, `[event:${event.eventType}] ${describeExecutionEvent(event.details, event.eventType)}`);
  }

  for (const worker of runWorkers) {
    const text = displayWorkerText(worker, agentByWorkerId.get(worker.id) ?? null);
    if (!text || state.workerTextById.get(worker.id) === text) {
      continue;
    }
    state.workerTextById.set(worker.id, text);
    writeLine(io.stdout, `[worker:${worker.id}] ${text}`);
  }

  if (run && (run.status === "done" || run.status === "failed") && !state.printedTerminal) {
    state.printedTerminal = true;
    writeLine(io.stdout, `[run:${run.status}] ${run.lastError || run.title || run.id}`);
  }

  return {
    run,
    workers: runWorkers,
  };
}

function shouldContinueWatching(options: OmniCliOptions, snapshot: Awaited<ReturnType<typeof printRunUpdates>>) {
  const run = snapshot.run;
  if (!run) {
    return false;
  }
  if (run.status === "done" || run.status === "failed") {
    return false;
  }
  if (options.mode === "implementation") {
    return true;
  }

  return snapshot.workers.some((worker) => ["starting", "working", "running"].includes(worker.status));
}

async function watchRun(runId: string, options: OmniCliOptions, io: OmniCliIo) {
  const state: WatchState = {
    messageIds: new Set(),
    eventIds: new Set(),
    workerTextById: new Map(),
    printedTerminal: false,
  };

  while (true) {
    const snapshot = await printRunUpdates(runId, state, io);
    if (!shouldContinueWatching(options, snapshot)) {
      return;
    }
    await waitForEventStreamNotification(1_000);
  }
}

export async function runOmniCli(argv: string[], io: OmniCliIo = process) {
  let options: OmniCliOptions;
  try {
    options = parseOmniCliArgs(argv);
  } catch (error) {
    if (error instanceof OmniCliUsageError) {
      if (error.message) {
        writeLine(io.stderr, `Error: ${error.message}`);
        writeLine(io.stderr);
      }
      writeLine(error.message ? io.stderr : io.stdout, omniCliUsage());
      return error.message ? 1 : 0;
    }
    throw error;
  }

  await ensureSupervisorRuntimeStarted();
  const created = await createConversation({
    mode: options.mode,
    command: options.command,
    projectPath: options.projectPath,
    preferredWorkerType: options.preferredWorkerType,
    preferredWorkerModel: options.preferredWorkerModel,
    preferredWorkerEffort: options.preferredWorkerEffort,
    allowedWorkerTypes: options.allowedWorkerTypes,
  });

  if (options.json) {
    writeLine(io.stdout, JSON.stringify(created, null, 2));
  } else {
    writeLine(io.stdout, `Started ${created.mode} conversation ${created.runId}`);
    writeLine(io.stdout, `Plan ${created.planId}`);
  }

  if (options.watch) {
    await watchRun(created.runId, options, io);
  }

  return 0;
}
