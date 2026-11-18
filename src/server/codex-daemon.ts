import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * The Codex CLI hands every session's shell commands to a long-lived
 * `codex app-server --managed-daemon` process. That daemon can outlive the
 * macOS session context it started in, after which its children can no
 * longer resolve DNS or look up the local user ("No user exists for uid 501"),
 * so git and anything networked fail inside every Codex session. It also keeps
 * running whatever Codex version it started with.
 *
 * Restarting OmniHarness from the UI therefore also stops that daemon and its
 * pid-update loop (which would otherwise respawn it from the same broken
 * context). The next `codex` launch auto-starts a fresh one.
 */

export type CodexDaemonProcess = { pid: number; ppid: number; command: string };

export type CodexDaemonSystem = {
  readPidFile: (file: string) => number | null;
  listProcesses: () => Promise<CodexDaemonProcess[]>;
  signal: (pid: number, signal: NodeJS.Signals) => void;
  sleep: (ms: number) => Promise<void>;
};

export type CodexDaemonRestartResult =
  | { status: "not_running" }
  | { status: "busy"; daemonPid: number; activeChildren: number[] }
  | { status: "stopped"; pids: number[]; forced: number[] };

// The daemon keeps this helper as a permanent child; it is not user work.
const IDLE_CHILD_PATTERN = /codex-code-mode-host/;

export function codexDaemonDir(env: Record<string, string | undefined> = process.env) {
  const codexHome = env.CODEX_HOME?.trim() || path.join(env.HOME || os.homedir(), ".codex");
  return path.join(codexHome, "app-server-daemon");
}

function isCodexDaemonCommand(command: string) {
  return /\bcodex\b/.test(command) && /\bapp-server\b/.test(command);
}

export function createNodeCodexDaemonSystem(): CodexDaemonSystem {
  return {
    readPidFile: (file) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { pid?: unknown };
        return typeof parsed.pid === "number" && Number.isInteger(parsed.pid) && parsed.pid > 0 ? parsed.pid : null;
      } catch {
        return null;
      }
    },
    listProcesses: async () => {
      const { stdout } = await execFileAsync("ps", ["-axo", "pid=,ppid=,command="], {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      return stdout.split(/\r?\n/g).flatMap((line) => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }] : [];
      });
    },
    signal: (pid, signal) => {
      try {
        process.kill(pid, signal);
      } catch {
        // Already gone.
      }
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

export async function restartCodexDaemon({
  env = process.env,
  system = createNodeCodexDaemonSystem(),
  exitTimeoutMs = 5_000,
}: {
  env?: Record<string, string | undefined>;
  system?: CodexDaemonSystem;
  exitTimeoutMs?: number;
} = {}): Promise<CodexDaemonRestartResult> {
  const dir = codexDaemonDir(env);
  const processes = await system.listProcesses();
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  // Pid files can name a recycled pid; only act on processes that are still
  // actually the Codex daemon.
  const verified = (pid: number | null) => (pid !== null && byPid.has(pid) && isCodexDaemonCommand(byPid.get(pid)!.command) ? pid : null);
  const daemonPid = verified(system.readPidFile(path.join(dir, "daemon.pid")));
  const updaterPid = verified(system.readPidFile(path.join(dir, "daemon-updater.pid")));

  if (daemonPid === null && updaterPid === null) {
    return { status: "not_running" };
  }

  if (daemonPid !== null) {
    const activeChildren = processes
      .filter((entry) => entry.ppid === daemonPid && !IDLE_CHILD_PATTERN.test(entry.command))
      .map((entry) => entry.pid);
    if (activeChildren.length > 0) {
      return { status: "busy", daemonPid, activeChildren };
    }
  }

  // Updater first, so it cannot respawn the daemon we are about to stop.
  const targets = [updaterPid, daemonPid].filter((pid): pid is number => pid !== null);
  for (const pid of targets) {
    system.signal(pid, "SIGTERM");
  }

  const deadline = Date.now() + exitTimeoutMs;
  let remaining = targets;
  while (remaining.length > 0 && Date.now() < deadline) {
    await system.sleep(100);
    const alive = new Set((await system.listProcesses()).map((entry) => entry.pid));
    remaining = remaining.filter((pid) => alive.has(pid));
  }
  for (const pid of remaining) {
    system.signal(pid, "SIGKILL");
  }

  return { status: "stopped", pids: targets, forced: remaining };
}

export function describeCodexDaemonRestart(result: CodexDaemonRestartResult) {
  switch (result.status) {
    case "not_running":
      return "codex daemon: not running";
    case "busy":
      return `codex daemon: left running (pid ${result.daemonPid} has active commands: ${result.activeChildren.join(", ")})`;
    case "stopped":
      return `codex daemon: stopped pids ${result.pids.join(", ")}${result.forced.length > 0 ? ` (force-killed ${result.forced.join(", ")})` : ""}`;
  }
}
