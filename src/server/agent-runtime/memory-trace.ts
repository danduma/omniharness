/**
 * Lightweight memory instrumentation for diagnosing runaway memory use.
 *
 * Writes JSONL events to a single log file. Default path is
 * `.omniharness/memory-trace.jsonl` under the server working directory, so it
 * survives manual restarts and macOS temp cleanup.
 * Override with OMNIHARNESS_MEMORY_TRACE_PATH for a stable location.
 * Records three kinds of events:
 *   - "boot"     : one line when the tracer starts in a fresh runtime instance
 *   - "spawn"    : when a child agent process is registered for tracking
 *   - "exit"     : when a tracked child exits
 *   - "snapshot" : periodic sample of parent memory + per-child RSS + counts
 *
 * Enabled by default; opt out with OMNIHARNESS_MEMORY_TRACE=0.
 * Interval override: OMNIHARNESS_MEMORY_TRACE_INTERVAL_MS (default 30000).
 * Path override: OMNIHARNESS_MEMORY_TRACE_PATH.
 */
import { execFile, type ChildProcessWithoutNullStreams } from "child_process";
import { promisify } from "util";
import { appendFile, mkdir } from "fs/promises";
import { dirname, join } from "path";

const execFileAsync = promisify(execFile);

export type MemoryTracerCounts = {
  agents: number;
  poolMembers: number;
};

export type MemoryTracerOptions = {
  getCounts: () => MemoryTracerCounts;
  env?: Record<string, string | undefined>;
};

type ChildMeta = { type: string; spawnedAt: number };

export class MemoryTracer {
  private readonly enabled: boolean;
  private readonly logPath: string;
  private readonly intervalMs: number;
  private readonly getCounts: () => MemoryTracerCounts;
  private readonly trackedPids = new Set<number>();
  private readonly pidMeta = new Map<number, ChildMeta>();
  private timer: NodeJS.Timeout | null = null;

  constructor(opts: MemoryTracerOptions) {
    const env = opts.env ?? process.env;
    this.enabled = env.OMNIHARNESS_MEMORY_TRACE !== "0";
    this.logPath = env.OMNIHARNESS_MEMORY_TRACE_PATH || join(process.cwd(), ".omniharness", "memory-trace.jsonl");
    const intervalRaw = env.OMNIHARNESS_MEMORY_TRACE_INTERVAL_MS;
    const parsedInterval = intervalRaw ? Number.parseInt(intervalRaw, 10) : NaN;
    this.intervalMs = Number.isFinite(parsedInterval) && parsedInterval >= 1000 ? parsedInterval : 30_000;
    this.getCounts = opts.getCounts;
    if (this.enabled) this.start();
  }

  get path(): string {
    return this.logPath;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  onSpawn(child: ChildProcessWithoutNullStreams, type: string, extra?: Record<string, unknown>): void {
    if (!this.enabled) return;
    const pid = child.pid;
    if (!pid) return;
    this.trackedPids.add(pid);
    this.pidMeta.set(pid, { type, spawnedAt: Date.now() });
    void this.append({
      kind: "spawn",
      pid,
      type,
      ...(extra ?? {}),
      ...this.parentSnapshot(),
    });
    child.once("exit", (code, signal) => {
      const meta = this.pidMeta.get(pid);
      this.trackedPids.delete(pid);
      this.pidMeta.delete(pid);
      void this.append({
        kind: "exit",
        pid,
        type,
        code,
        signal,
        livedMs: meta ? Date.now() - meta.spawnedAt : null,
        ...this.parentSnapshot(),
      });
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private start(): void {
    void this.append({
      kind: "boot",
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      ...this.parentSnapshot(),
    });
    this.timer = setInterval(() => {
      void this.snapshot();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  private parentSnapshot(): Record<string, number> {
    const mu = process.memoryUsage();
    return {
      parent_rss: mu.rss,
      parent_heapUsed: mu.heapUsed,
      parent_heapTotal: mu.heapTotal,
      parent_external: mu.external,
      parent_arrayBuffers: mu.arrayBuffers,
    };
  }

  private async snapshot(): Promise<void> {
    try {
      const counts = this.getCounts();
      const pids = [...this.trackedPids];
      const rssByPid = pids.length > 0 ? await this.readChildRss(pids) : new Map<number, number>();
      const children = pids.map((pid) => ({
        pid,
        type: this.pidMeta.get(pid)?.type ?? "?",
        ageMs: this.pidMeta.get(pid) ? Date.now() - this.pidMeta.get(pid)!.spawnedAt : null,
        rssKb: rssByPid.get(pid) ?? null,
      }));
      const childRssKbTotal = children.reduce((sum, c) => sum + (c.rssKb ?? 0), 0);
      await this.append({
        kind: "snapshot",
        agents: counts.agents,
        poolMembers: counts.poolMembers,
        trackedChildren: pids.length,
        childRssKbTotal,
        childRssMbTotal: Math.round(childRssKbTotal / 1024),
        children,
        ...this.parentSnapshot(),
      });
    } catch (error) {
      await this.append({
        kind: "snapshot_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async readChildRss(pids: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    try {
      const { stdout } = await execFileAsync("ps", ["-o", "pid=,rss=", "-p", pids.join(",")]);
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [pidStr, rssStr] = trimmed.split(/\s+/);
        const pid = Number(pidStr);
        const rss = Number(rssStr);
        if (Number.isFinite(pid) && Number.isFinite(rss)) {
          result.set(pid, rss);
        }
      }
    } catch {
      // ps fails when every requested pid has already exited; safe to ignore
    }
    return result;
  }

  private async append(record: Record<string, unknown>): Promise<void> {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
    try {
      await mkdir(dirname(this.logPath), { recursive: true });
      await appendFile(this.logPath, line);
    } catch {
      // Best-effort: instrumentation must never break the host process.
    }
  }
}
