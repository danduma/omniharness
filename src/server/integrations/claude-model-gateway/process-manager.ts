import { spawn as nodeSpawn } from "node:child_process";
import { chmodSync, closeSync, constants, fstatSync, ftruncateSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { URL } from "node:url";
import { dump } from "js-yaml";
import type { ClaudeModelGatewayMode } from "@/lib/claude-model-gateway";
import {
  commandLineMatchesOwnedProcess,
  isProcessAlive,
  readProcessCommand,
  readProcessStartedAt,
  processStartMatchesOwnedProcess,
  type ManagedProcessIdentity,
} from "@/server/process-ownership";
import {
  ensureManagedDirectory,
  assertOwnedJsonFileWritable,
  readOwnedJsonFile,
  resolveClaudeGatewayManagedPaths,
  writeOwnedJsonFile,
  writeOwnedTextFile,
} from "./managed-files";

type SpawnOptions = {
  cwd: string;
  env: Record<string, string | undefined>;
  shell: false;
  detached: boolean;
  logFile: string;
};

const MAX_GATEWAY_LOG_BYTES = 2 * 1024 * 1024;

export function openGatewayLogFile(logFile: string) {
  const descriptor = openSync(logFile, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
  const details = fstatSync(descriptor);
  if (!details.isFile()) {
    closeSync(descriptor);
    throw new Error("Claude model gateway log target is not a regular file.");
  }
  chmodSync(logFile, 0o600);
  if (details.size > MAX_GATEWAY_LOG_BYTES) ftruncateSync(descriptor, 0);
  return descriptor;
}

type ChildSpawnEvents = {
  once(event: "spawn", listener: () => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  removeListener(event: "spawn", listener: () => void): unknown;
  removeListener(event: "error", listener: (error: Error) => void): unknown;
};

export function waitForChildProcessSpawn(child: ChildSpawnEvents) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      child.removeListener("spawn", onSpawn);
      child.removeListener("error", onError);
    };
    const onSpawn = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
}

export type ClaudeGatewayProcessSystem = {
  spawn: (executable: string, args: string[], options: SpawnOptions) => Promise<{ pid: number }>;
  isAlive: (pid: number) => Promise<boolean>;
  readCommand: (pid: number) => Promise<string>;
  readStartedAt: (pid: number) => Promise<number>;
  signal: (pid: number, signal: NodeJS.Signals) => Promise<void>;
  waitForExit: (pid: number, timeoutMs?: number) => Promise<void>;
};

export type ClaudeGatewayProcessRecord = ManagedProcessIdentity & {
  configPath: string;
  baseUrl: string;
};

export type StartClaudeGatewayProcessInput = {
  executable: string;
  executableArgs?: string[];
  baseUrl: string;
  apiToken: string;
  managementToken: string;
};

function defaultSystem(): ClaudeGatewayProcessSystem {
  return {
    spawn: async (executable, args, options) => {
      await mkdir(options.cwd, { recursive: true, mode: 0o700 });
      const descriptor = openGatewayLogFile(options.logFile);
      try {
        const child = nodeSpawn(executable, args, {
          cwd: options.cwd,
          env: options.env as NodeJS.ProcessEnv,
          shell: false,
          detached: options.detached,
          stdio: ["ignore", descriptor, descriptor],
        });
        await waitForChildProcessSpawn(child);
        if (!child.pid) throw new Error("CLIProxyAPI did not return a process id.");
        child.unref();
        return { pid: child.pid };
      } finally {
        closeSync(descriptor);
      }
    },
    isAlive: async (pid) => isProcessAlive(pid),
    readCommand: readProcessCommand,
    readStartedAt: readProcessStartedAt,
    signal: async (pid, signal) => {
      process.kill(pid, signal);
    },
    waitForExit: async (pid, timeoutMs = 5_000) => {
      const deadline = Date.now() + timeoutMs;
      while (isProcessAlive(pid)) {
        if (Date.now() >= deadline) throw new Error(`Managed process ${pid} did not exit before the deadline.`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
  };
}

function processConfig(input: StartClaudeGatewayProcessInput, authDirectory: string) {
  const url = new URL(input.baseUrl);
  const port = Number.parseInt(url.port || (url.protocol === "https:" ? "443" : "80"), 10);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost" && url.hostname !== "::1") {
    throw new Error("Managed CLIProxyAPI must bind to a loopback address.");
  }
  if (!input.apiToken.trim() || !input.managementToken.trim()) throw new Error("Managed CLIProxyAPI tokens are required.");
  return {
    host: "127.0.0.1",
    port,
    tls: { enable: false, cert: "", key: "" },
    "remote-management": {
      "allow-remote": false,
      "secret-key": input.managementToken,
      "disable-control-panel": true,
    },
    "auth-dir": authDirectory,
    "api-keys": [input.apiToken],
    debug: false,
    "logging-to-file": false,
  };
}

export function createClaudeModelGatewayProcessManager(options: {
  homeDir: string;
  mode?: ClaudeModelGatewayMode;
  system?: ClaudeGatewayProcessSystem;
  checkReady: (input: { baseUrl: string; apiToken: string; managementToken: string }) => Promise<void>;
  parentEnv?: Record<string, string | undefined>;
}) {
  const paths = resolveClaudeGatewayManagedPaths(options.homeDir);
  const system = options.system ?? defaultSystem();
  const mode = options.mode ?? "managed";
  const parentEnv = options.parentEnv ?? process.env;
  let startInFlight: Promise<ClaudeGatewayProcessRecord> | null = null;

  const waitUntilReady = async (input: StartClaudeGatewayProcessInput) => {
    const deadline = Date.now() + 10_000;
    let lastError: unknown = null;
    while (Date.now() < deadline) {
      try {
        await options.checkReady(input);
        return;
      } catch (error) {
        lastError = error;
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }
    throw lastError ?? new Error("CLIProxyAPI did not become ready before the deadline.");
  };

  const readRecord = () => readOwnedJsonFile<ClaudeGatewayProcessRecord>(paths.process, "gateway-process");
  const recordIsOwned = async (record: ClaudeGatewayProcessRecord) => {
    if (!await system.isAlive(record.pid)) return false;
    try {
      const [command, startedAt] = await Promise.all([
        system.readCommand(record.pid),
        system.readStartedAt(record.pid),
      ]);
      return commandLineMatchesOwnedProcess(command, record)
        && processStartMatchesOwnedProcess(startedAt, record);
    } catch {
      return false;
    }
  };

  const start = async (input: StartClaudeGatewayProcessInput) => {
    if (mode === "external") throw new Error("External gateway mode does not own a process.");
    const existing = await readRecord();
    if (existing && await recordIsOwned(existing)) {
      await waitUntilReady(input);
      return existing;
    }
    if (existing && await system.isAlive(existing.pid)) {
      throw new Error("Managed gateway process ownership could not be verified; refusing to adopt or replace it.");
    }
    await ensureManagedDirectory(paths.root);
    await ensureManagedDirectory(paths.auth);
    await ensureManagedDirectory(paths.logs);
    await assertOwnedJsonFileWritable(paths.process, "gateway-process");
    const config = processConfig(input, paths.auth);
    await writeOwnedTextFile(paths.config, dump(config, { noRefs: true, lineWidth: -1 }), "config");
    const args = [...(input.executableArgs ?? []), "--config", paths.config];
    const logFile = `${paths.logs}/cliproxyapi.log`;
    const child = await system.spawn(input.executable, args, {
      cwd: paths.root,
      env: Object.fromEntries([
        "PATH", "HOME", "USERPROFILE", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE",
        "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT",
      ].flatMap((key) => parentEnv[key] == null ? [] : [[key, parentEnv[key]]] as Array<[string, string]>)),
      shell: false,
      detached: true,
      logFile,
    });
    try {
      const record: ClaudeGatewayProcessRecord = {
        pid: child.pid,
        startedAt: await system.readStartedAt(child.pid),
        executable: input.executable,
        args,
        configPath: paths.config,
        baseUrl: input.baseUrl,
      };
      await writeOwnedJsonFile(paths.process, "gateway-process", record);
      await waitUntilReady(input);
      return record;
    } catch (error) {
      if (await system.isAlive(child.pid)) {
        await system.signal(child.pid, "SIGTERM").catch(() => undefined);
        await system.waitForExit(child.pid).catch(() => undefined);
      }
      throw error;
    }
  };

  return {
    paths,
    start(input: StartClaudeGatewayProcessInput) {
      if (!startInFlight) {
        startInFlight = start(input).finally(() => { startInFlight = null; });
      }
      return startInFlight;
    },
    async inspect() {
      const record = await readRecord();
      if (!record) return { running: false, owned: false, record: null };
      const alive = await system.isAlive(record.pid);
      return { running: alive, owned: alive && await recordIsOwned(record), record };
    },
    async stop() {
      if (mode === "external") return { stopped: false };
      const record = await readRecord();
      if (!record || !await system.isAlive(record.pid)) return { stopped: false };
      if (!await recordIsOwned(record)) throw new Error("Managed gateway process ownership could not be verified; refusing to stop it.");
      await system.signal(record.pid, "SIGTERM");
      await system.waitForExit(record.pid);
      return { stopped: true, pid: record.pid };
    },
  };
}

export type ClaudeModelGatewayProcessManager = ReturnType<typeof createClaudeModelGatewayProcessManager>;
