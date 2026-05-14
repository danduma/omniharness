import crypto from "crypto";
import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { verify } from "@node-rs/argon2";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export const restartSessionCookieName = "omniharness_restart";

export type RestartMode = "dev" | "prod";

export type RestartPidEntry = {
  pid: number;
  startedAt: number;
  command: string[];
  mode: RestartMode;
};

export type RestartControlConfig = {
  host: string;
  port: number;
  token: string | null;
  managedPorts: number[];
  pidFile: string;
  logFile: string;
  cwd: string;
  commands: Record<RestartMode, { command: string; args: string[] }>;
  command: string;
  args: string[];
};

export type RestartSystem = {
  appendLog: (message: string) => void | Promise<void>;
  ensureDir: (dir: string) => void | Promise<void>;
  findListenerPids: (ports: number[]) => Promise<number[]>;
  isProcessAlive: (pid: number) => Promise<boolean>;
  readPidFile: () => Promise<RestartPidEntry | null>;
  readRecentLog: () => Promise<string>;
  removePidFile: () => void | Promise<void>;
  signalProcess: (pid: number, signal: NodeJS.Signals) => void | Promise<void>;
  spawnDetached: (command: string, args: string[], options?: { cwd: string; logFile: string; env: NodeJS.ProcessEnv }) => Promise<number>;
  waitForExit: (pids: number[], timeoutMs?: number) => Promise<void>;
  writePidFile: (entry: RestartPidEntry) => void | Promise<void>;
};

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseManagedPorts(value: string | undefined) {
  const ports = (value || "3035,3050,7800")
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((port) => Number.isFinite(port) && port > 0);
  return Array.from(new Set(ports));
}

function parseCommand(value: string | undefined, fallback: { command: string; args: string[] }) {
  const parts = value?.trim().split(/\s+/g).filter(Boolean) ?? [];
  if (parts.length === 0) {
    return fallback;
  }
  return { command: parts[0] ?? fallback.command, args: parts.slice(1) };
}

export function resolveRestartControlConfig(repoRoot: string, env: Record<string, string | undefined>): RestartControlConfig {
  const commands = {
    dev: parseCommand(
      env.OMNIHARNESS_REMOTE_RESTART_DEV_COMMAND ?? env.OMNIHARNESS_REMOTE_RESTART_COMMAND,
      { command: "pnpm", args: ["run", "dev"] },
    ),
    prod: parseCommand(env.OMNIHARNESS_REMOTE_RESTART_PROD_COMMAND, { command: "./omniharness", args: [] }),
  };

  return {
    host: env.OMNIHARNESS_REMOTE_RESTART_HOST || "0.0.0.0",
    port: parsePort(env.OMNIHARNESS_REMOTE_RESTART_PORT, 3099),
    token: env.OMNIHARNESS_REMOTE_RESTART_TOKEN?.trim() || null,
    managedPorts: parseManagedPorts(env.OMNIHARNESS_REMOTE_RESTART_PORTS),
    pidFile: path.join(repoRoot, ".omniharness", "remote-restart.pid.json"),
    logFile: path.join(repoRoot, ".omniharness", "remote-restart.log"),
    cwd: repoRoot,
    commands,
    command: commands.dev.command,
    args: commands.dev.args,
  };
}

function timingSafeStringEqual(left: string, right: string) {
  if (!left || !right) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function passwordsMatch(expected: string, provided: string) {
  return timingSafeStringEqual(expected, provided);
}

export async function verifyRestartControlPassword(
  env: Record<string, string | undefined>,
  fallbackPassword: string,
  providedPassword: string,
) {
  const configuredHash = env.OMNIHARNESS_AUTH_PASSWORD_HASH?.trim();
  if (configuredHash) {
    return verify(configuredHash, providedPassword, ARGON_OPTIONS);
  }

  const configuredPassword = env.OMNIHARNESS_AUTH_PASSWORD?.trim();
  if (configuredPassword) {
    return passwordsMatch(configuredPassword, providedPassword);
  }

  const restartPassword = env.OMNIHARNESS_REMOTE_RESTART_PASSWORD?.trim() || fallbackPassword;
  return passwordsMatch(restartPassword, providedPassword);
}

export function authorizeRestartRequest(headers: Record<string, string | string[] | undefined>, token: string) {
  const authorization = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const explicitToken = headers["x-omniharness-restart-token"];
  const headerToken = Array.isArray(explicitToken) ? explicitToken[0] : explicitToken;
  return passwordsMatch(token, bearerToken) || passwordsMatch(token, headerToken ?? "");
}

export function createSessionCookie(secret: string, now = Date.now()) {
  const payload = String(now);
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function authorizeSessionCookie(cookieHeader: string | undefined, secret: string, now = Date.now()) {
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${restartSessionCookieName}=`))
    ?.slice(restartSessionCookieName.length + 1);
  if (!cookie) {
    return false;
  }

  const [issuedAtValue, signature] = cookie.split(".");
  const issuedAt = Number.parseInt(issuedAtValue, 10);
  if (!Number.isFinite(issuedAt) || now - issuedAt > 24 * 60 * 60 * 1000) {
    return false;
  }

  return passwordsMatch(createSessionCookie(secret, issuedAt), cookie) && Boolean(signature);
}

export function createRestartController({ config, system }: {
  config: RestartControlConfig;
  system: RestartSystem;
}) {
  const stopCurrent = async () => {
    const pidEntry = await system.readPidFile();
    if (pidEntry && await system.isProcessAlive(pidEntry.pid)) {
      await system.signalProcess(-pidEntry.pid, "SIGTERM");
      await system.waitForExit([pidEntry.pid]);
    }
    if (pidEntry) {
      await system.removePidFile();
    }

    const listenerPids = await system.findListenerPids(config.managedPorts);
    if (listenerPids.length > 0) {
      await Promise.all(listenerPids.map((pid) => system.signalProcess(pid, "SIGTERM")));
      await system.waitForExit(listenerPids);
    }
  };

  const start = async (mode: RestartMode = "dev", reason = "manual") => {
    const selected = config.commands[mode];
    await system.ensureDir(path.dirname(config.pidFile));
    const pid = await system.spawnDetached(selected.command, selected.args, {
      cwd: config.cwd,
      logFile: config.logFile,
      env: process.env,
    });
    const entry: RestartPidEntry = {
      pid,
      startedAt: Date.now(),
      command: [selected.command, ...selected.args],
      mode,
    };
    await system.writePidFile(entry);
    await system.appendLog(`${mode} start completed: spawned pid ${pid} (${reason})`);
    return entry;
  };

  return {
    async stop(reason = "manual") {
      await system.appendLog(`stop requested: ${reason}`);
      await stopCurrent();
      await system.appendLog("stop completed");
    },
    async restart(reason = "manual", mode: RestartMode = "dev") {
      await system.appendLog(`${mode} restart requested: ${reason}`);
      await stopCurrent();
      const entry = await start(mode, reason);
      await system.appendLog(`${mode} restart completed: spawned pid ${entry.pid}`);
      return entry;
    },
    async restartCurrent(reason = "manual") {
      const pidEntry = await system.readPidFile();
      return this.restart(reason, pidEntry?.mode ?? "dev");
    },
    start,
    async getStatus() {
      const pidEntry = await system.readPidFile();
      const listenerPids = await system.findListenerPids(config.managedPorts);
      const recentLog = await system.readRecentLog();
      const pidRunning = Boolean(pidEntry && await system.isProcessAlive(pidEntry.pid));
      return {
        running: pidRunning || listenerPids.length > 0,
        pid: pidEntry?.pid ?? null,
        mode: pidEntry?.mode ?? null,
        command: pidEntry?.command ?? [],
        startedAt: pidEntry?.startedAt ?? null,
        listenerPids,
        managedPorts: config.managedPorts,
        recentLog,
      };
    },
  };
}

export function createNodeRestartSystem(config: RestartControlConfig): RestartSystem {
  return {
    appendLog: (message) => {
      fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
      fs.appendFileSync(config.logFile, `[${new Date().toISOString()}] ${message}\n`);
    },
    ensureDir: (dir) => {
      fs.mkdirSync(dir, { recursive: true });
    },
    findListenerPids: async (ports) => {
      const pids = new Set<number>();
      for (const port of ports) {
        try {
          const { stdout } = await execFileAsync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
            encoding: "utf8",
            timeout: 2_000,
          });
          stdout
            .split(/\r?\n/g)
            .map((line) => Number.parseInt(line.trim(), 10))
            .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
            .forEach((pid) => pids.add(pid));
        } catch {
          // lsof exits non-zero when no process is listening.
        }
      }
      return [...pids];
    },
    isProcessAlive: async (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    },
    readPidFile: async () => {
      try {
        return JSON.parse(fs.readFileSync(config.pidFile, "utf8")) as RestartPidEntry;
      } catch {
        return null;
      }
    },
    readRecentLog: async () => {
      try {
        return fs.readFileSync(config.logFile, "utf8").split("\n").slice(-40).join("\n").trim();
      } catch {
        return "";
      }
    },
    removePidFile: async () => {
      fs.rmSync(config.pidFile, { force: true });
    },
    signalProcess: async (pid, signal) => {
      try {
        process.kill(pid, signal);
      } catch {
        // Process may have already exited between discovery and signal.
      }
    },
    spawnDetached: async (command, args, options) => {
      const logFile = options?.logFile ?? config.logFile;
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      const logFd = fs.openSync(logFile, "a");
      const child = spawn(command, args, {
        cwd: options?.cwd ?? config.cwd,
        detached: true,
        env: options?.env ?? process.env,
        stdio: ["ignore", logFd, logFd],
      });
      child.unref();
      if (!child.pid) {
        throw new Error("Failed to spawn restart process.");
      }
      return child.pid;
    },
    waitForExit: async (pids, timeoutMs = 8_000) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const alive = await Promise.all(pids.map(async (pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        }));
        if (alive.every((value) => !value)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Process may already be gone.
        }
      }
    },
    writePidFile: async (entry) => {
      fs.writeFileSync(config.pidFile, JSON.stringify(entry, null, 2));
    },
  };
}
