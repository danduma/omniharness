import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { processSessions, runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { getAppRoot } from "@/server/app-root";
import {
  appendProcessOutputEntry,
  appendSessionInputEntry,
  appendSessionLifecycleEntry,
} from "@/server/workers/stream-writer";

export type ProcessSessionStatus =
  | "starting"
  | "running"
  | "exited"
  | "cancelled"
  | "failed"
  | "orphaned";

export type ProcessEnvPolicy = "minimal" | "inherit_safe";

type ProcessHandle = {
  runId: string;
  workerId: string;
  child: ChildProcessWithoutNullStreams;
  commandPreview: string;
  stopRequested: boolean;
  killTimer: NodeJS.Timeout | null;
};

const liveProcesses = new Map<string, ProcessHandle>();
const OUTPUT_CHUNK_CHAR_LIMIT = 16_000;
const STOP_ESCALATION_MS = 2_500;
let reconcileStarted = false;

function boundedText(value: string) {
  if (value.length <= OUTPUT_CHUNK_CHAR_LIMIT) {
    return value;
  }
  return `${value.slice(0, OUTPUT_CHUNK_CHAR_LIMIT)}\n[${value.length - OUTPUT_CHUNK_CHAR_LIMIT} characters omitted from process output chunk]`;
}

function safeEnv(policy: ProcessEnvPolicy) {
  const keys = policy === "inherit_safe"
    ? ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "TERM", "LANG", "LC_ALL", "SHELL", "USER"]
    : ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "TERM", "LANG", "LC_ALL"];
  return Object.fromEntries(
    keys
      .map((key) => [key, process.env[key]])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function assertDirectory(candidate: string) {
  const stats = await fs.stat(candidate);
  if (!stats.isDirectory()) {
    throw Object.assign(new Error(`Working directory is not a directory: ${candidate}`), { status: 400 });
  }
}

export async function validateProcessCwd(input: string | null | undefined, projectPath?: string | null) {
  const root = path.resolve(projectPath?.trim() || getAppRoot());
  const cwd = path.resolve(input?.trim() || root);
  await assertDirectory(cwd);
  await fs.access(cwd, fsConstants.R_OK);
  const relative = path.relative(root, cwd);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw Object.assign(
      new Error(`Process working directory must stay inside the selected project: ${root}`),
      { status: 400, code: "process.cwd.invalid" },
    );
  }
  return cwd;
}

export function parseCommandString(command: string): string[] {
  const argv: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        argv.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (quote) {
    throw Object.assign(new Error("Process command has an unterminated quote."), { status: 400 });
  }
  if (current) {
    argv.push(current);
  }
  return argv;
}

export function normalizeProcessArgv(input: { argv?: unknown; command?: unknown }, fallbackCommand?: string) {
  if (Array.isArray(input.argv)) {
    const argv = input.argv.map((part) => String(part ?? "").trim()).filter(Boolean);
    if (argv.length > 0) {
      return argv;
    }
  }

  const command = typeof input.command === "string" && input.command.trim()
    ? input.command
    : fallbackCommand ?? "";
  const argv = parseCommandString(command.trim());
  if (argv.length === 0) {
    throw Object.assign(new Error("Process command is required."), { status: 400 });
  }
  return argv;
}

export function redactCommandPreview(argv: string[]) {
  const secretPattern = /(token|secret|password|passwd|api[_-]?key|authorization|bearer)/i;
  const redacted = argv.map((arg, index) => {
    const previous = argv[index - 1] ?? "";
    if (secretPattern.test(arg) || secretPattern.test(previous)) {
      const [name] = arg.split("=", 1);
      return arg.includes("=") && name ? `${name}=<redacted>` : "<redacted>";
    }
    return /\s/.test(arg) ? JSON.stringify(arg) : arg;
  }).join(" ");
  return redacted.length <= 240 ? redacted : `${redacted.slice(0, 237)}...`;
}

async function setProcessStatus(args: {
  runId: string;
  workerId: string;
  prev: string | null;
  next: ProcessSessionStatus;
  reason?: string;
  exitCode?: number | null;
  signal?: string | null;
  lastError?: string | null;
  killEscalatedAt?: Date | null;
}) {
  const now = new Date();
  const runStatus = args.next === "exited"
    ? "done"
    : args.next === "cancelled"
      ? "cancelled"
      : args.next === "failed" || args.next === "orphaned"
        ? "failed"
        : "running";
  const workerStatus = args.next === "exited"
    ? "completed"
    : args.next === "cancelled"
      ? "cancelled"
      : args.next === "failed" || args.next === "orphaned"
        ? "failed"
        : "working";

  const processUpdate: Partial<typeof processSessions.$inferInsert> = {
    status: args.next,
    exitCode: args.exitCode ?? null,
    signal: args.signal ?? null,
    exitedAt: ["exited", "cancelled", "failed", "orphaned"].includes(args.next) ? now : null,
    lastError: args.lastError ?? null,
    updatedAt: now,
  };
  if (args.killEscalatedAt !== undefined) {
    processUpdate.killEscalatedAt = args.killEscalatedAt;
  }
  await db.update(processSessions).set(processUpdate).where(eq(processSessions.runId, args.runId));
  await db.update(workers).set({
    status: workerStatus,
    updatedAt: now,
  }).where(eq(workers.id, args.workerId));
  await db.update(runs).set({
    status: runStatus,
    failedAt: runStatus === "failed" ? now : null,
    lastError: args.lastError ?? null,
    updatedAt: now,
  }).where(eq(runs.id, args.runId));

  emitNamedEvent({
    kind: "session.status",
    runId: args.runId,
    sessionType: "process",
    prev: args.prev,
    next: args.next,
    reason: args.reason,
  });
  notifyEventStreamSubscribers();
}

export async function spawnProcessSession(args: {
  runId: string;
  workerId: string;
  cwd: string;
  argv: string[];
  envPolicy: ProcessEnvPolicy;
  commandPreview: string;
}) {
  const prev = "starting";
  emitNamedEvent({ kind: "session.starting", runId: args.runId, sessionType: "process" });
  await appendSessionLifecycleEntry({
    runId: args.runId,
    workerId: args.workerId,
    text: `Process starting: ${args.commandPreview}`,
    raw: { eventType: "session.starting", argv: args.argv, cwd: args.cwd },
  });

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(args.argv[0]!, args.argv.slice(1), {
      cwd: args.cwd,
      shell: false,
      env: safeEnv(args.envPolicy) as NodeJS.ProcessEnv,
      windowsHide: true,
    });
  } catch (error) {
    await markProcessSpawnFailed(args.runId, args.workerId, prev, error);
    return;
  }

  const handle: ProcessHandle = {
    runId: args.runId,
    workerId: args.workerId,
    child,
    commandPreview: args.commandPreview,
    stopRequested: false,
    killTimer: null,
  };
  liveProcesses.set(args.runId, handle);

  const startedAt = new Date();
  await db.update(processSessions).set({
    pid: child.pid ?? null,
    status: "running",
    startedAt,
    updatedAt: startedAt,
  }).where(eq(processSessions.runId, args.runId));
  await db.update(workers).set({
    status: "working",
    updatedAt: startedAt,
  }).where(eq(workers.id, args.workerId));
  emitNamedEvent({ kind: "session.status", runId: args.runId, sessionType: "process", prev, next: "running" });
  if (typeof child.pid === "number") {
    emitNamedEvent({
      kind: "process.spawned",
      runId: args.runId,
      workerId: args.workerId,
      pid: child.pid,
      commandPreview: args.commandPreview,
    });
  }
  notifyEventStreamSubscribers();

  child.stdout.on("data", (chunk: Buffer) => {
    void appendProcessOutputEntry({
      runId: args.runId,
      workerId: args.workerId,
      channel: "stdout",
      text: boundedText(chunk.toString("utf8")),
    }).catch((error) => console.error("Failed to append process stdout:", error));
  });
  child.stderr.on("data", (chunk: Buffer) => {
    void appendProcessOutputEntry({
      runId: args.runId,
      workerId: args.workerId,
      channel: "stderr",
      text: boundedText(chunk.toString("utf8")),
    }).catch((error) => console.error("Failed to append process stderr:", error));
  });
  child.on("error", (error) => {
    void markProcessSpawnFailed(args.runId, args.workerId, "running", error);
  });
  child.on("exit", (exitCode, signal) => {
    void finalizeProcessExit(handle, exitCode, signal);
  });
}

async function markProcessSpawnFailed(runId: string, workerId: string, prev: string | null, error: unknown) {
  const cause = error instanceof Error ? error : new Error(String(error));
  await appendSessionLifecycleEntry({
    runId,
    workerId,
    text: `Process failed to start: ${cause.message}`,
    raw: { eventType: "process.spawn.failed" },
  });
  await setProcessStatus({
    runId,
    workerId,
    prev,
    next: "failed",
    reason: "spawn_failed",
    lastError: cause.message,
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "process.spawn.failed",
    message: `Process failed to start: ${cause.message}`,
    surface: "toast",
    runId,
    workerId,
    cause: { name: cause.name, message: cause.message },
  });
}

async function finalizeProcessExit(handle: ProcessHandle, exitCode: number | null, signal: NodeJS.Signals | null) {
  if (handle.killTimer) {
    clearTimeout(handle.killTimer);
  }
  liveProcesses.delete(handle.runId);
  const terminalStatus: ProcessSessionStatus = handle.stopRequested
    ? "cancelled"
    : exitCode === 0
      ? "exited"
      : "failed";
  const reason = handle.stopRequested ? "stopped" : exitCode === 0 ? "exited" : "non_zero_exit";
  await appendSessionLifecycleEntry({
    runId: handle.runId,
    workerId: handle.workerId,
    text: signal
      ? `Process exited with signal ${signal}.`
      : `Process exited with code ${exitCode ?? "unknown"}.`,
    raw: { eventType: "process.exited", exitCode, signal },
  });
  await setProcessStatus({
    runId: handle.runId,
    workerId: handle.workerId,
    prev: "running",
    next: terminalStatus,
    reason,
    exitCode,
    signal,
    lastError: terminalStatus === "failed" ? `Process exited with code ${exitCode ?? "unknown"}.` : null,
  });
  emitNamedEvent({
    kind: "process.exited",
    runId: handle.runId,
    workerId: handle.workerId,
    exitCode,
    signal,
  });
}

export async function writeProcessStdin(args: { runId: string; inputId: string; text: string }) {
  const handle = liveProcesses.get(args.runId);
  const row = await db.select().from(processSessions).where(eq(processSessions.runId, args.runId)).get();
  if (!row || !handle || row.status !== "running" || !handle.child.stdin.writable) {
    const workerId = row?.workerId ?? handle?.workerId;
    emitNamedEvent({
      kind: "session.input.refused",
      runId: args.runId,
      sessionType: "process",
      code: "process.stdin.closed",
      reason: "Process stdin is not writable.",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "process.stdin.closed",
      message: "The process is not accepting input.",
      surface: "toast",
      runId: args.runId,
      workerId,
    });
    throw Object.assign(new Error("The process is not accepting input."), { status: 409 });
  }

  emitNamedEvent({ kind: "session.input.accepted", runId: args.runId, targetActorId: handle.workerId, inputId: args.inputId });
  await new Promise<void>((resolve, reject) => {
    handle.child.stdin.write(args.text.endsWith("\n") ? args.text : `${args.text}\n`, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await appendSessionInputEntry({
    id: args.inputId,
    runId: args.runId,
    workerId: handle.workerId,
    text: args.text,
    deliveredAt: new Date(),
    channel: "stdin",
  });
  emitNamedEvent({ kind: "session.input.delivered", runId: args.runId, targetActorId: handle.workerId, inputId: args.inputId });
  notifyEventStreamSubscribers();
}

export async function stopProcessSession(args: { runId: string; reason?: string }) {
  const row = await db.select().from(processSessions).where(eq(processSessions.runId, args.runId)).get();
  if (!row) {
    throw Object.assign(new Error("Process session not found."), { status: 404 });
  }
  const handle = liveProcesses.get(args.runId);
  if (!handle || row.status !== "running") {
    return { alreadyStopped: true, status: row.status };
  }

  handle.stopRequested = true;
  emitNamedEvent({ kind: "session.stopped", runId: args.runId, sessionType: "process", reason: args.reason ?? "user" });
  await appendSessionLifecycleEntry({
    runId: args.runId,
    workerId: handle.workerId,
    text: "Process stop requested.",
    raw: { eventType: "session.stopped", reason: args.reason ?? "user" },
  });
  handle.child.kill("SIGTERM");
  handle.killTimer = setTimeout(() => {
    if (liveProcesses.has(args.runId)) {
      void db.update(processSessions).set({
        killEscalatedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(processSessions.runId, args.runId));
      handle.child.kill("SIGKILL");
    }
  }, STOP_ESCALATION_MS);
  return { alreadyStopped: false, status: row.status };
}

export async function stopLiveProcessForDelete(runId: string) {
  const handle = liveProcesses.get(runId);
  if (!handle) {
    return;
  }
  handle.stopRequested = true;
  if (handle.killTimer) {
    clearTimeout(handle.killTimer);
  }
  handle.child.kill("SIGTERM");
  liveProcesses.delete(runId);
}

export async function reconcileOrphanedProcessSessions() {
  if (reconcileStarted) {
    return;
  }
  reconcileStarted = true;
  const rows = await db.select().from(processSessions).where(inArray(processSessions.status, ["starting", "running"]));
  for (const row of rows) {
    if (liveProcesses.has(row.runId)) {
      continue;
    }
    await appendSessionLifecycleEntry({
      runId: row.runId,
      workerId: row.workerId,
      text: "Process session was orphaned after server restart.",
      raw: { eventType: "process.orphaned_after_restart" },
    });
    await setProcessStatus({
      runId: row.runId,
      workerId: row.workerId,
      prev: row.status,
      next: "orphaned",
      reason: "server_restart",
      lastError: "Process session was orphaned after server restart.",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "process.orphaned_after_restart",
      message: "A running process session was orphaned after the server restarted.",
      surface: "banner",
      runId: row.runId,
      workerId: row.workerId,
    });
  }
}
