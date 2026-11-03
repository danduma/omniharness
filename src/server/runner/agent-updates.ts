import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import lockfile from "proper-lockfile";
import { emitNamedEvent, type NamedEvent } from "@/server/events/named-events";

// Maintenance policy: check after listening, then every six hours. Never let
// one registry/install attempt occupy the updater for more than ten minutes.
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_TIMEOUT_MS = 10 * 60 * 1000;
type Command = { command: string; args: string[] };

export function buildAgentUpdateCommand(root: string, platform = process.platform): Command {
  const paths = platform === "win32" ? path.win32 : path;
  return platform === "win32"
    ? { command: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", paths.join(root, "scripts", "install-agent-acp.ps1"), "-EnsureOnly"] }
    : { command: "/bin/bash", args: [paths.join(root, "scripts", "install-agent-acp.sh"), "--ensure-only"] };
}

export class AgentUpdatesManager {
  private readonly stateRoot: string;
  private readonly logPath: string;
  private readonly command: Command;
  private interval: ReturnType<typeof setInterval> | null = null;
  private initial: ReturnType<typeof setImmediate> | null = null;
  private active: Promise<void> | null = null;
  private child: ChildProcess | null = null;
  private stopped = false;
  private started = false;
  private cancelReason: "shutdown" | "timeout" | null = null;

  constructor(private readonly options: {
    repositoryRoot: string;
    stateRoot?: string;
    command?: Command;
    timeoutMs?: number;
    intervalMs?: number;
  }) {
    // All runners for this OS user share installed adapters and this lock.
    this.stateRoot = options.stateRoot ?? path.join(os.homedir(), ".omniharness", "agent-updates");
    this.logPath = path.join(this.stateRoot, "agent-updates.log");
    this.command = options.command ?? buildAgentUpdateCommand(options.repositoryRoot);
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.initial = setImmediate(() => { this.initial = null; this.check(); });
    this.interval = setInterval(() => this.check(), this.options.intervalMs ?? UPDATE_INTERVAL_MS);
    this.interval.unref();
  }

  private check(): void {
    if (this.stopped || this.active) return;
    this.active = this.update().catch(error => this.fail(error)).finally(() => { this.active = null; });
  }

  private event(event: NamedEvent): void { emitNamedEvent(event); }

  private fail(error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.event({ kind: "agent.update_failed", path: this.logPath, reason });
    this.event({ kind: "error.surfaced", code: "agent.update_failed", surface: "log", path: this.logPath, message: reason });
  }

  private killChild(): void {
    const pid = this.child?.pid;
    if (!pid) return;
    // The detached process group belongs exclusively to this installer; never
    // signal the runner, bridge, or agent worker process groups.
    if (process.platform === "win32") {
      execFile("taskkill", ["/pid", String(pid), "/T", "/F"], error => {
        if (error && this.child) this.fail(error);
      });
    } else {
      try { process.kill(-pid, "SIGKILL"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") this.fail(error);
      }
    }
  }

  private async update(): Promise<void> {
    fs.mkdirSync(this.stateRoot, { recursive: true });
    let release: (() => Promise<void>) | null = null;
    try {
      release = await lockfile.lock(this.stateRoot, {
        realpath: false,
        lockfilePath: path.join(this.stateRoot, "agent-updates.lock"),
        retries: 0,
        onCompromised: error => { this.fail(error); this.killChild(); },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ELOCKED") throw error;
      this.event({ kind: "agent.update_skipped", path: this.logPath, reason: "another_updater_running" });
      return;
    }
    try {
      if (this.stopped) {
        this.event({ kind: "agent.update_cancelled", path: this.logPath, reason: "shutdown" });
        return;
      }
      this.cancelReason = null;
      const log = fs.openSync(this.logPath, "a", 0o600);
      try {
        fs.writeSync(log, `\n[${new Date().toISOString()}] Checking agent updates\n`);
        this.child = spawn(this.command.command, this.command.args, {
          cwd: this.options.repositoryRoot,
          env: { ...process.env, OMNIHARNESS_AGENT_UPDATE_STRICT: "1" },
          stdio: ["ignore", log, log], detached: process.platform !== "win32", windowsHide: true,
        });
      } finally { fs.closeSync(log); }
      const child = this.child;
      const timeout = setTimeout(() => {
        this.cancelReason = "timeout";
        this.killChild();
      }, this.options.timeoutMs ?? UPDATE_TIMEOUT_MS);
      try {
        await new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (code, signal) => {
            if (this.cancelReason === "shutdown") {
              this.event({ kind: "agent.update_cancelled", path: this.logPath, reason: "shutdown" });
              resolve();
            } else if (this.cancelReason === "timeout") {
              reject(new Error("Agent update timed out; OH remains running"));
            } else if (code !== 0) {
              reject(new Error(`Agent update exited with ${signal ?? code}; see ${this.logPath}`));
            } else {
              this.event({ kind: "agent.update_completed", path: this.logPath });
              resolve();
            }
          });
          child.once("spawn", () => this.event({ kind: "agent.update_started", path: this.logPath, pid: child.pid! }));
        });
      } finally {
        clearTimeout(timeout);
        this.child = null;
      }
    } finally { await release(); }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.initial) clearImmediate(this.initial);
    if (this.interval) clearInterval(this.interval);
    this.initial = null;
    this.interval = null;
    this.cancelReason = "shutdown";
    this.killChild();
    await this.active;
  }
}
