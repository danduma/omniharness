/**
 * Integration tests for the AgentRuntimeManager retention/reaper paths
 * introduced to fix the memory-pressure crash:
 *
 *   - child exit → grace-period reap removes the record from this.agents
 *   - idle agents older than OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS get stopAgent'd
 *     by the periodic sweep
 *   - MemoryTracer emits spawn + exit records for every started child
 *
 * Drives the manager with a tiny stub ACP CLI (Node script) so we don't depend
 * on any real agent binary.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { acquireWorkerSpawnResources } from "@/server/agent-runtime/resource-admission";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

const tempDirs: string[] = [];

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createExecutable(dir: string, name: string, contents: string) {
  const filePath = join(dir, name);
  writeFileSync(filePath, contents, { mode: 0o755 });
  return filePath;
}

// Minimal ACP CLI: responds to initialize + session/new, then stays alive
// reading from stdin until the parent kills it. Enough for the manager to
// register the agent in its `agents` map.
const minimalAcpScript = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    } else if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    }
  }
});

// Keep alive until parent signals exit.
process.stdin.on('end', () => process.exit(0));
`;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function startAgent(manager: AgentRuntimeManager, dir: string, name: string) {
  const command = createExecutable(dir, `acp-${name}.js`, minimalAcpScript);
  return manager.startAgent({
    type: "gemini",
    name,
    cwd: dir,
    command,
    args: [],
  });
}

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentRuntimeManager exit-grace reaper", () => {
  it("removes the agent record from this.agents after the grace period when the child exits", async () => {
    const dir = createTempDir("omni-reaper-exit-");
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_AGENT_EXIT_GRACE_MS: "80",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
    try {
      const status = await startAgent(manager, dir, "reap-exit");
      expect(status.name).toBe("reap-exit");
      expect(manager.agents.has("reap-exit")).toBe(true);

      // Force the child to exit. The exit handler should mark state stopped
      // and schedule the grace-period reap.
      const record = manager.agents.get("reap-exit")!;
      record.child.kill("SIGTERM");

      // Before grace window elapses, the record should still be present
      // (tombstone for observers).
      await sleep(20);
      expect(manager.agents.has("reap-exit")).toBe(true);
      expect(["stopped", "error"]).toContain(manager.agents.get("reap-exit")!.state);

      // After grace window, the record must be gone.
      await sleep(200);
      expect(manager.agents.has("reap-exit")).toBe(false);
    } finally {
      manager.shutdownPools();
    }
  });

  it("does not reap if the record was restarted to a non-terminal state during the grace window", async () => {
    const dir = createTempDir("omni-reaper-restart-");
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_AGENT_EXIT_GRACE_MS: "80",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
    try {
      await startAgent(manager, dir, "reap-restart");
      const record = manager.agents.get("reap-restart")!;
      record.child.kill("SIGTERM");
      await sleep(20);
      expect(["stopped", "error"]).toContain(manager.agents.get("reap-restart")!.state);

      // Simulate the record being revived (e.g. restart under the same name).
      manager.agents.get("reap-restart")!.state = "idle";

      await sleep(200);
      // Reap timer should have checked state and bailed because the record is
      // no longer in a terminal state.
      expect(manager.agents.has("reap-restart")).toBe(true);
      expect(manager.agents.get("reap-restart")!.state).toBe("idle");
    } finally {
      // Manually remove since we left it in idle. shutdownPools doesn't reap.
      manager.agents.delete("reap-restart");
      manager.shutdownPools();
    }
  });
});

describe("AgentRuntimeManager idle-agent sweep", () => {
  it("auto-stops idle agents older than the idle timeout", async () => {
    const dir = createTempDir("omni-reaper-idle-");
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_AGENT_EXIT_GRACE_MS: "10000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "50",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "30",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
    try {
      await startAgent(manager, dir, "reap-idle");
      const record = manager.agents.get("reap-idle")!;
      // Force the record into the idle state with an updatedAt far enough in
      // the past that the next sweep tick treats it as stale.
      record.state = "idle";
      record.updatedAt = new Date(Date.now() - 5_000).toISOString();

      // Wait for at least 2 sweep ticks + the stopAgent kill timer.
      await sleep(400);

      expect(manager.agents.has("reap-idle")).toBe(false);
    } finally {
      manager.shutdownPools();
    }
  });

  it("leaves busy (working) agents alone even if their updatedAt is stale", async () => {
    const dir = createTempDir("omni-reaper-busy-");
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_AGENT_EXIT_GRACE_MS: "10000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "50",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "30",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
    try {
      await startAgent(manager, dir, "reap-busy");
      const record = manager.agents.get("reap-busy")!;
      record.state = "working";
      record.updatedAt = new Date(Date.now() - 5_000).toISOString();

      await sleep(150);

      expect(manager.agents.has("reap-busy")).toBe(true);
      expect(manager.agents.get("reap-busy")!.state).toBe("working");
    } finally {
      const record = manager.agents.get("reap-busy");
      if (record) record.child.kill("SIGTERM");
      manager.shutdownPools();
    }
  });
});

describe("MemoryTracer", () => {
  it("emits boot, spawn and exit events to the configured log path", async () => {
    const dir = createTempDir("omni-tracer-");
    const tracePath = join(dir, "memory-trace.log");
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_MEMORY_TRACE: "1",
        OMNIHARNESS_MEMORY_TRACE_PATH: tracePath,
        OMNIHARNESS_MEMORY_TRACE_INTERVAL_MS: "60000",
        OMNIHARNESS_AGENT_EXIT_GRACE_MS: "10000",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
      } as Record<string, string>,
    });
    try {
      await startAgent(manager, dir, "traced");
      // Let the spawn event hit disk (appendFile is async).
      await sleep(50);

      const record = manager.agents.get("traced")!;
      record.child.kill("SIGTERM");
      await sleep(100);

      const content = readFileSync(tracePath, "utf8");
      const lines = content.split("\n").filter(Boolean).map((line) => JSON.parse(line));
      const kinds = new Set(lines.map((line) => line.kind));
      expect(kinds.has("boot")).toBe(true);
      expect(kinds.has("spawn")).toBe(true);
      expect(kinds.has("exit")).toBe(true);

      const spawn = lines.find((line) => line.kind === "spawn");
      expect(spawn.type).toBe("gemini");
      expect(spawn.purpose).toBe("run");
      expect(typeof spawn.pid).toBe("number");

      const exit = lines.find((line) => line.kind === "exit");
      expect(exit.pid).toBe(spawn.pid);
      expect(typeof exit.livedMs).toBe("number");
    } finally {
      manager.shutdownPools();
    }
  });
});

describe("AgentRuntimeManager resource admission", () => {
  it("refuses to spawn a worker when memory headroom is below the stability margin", async () => {
    const dir = createTempDir("omni-resource-guard-");
    const requestLog = join(dir, "requests.jsonl");
    createExecutable(dir, "gemini", minimalAcpScript);
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ""}`,
        FAKE_ACP_REQUEST_LOG: requestLog,
        OMNIHARNESS_MEMORY_TRACE: "0",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      } as Record<string, string>,
      resourceSnapshotProvider: () => ({
        memoryFreePercent: 10,
        diskFreeMb: 100_000,
      }),
    } as ConstructorParameters<typeof AgentRuntimeManager>[0]);

    try {
      await expect(startAgent(manager, dir, "refuse-low-memory")).rejects.toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("Cannot spawn worker because system resources are low"),
      });
      expect(() => readFileSync(requestLog, "utf8")).toThrow();
      expect(manager.agents.has("refuse-low-memory")).toBe(false);
    } finally {
      manager.shutdownPools();
    }
  });

  it("explains disk-only resource refusal without assuming other workers are running", async () => {
    const dir = createTempDir("omni-resource-disk-message-");
    const env = {
      ...process.env,
      OMNIHARNESS_MIN_MEMORY_FREE_PERCENT: "12",
      OMNIHARNESS_MIN_DISK_FREE_MB: "8192",
    } as Record<string, string>;

    await expect(acquireWorkerSpawnResources({
      cwd: dir,
      env,
      snapshotProvider: () => ({
        memoryFreePercent: 40,
        totalMemoryMb: 16_384,
        diskFreeMb: 3_939,
      }),
    })).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("Free disk space before retrying."),
    });

    await expect(acquireWorkerSpawnResources({
      cwd: dir,
      env,
      snapshotProvider: () => ({
        memoryFreePercent: 40,
        totalMemoryMb: 16_384,
        diskFreeMb: 3_939,
      }),
    })).rejects.toMatchObject({
      message: expect.stringContaining("If other workers are running, you can also wait for them to finish."),
    });
  });

  it("allows a spawn when memory is above the configured stability margin", async () => {
    const dir = createTempDir("omni-resource-allow-margin-");
    createExecutable(dir, "gemini", minimalAcpScript);
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ""}`,
        OMNIHARNESS_MEMORY_TRACE: "0",
        OMNIHARNESS_MIN_MEMORY_FREE_PERCENT: "25",
        OMNIHARNESS_ESTIMATED_WORKER_MEMORY_MB: "1536",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      } as Record<string, string>,
      resourceSnapshotProvider: () => ({
        memoryFreePercent: 38,
        totalMemoryMb: 16_384,
        diskFreeMb: 100_000,
      }),
    } as ConstructorParameters<typeof AgentRuntimeManager>[0]);

    try {
      await expect(startAgent(manager, dir, "allow-above-margin")).resolves.toMatchObject({
        name: "allow-above-margin",
      });
    } finally {
      await manager.stopAgent("allow-above-margin");
      manager.shutdownPools();
    }
  });

  it("does not double-count the new worker against the memory stability margin", async () => {
    const dir = createTempDir("omni-resource-pending-margin-");
    const env = {
      ...process.env,
      OMNIHARNESS_MIN_MEMORY_FREE_PERCENT: "25",
      OMNIHARNESS_ESTIMATED_WORKER_MEMORY_MB: "1536",
    } as Record<string, string>;
    const snapshotProvider = () => ({
      memoryFreePercent: 38,
      totalMemoryMb: 16_384,
      diskFreeMb: 100_000,
    });
    const first = await acquireWorkerSpawnResources({
      cwd: dir,
      env,
      snapshotProvider,
    });

    const releases: Array<() => void> = [];
    try {
      await expect((async () => {
        const second = await acquireWorkerSpawnResources({
          cwd: dir,
          env,
          snapshotProvider,
        });
        releases.push(second.release);
        return second;
      })()).resolves.toEqual(expect.objectContaining({
        release: expect.any(Function),
      }));
    } finally {
      first.release();
      for (const release of releases) {
        release();
      }
    }
  });

  it("reserves estimated memory while parallel worker spawns are in flight", async () => {
    const dir = createTempDir("omni-resource-reserve-");
    createExecutable(dir, "gemini", minimalAcpScript);
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ""}`,
        OMNIHARNESS_MEMORY_TRACE: "0",
        OMNIHARNESS_MIN_MEMORY_FREE_PERCENT: "20",
        OMNIHARNESS_ESTIMATED_WORKER_MEMORY_MB: "1024",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      } as Record<string, string>,
      resourceSnapshotProvider: () => ({
        memoryFreePercent: 26,
        totalMemoryMb: 16_000,
        diskFreeMb: 100_000,
      }),
    } as ConstructorParameters<typeof AgentRuntimeManager>[0]);

    try {
      const results = await Promise.allSettled([
        startAgent(manager, dir, "parallel-a"),
        startAgent(manager, dir, "parallel-b"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        reason: expect.objectContaining({
          statusCode: 503,
          message: expect.stringContaining("Cannot spawn worker because system resources are low"),
        }),
      });
    } finally {
      for (const name of ["parallel-a", "parallel-b"]) {
        await manager.stopAgent(name);
      }
      manager.shutdownPools();
    }
  });

  it("evicts prewarm workers under critical pressure without killing active workers", async () => {
    const dir = createTempDir("omni-resource-watch-");
    createExecutable(dir, "gemini", minimalAcpScript);
    let pressure = false;
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ""}`,
        OMNIHARNESS_MEMORY_TRACE: "0",
        OMNIHARNESS_MIN_MEMORY_FREE_PERCENT: "25",
        OMNIHARNESS_RESOURCE_PRESSURE_INTERVAL_MS: "30",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      } as Record<string, string>,
      resourceSnapshotProvider: () => pressure
        ? { memoryFreePercent: 10, totalMemoryMb: 16_000, diskFreeMb: 100_000 }
        : { memoryFreePercent: 60, totalMemoryMb: 16_000, diskFreeMb: 100_000 },
    } as ConstructorParameters<typeof AgentRuntimeManager>[0]);

    try {
      await startAgent(manager, dir, "active-under-pressure");
      manager.agents.get("active-under-pressure")!.state = "working";
      await manager.prewarmWorker({ type: "gemini", cwd: dir });
      expect((manager as any).workerPool.countAll()).toBe(1);

      pressure = true;
      await sleep(120);

      expect(manager.agents.get("active-under-pressure")?.state).toBe("working");
      expect((manager as any).workerPool.countAll()).toBe(0);
      const events = getNamedEventsSince(0).events.map((entry) => entry.event);
      expect(events).toContainEqual(expect.objectContaining({
        kind: "runtime.resource_pressure",
        level: "critical",
        evictedPoolMembers: 1,
      }));
      expect(events).toContainEqual(expect.objectContaining({
        kind: "error.surfaced",
        code: "runtime.resource_pressure",
      }));
    } finally {
      await manager.stopAgent("active-under-pressure");
      manager.shutdownPools();
    }
  });

  it("cleans prewarmed workers after a quiet period with no active agents", async () => {
    const dir = createTempDir("omni-resource-idle-cleanup-");
    createExecutable(dir, "gemini", minimalAcpScript);
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ""}`,
        OMNIHARNESS_MEMORY_TRACE: "0",
        OMNIHARNESS_WORKER_POOL_MAX_AGE_MS: "999999",
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "30",
        OMNIHARNESS_RUNTIME_IDLE_CLEANUP_ENABLED: "false",
        OMNIHARNESS_RUNTIME_IDLE_CLEANUP_AFTER_MS: "60",
      } as Record<string, string>,
    } as ConstructorParameters<typeof AgentRuntimeManager>[0]);

    try {
      await manager.prewarmWorker({ type: "gemini", cwd: dir });
      expect((manager as any).workerPool.countAll()).toBe(1);

      await sleep(120);
      expect((manager as any).workerPool.countAll()).toBe(1);

      manager.applyRuntimeSettings({
        OMNIHARNESS_RUNTIME_IDLE_CLEANUP_ENABLED: "true",
        OMNIHARNESS_RUNTIME_IDLE_CLEANUP_AFTER_MS: "60000",
      });
      (manager as any).runtimeStartedAt = Date.now() - 120_000;
      (manager as any).lastAgentUseAt = Date.now() - 120_000;
      (manager as any).runReapSweep();

      expect((manager as any).workerPool.countAll()).toBe(0);
      const events = getNamedEventsSince(0).events.map((entry) => entry.event);
      expect(events).toContainEqual(expect.objectContaining({
        kind: "runtime.settings_updated",
        keys: expect.arrayContaining(["OMNIHARNESS_RUNTIME_IDLE_CLEANUP_ENABLED"]),
      }));
      expect(events).toContainEqual(expect.objectContaining({
        kind: "runtime.idle_cleanup",
        activeAgents: 0,
        evictedPoolMembers: 1,
      }));
    } finally {
      manager.shutdownPools();
    }
  });
});
