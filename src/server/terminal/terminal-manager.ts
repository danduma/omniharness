import { spawn, type IPty } from "node-pty";
import os from "node:os";
import { chmodSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * In-process registry of interactive PTY sessions backing the UI terminal.
 *
 * Each session owns a real pty (via node-pty), a bounded ring buffer of recent
 * output so a reconnecting SSE client can resume mid-stream, and a set of
 * subscribers (the SSE writers). Sessions are reaped when no client has been
 * attached for a grace period (survives a page reload) or after a long idle.
 *
 * Transport is SSE (output) + POST (input/resize) — see
 * src/runtime/http/routes/terminals.ts. There is no websocket server in this
 * runtime, so the manager never assumes a duplex socket.
 */

export interface TerminalChunk {
  seq: number;
  data: string;
}

export interface TerminalExit {
  exitCode: number;
  signal?: number;
}

export interface CreatedTerminal {
  id: string;
  cols: number;
  rows: number;
}

export type TerminalAuthorization = {
  sessionId: string;
  runnerInstanceId?: string | null;
  scope?: "shell" | "account_auth";
  accountId?: string;
  operationId?: string;
};

type TerminalOwnership = {
  sessionId: string | null;
  runnerInstanceId: string | null;
  scope: "shell" | "account_auth";
  accountId: string | null;
  operationId: string | null;
};

type Subscriber = {
  onChunk: (chunk: TerminalChunk) => void;
  onExit: (exit: TerminalExit) => void;
};

interface TerminalSession {
  id: string;
  pty: IPty;
  cwd: string;
  cols: number;
  rows: number;
  /** Monotonic seq of the most recent chunk appended to the buffer. */
  lastSeq: number;
  /** Recent output, capped at MAX_BUFFER_BYTES total. */
  buffer: TerminalChunk[];
  bufferBytes: number;
  subscribers: Set<Subscriber>;
  lastActivityAt: number;
  /** When the last subscriber detached (null while at least one is attached). */
  detachedAt: number | null;
  exited: TerminalExit | null;
  ownership: TerminalOwnership;
  lifecycleOwners: number;
  onExit: ((exit: TerminalExit) => void) | null;
}

const MAX_BUFFER_BYTES = 256 * 1024;
/** Keep a detached session alive long enough to survive a reload/reconnect. */
const SUBSCRIBER_GRACE_MS = 30_000;
/** Hard ceiling on an idle session regardless of attachment. */
const IDLE_TIMEOUT_MS = 30 * 60_000;
const REAP_INTERVAL_MS = 10_000;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

function defaultShell(): string {
  if (process.platform === "win32") {
    return process.env.COMTERMINAL || "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

class TerminalManager {
  private readonly sessions = new Map<string, TerminalSession>();
  private reaper: ReturnType<typeof setInterval> | null = null;
  createTerminal(options: { cwd: string; cols?: number; rows?: number; ownerSessionId?: string | null }): CreatedTerminal {
    ensureSpawnHelperExecutable();
    const cols = clampDimension(options.cols, DEFAULT_COLS);
    const rows = clampDimension(options.rows, DEFAULT_ROWS);
    const shell = defaultShell();
    const pty = spawn(shell, [], {
      name: "xterm-color",
      cols,
      rows,
      cwd: options.cwd,
      env: sanitizedEnv(),
    });

    return this.registerPty(pty, {
      cwd: options.cwd,
      cols,
      rows,
      ownership: {
        sessionId: options.ownerSessionId ?? null,
        runnerInstanceId: null,
        scope: "shell",
        accountId: null,
        operationId: null,
      },
      onExit: null,
    });
  }

  createManagedTerminal(options: {
    command: string;
    args: string[];
    env: Record<string, string>;
    cwd: string;
    cols?: number;
    rows?: number;
    ownerSessionId: string;
    runnerInstanceId: string;
    accountId: string;
    operationId: string;
    onExit?: (exit: TerminalExit) => void;
  }): CreatedTerminal {
    ensureSpawnHelperExecutable();
    const cols = clampDimension(options.cols, DEFAULT_COLS);
    const rows = clampDimension(options.rows, DEFAULT_ROWS);
    const pty = spawn(options.command, [...options.args], {
      name: "xterm-color",
      cols,
      rows,
      cwd: options.cwd,
      env: { ...options.env },
    });
    return this.registerPty(pty, {
      cwd: options.cwd,
      cols,
      rows,
      ownership: {
        sessionId: options.ownerSessionId,
        runnerInstanceId: options.runnerInstanceId,
        scope: "account_auth",
        accountId: options.accountId,
        operationId: options.operationId,
      },
      onExit: options.onExit ?? null,
    });
  }

  private registerPty(pty: IPty, options: {
    cwd: string;
    cols: number;
    rows: number;
    ownership: TerminalOwnership;
    onExit: ((exit: TerminalExit) => void) | null;
  }): CreatedTerminal {
    const id = `term-${randomUUID()}`;
    const session: TerminalSession = {
      id,
      pty,
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
      lastSeq: 0,
      buffer: [],
      bufferBytes: 0,
      subscribers: new Set(),
      lastActivityAt: Date.now(),
      detachedAt: Date.now(),
      exited: null,
      ownership: options.ownership,
      lifecycleOwners: options.ownership.scope === "account_auth" ? 1 : 0,
      onExit: options.onExit,
    };
    this.sessions.set(id, session);

    pty.onData((data) => this.handleData(session, data));
    pty.onExit(({ exitCode, signal }) => this.handleExit(session, { exitCode, signal }));

    this.ensureReaper();
    return { id, cols: options.cols, rows: options.rows };
  }

  authorize(id: string, expected: TerminalAuthorization): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    const actual = session.ownership;
    if (actual.sessionId && actual.sessionId !== expected.sessionId) return false;
    if (expected.scope && actual.scope !== expected.scope) return false;
    if (expected.runnerInstanceId && actual.runnerInstanceId !== expected.runnerInstanceId) return false;
    if (expected.accountId && actual.accountId !== expected.accountId) return false;
    if (expected.operationId && actual.operationId !== expected.operationId) return false;
    return true;
  }

  releaseLifecycleOwner(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.lifecycleOwners = Math.max(0, session.lifecycleOwners - 1);
    return true;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  replayState(id: string, fromSeq: number) {
    const session = this.sessions.get(id);
    if (!session) return null;
    const oldestSeq = session.buffer[0]?.seq ?? session.lastSeq + 1;
    return {
      oldestSeq,
      lastSeq: session.lastSeq,
      resyncRequired: fromSeq > 0 && fromSeq < oldestSeq - 1,
    };
  }

  write(id: string, data: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.exited) {
      return false;
    }
    session.lastActivityAt = Date.now();
    session.pty.write(data);
    return true;
  }

  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id);
    if (!session || session.exited) {
      return false;
    }
    const nextCols = clampDimension(cols, session.cols);
    const nextRows = clampDimension(rows, session.rows);
    session.cols = nextCols;
    session.rows = nextRows;
    session.lastActivityAt = Date.now();
    try {
      session.pty.resize(nextCols, nextRows);
    } catch {
      // pty may have exited between the guard and here.
      return false;
    }
    return true;
  }

  /**
   * Attach a subscriber. Replays buffered chunks with seq > `fromSeq`, then
   * streams live output. Returns an unsubscribe function, or null if the
   * session does not exist.
   */
  subscribe(id: string, fromSeq: number, subscriber: Subscriber): (() => void) | null {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    session.detachedAt = null;
    session.subscribers.add(subscriber);

    for (const chunk of session.buffer) {
      if (chunk.seq > fromSeq) {
        subscriber.onChunk(chunk);
      }
    }
    if (session.exited) {
      subscriber.onExit(session.exited);
    }

    return () => {
      session.subscribers.delete(subscriber);
      if (session.subscribers.size === 0) {
        session.detachedAt = Date.now();
      }
    };
  }

  kill(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }
    this.disposeSession(session);
    return true;
  }

  killAll(): void {
    for (const session of this.sessions.values()) {
      try {
        session.pty.kill();
      } catch {
        // ignore
      }
    }
    this.sessions.clear();
    if (this.reaper) {
      clearInterval(this.reaper);
      this.reaper = null;
    }
  }

  private handleData(session: TerminalSession, data: string): void {
    session.lastSeq += 1;
    const chunk: TerminalChunk = { seq: session.lastSeq, data };
    session.buffer.push(chunk);
    session.bufferBytes += Buffer.byteLength(data, "utf8");
    while (session.bufferBytes > MAX_BUFFER_BYTES && session.buffer.length > 1) {
      const dropped = session.buffer.shift();
      if (dropped) {
        session.bufferBytes -= Buffer.byteLength(dropped.data, "utf8");
      }
    }
    session.lastActivityAt = Date.now();
    for (const subscriber of session.subscribers) {
      subscriber.onChunk(chunk);
    }
  }

  private handleExit(session: TerminalSession, exit: TerminalExit): void {
    if (session.exited) return;
    session.exited = exit;
    for (const subscriber of session.subscribers) {
      subscriber.onExit(exit);
    }
    // Leave the session briefly so attached clients can render the exit, then
    // let the reaper remove it.
    session.detachedAt = session.detachedAt ?? Date.now();
    session.onExit?.(exit);
  }

  private disposeSession(session: TerminalSession): void {
    try {
      session.pty.kill();
    } catch {
      // already gone
    }
    session.subscribers.clear();
    this.sessions.delete(session.id);
    if (this.sessions.size === 0 && this.reaper) {
      clearInterval(this.reaper);
      this.reaper = null;
    }
  }

  private ensureReaper(): void {
    if (this.reaper) {
      return;
    }
    this.reaper = setInterval(() => this.reap(), REAP_INTERVAL_MS);
    // Don't keep the event loop alive solely for the reaper.
    this.reaper.unref?.();
  }

  private reap(): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      const detachedTooLong =
        session.subscribers.size === 0 &&
        session.detachedAt !== null &&
        now - session.detachedAt > SUBSCRIBER_GRACE_MS;
      const idleTooLong = now - session.lastActivityAt > IDLE_TIMEOUT_MS;
      const exitedAndDetached = session.exited !== null && session.subscribers.size === 0;
      if (session.lifecycleOwners === 0 && (detachedTooLong || idleTooLong || exitedAndDetached)) {
        this.disposeSession(session);
      }
    }
  }
}

let spawnHelperChecked = false;

/**
 * node-pty ships a prebuilt `spawn-helper`, but pnpm extracts it without the
 * executable bit, so the first `pty.spawn` fails with "posix_spawnp failed".
 * Repair the permission once before the first spawn. The install-time hook in
 * scripts/check-pnpm.mjs does the same; this is the runtime belt-and-suspenders
 * so the server works regardless of how it was launched.
 */
function ensureSpawnHelperExecutable(): void {
  if (spawnHelperChecked || process.platform === "win32") {
    spawnHelperChecked = true;
    return;
  }
  spawnHelperChecked = true;
  let packageRoot: string;
  try {
    const require = createRequire(__filenameForRequire());
    packageRoot = path.dirname(path.dirname(require.resolve("node-pty")));
  } catch {
    return;
  }
  for (const subdir of ["prebuilds", "build/Release"]) {
    const dir = path.join(packageRoot, subdir);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    const candidates = [path.join(dir, "spawn-helper")];
    for (const entry of entries) {
      candidates.push(path.join(dir, entry, "spawn-helper"));
    }
    for (const helper of candidates) {
      try {
        if (statSync(helper).isFile()) {
          chmodSync(helper, 0o755);
        }
      } catch {
        // absent for this platform/layout; ignore
      }
    }
  }
}

function __filenameForRequire(): string {
  // Works under both CJS (Next server bundle) and ESM (tsx/vitest).
  if (typeof __filename === "string") {
    return __filename;
  }
  return process.cwd() + "/index.js";
}

function clampDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function sanitizedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  // Ensure a sane TERM so curses apps render; HOME for shells launched in CI.
  env.TERM = env.TERM || "xterm-256color";
  env.HOME = env.HOME || os.homedir();
  return env;
}

/**
 * Singleton kept on the process object so it survives Next.js module
 * re-evaluation during dev HMR (mirrors the auth session cache pattern).
 */
const globalWithManager = process as NodeJS.Process & {
  __omniHarnessTerminalManager?: TerminalManager;
};

export function getTerminalManager(): TerminalManager {
  if (!globalWithManager.__omniHarnessTerminalManager) {
    const manager = new TerminalManager();
    globalWithManager.__omniHarnessTerminalManager = manager;
    const shutdown = () => manager.killAll();
    process.once("exit", shutdown);
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }
  return globalWithManager.__omniHarnessTerminalManager;
}

export type { TerminalManager };
