import { execFile } from "child_process";
import { readFile } from "fs/promises";
import { freemem, platform, totalmem } from "os";
import { promisify } from "util";
import { RuntimeHttpError } from "./types";

const execFileAsync = promisify(execFile);

const DEFAULT_MIN_MEMORY_FREE_PERCENT = 12;
const DEFAULT_MIN_DISK_FREE_MB = 8192;
const DEFAULT_ESTIMATED_WORKER_MEMORY_MB = 1536;
const RESOURCE_CHECK_TIMEOUT_MS = 1000;
let pendingSpawnReservationMb = 0;

type EnvLike = Record<string, string | undefined>;

export type SystemResourceSnapshot = {
  memoryFreePercent?: number | null;
  totalMemoryMb?: number | null;
  diskFreeMb?: number | null;
};

export type ResourcePressureLevel = "normal" | "warning" | "critical";

export type ResourcePressureAssessment = {
  level: ResourcePressureLevel;
  reasons: string[];
  minMemoryFreePercent: number;
  criticalMemoryFreePercent: number;
  minDiskFreeMb: number;
};

export type SystemResourceSnapshotProvider =
  () => SystemResourceSnapshot | Promise<SystemResourceSnapshot>;

export class ResourceAdmissionError extends RuntimeHttpError {
  readonly code = "worker.spawn.resource_exhausted";

  constructor(message: string, details: Record<string, unknown>) {
    super(503, message, details);
    this.name = "ResourceAdmissionError";
  }
}

export function isResourceAdmissionError(error: unknown): error is ResourceAdmissionError {
  return error instanceof ResourceAdmissionError;
}

function readNumber(env: EnvLike, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function guardDisabled(env: EnvLike): boolean {
  return env.OMNIHARNESS_RESOURCE_GUARD === "0";
}

export function assessResourcePressure(
  snapshot: SystemResourceSnapshot,
  env: EnvLike,
): ResourcePressureAssessment {
  const minMemoryFreePercent = readNumber(
    env,
    "OMNIHARNESS_MIN_MEMORY_FREE_PERCENT",
    DEFAULT_MIN_MEMORY_FREE_PERCENT,
  );
  const criticalMemoryFreePercent = readNumber(
    env,
    "OMNIHARNESS_CRITICAL_MEMORY_FREE_PERCENT",
    Math.max(1, Math.floor(minMemoryFreePercent * 0.6)),
  );
  const minDiskFreeMb = readNumber(
    env,
    "OMNIHARNESS_MIN_DISK_FREE_MB",
    DEFAULT_MIN_DISK_FREE_MB,
  );
  const criticalDiskFreeMb = Math.max(512, Math.floor(minDiskFreeMb / 2));
  const reasons: string[] = [];
  let level: ResourcePressureLevel = "normal";

  if (snapshot.memoryFreePercent != null) {
    if (snapshot.memoryFreePercent < criticalMemoryFreePercent) {
      level = "critical";
      reasons.push(`memory available ${snapshot.memoryFreePercent}%, below critical ${criticalMemoryFreePercent}%`);
    } else if (snapshot.memoryFreePercent < minMemoryFreePercent) {
      level = "warning";
      reasons.push(`memory available ${snapshot.memoryFreePercent}%, below ${minMemoryFreePercent}%`);
    }
  }
  if (snapshot.diskFreeMb != null) {
    if (snapshot.diskFreeMb < criticalDiskFreeMb) {
      level = "critical";
      reasons.push(`disk free ${snapshot.diskFreeMb} MB, below critical ${criticalDiskFreeMb} MB`);
    } else if (snapshot.diskFreeMb < minDiskFreeMb && level !== "critical") {
      level = "warning";
      reasons.push(`disk free ${snapshot.diskFreeMb} MB, below ${minDiskFreeMb} MB`);
    }
  }

  return {
    level,
    reasons,
    minMemoryFreePercent,
    criticalMemoryFreePercent,
    minDiskFreeMb,
  };
}

async function readDarwinMemoryFreePercent(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("memory_pressure", ["-Q"], {
      timeout: RESOURCE_CHECK_TIMEOUT_MS,
    });
    const match = stdout.match(/System-wide memory free percentage:\s*(\d+)%/i);
    if (!match) return null;
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function readLinuxMemoryFreePercent(): Promise<number | null> {
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const availableKb = Number.parseInt(meminfo.match(/^MemAvailable:\s+(\d+)/m)?.[1] ?? "", 10);
    const totalKb = Number.parseInt(meminfo.match(/^MemTotal:\s+(\d+)/m)?.[1] ?? "", 10);
    if (!Number.isFinite(availableKb) || !Number.isFinite(totalKb) || totalKb <= 0) return null;
    return Math.round((availableKb / totalKb) * 100);
  } catch {
    return null;
  }
}

async function readMemoryFreePercent(): Promise<number | null> {
  if (platform() === "darwin") return readDarwinMemoryFreePercent();
  if (platform() === "linux") return readLinuxMemoryFreePercent();
  const total = totalmem();
  return total > 0 ? Math.round((freemem() / total) * 100) : null;
}

async function readDiskFreeMb(cwd: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", cwd], {
      timeout: RESOURCE_CHECK_TIMEOUT_MS,
    });
    const line = stdout.trim().split(/\r?\n/)[1];
    if (!line) return null;
    const columns = line.trim().split(/\s+/);
    const availableKb = Number.parseInt(columns[3] ?? "", 10);
    return Number.isFinite(availableKb) ? Math.floor(availableKb / 1024) : null;
  } catch {
    return null;
  }
}

export async function readSystemResourceSnapshot(cwd: string): Promise<SystemResourceSnapshot> {
  const [memoryFreePercent, diskFreeMb] = await Promise.all([
    readMemoryFreePercent(),
    readDiskFreeMb(cwd),
  ]);
  return {
    memoryFreePercent,
    totalMemoryMb: Math.round(totalmem() / 1024 / 1024),
    diskFreeMb,
  };
}

export async function acquireWorkerSpawnResources(args: {
  cwd: string;
  env: EnvLike;
  snapshotProvider?: SystemResourceSnapshotProvider;
}): Promise<{ release: () => void }> {
  if (guardDisabled(args.env)) return { release: () => undefined };

  const minMemoryFreePercent = readNumber(
    args.env,
    "OMNIHARNESS_MIN_MEMORY_FREE_PERCENT",
    DEFAULT_MIN_MEMORY_FREE_PERCENT,
  );
  const minDiskFreeMb = readNumber(
    args.env,
    "OMNIHARNESS_MIN_DISK_FREE_MB",
    DEFAULT_MIN_DISK_FREE_MB,
  );
  const estimatedWorkerMemoryMb = readNumber(
    args.env,
    "OMNIHARNESS_ESTIMATED_WORKER_MEMORY_MB",
    DEFAULT_ESTIMATED_WORKER_MEMORY_MB,
  );
  const snapshot = args.snapshotProvider
    ? await args.snapshotProvider()
    : await readSystemResourceSnapshot(args.cwd);

  const failures: string[] = [];
  if (
    snapshot.memoryFreePercent != null
    && snapshot.memoryFreePercent < minMemoryFreePercent
  ) {
    failures.push(`memory available ${snapshot.memoryFreePercent}%, below ${minMemoryFreePercent}%`);
  }
  const totalMemoryMb = snapshot.totalMemoryMb ?? Math.round(totalmem() / 1024 / 1024);
  if (
    snapshot.memoryFreePercent != null
    && totalMemoryMb > 0
    && estimatedWorkerMemoryMb > 0
  ) {
    const availableMemoryMb = Math.floor((totalMemoryMb * snapshot.memoryFreePercent) / 100);
    const minMemoryMb = Math.ceil((totalMemoryMb * minMemoryFreePercent) / 100);
    const unreservedAvailableMemoryMb = availableMemoryMb - pendingSpawnReservationMb;
    if (unreservedAvailableMemoryMb < minMemoryMb) {
      failures.push(
        `memory headroom after pending spawns ${unreservedAvailableMemoryMb} MB, below ${minMemoryMb} MB`,
      );
    }
  }
  if (snapshot.diskFreeMb != null && snapshot.diskFreeMb < minDiskFreeMb) {
    failures.push(`disk free ${snapshot.diskFreeMb} MB, below ${minDiskFreeMb} MB`);
  }
  if (failures.length === 0) {
    pendingSpawnReservationMb += estimatedWorkerMemoryMb;
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        pendingSpawnReservationMb = Math.max(0, pendingSpawnReservationMb - estimatedWorkerMemoryMb);
      },
    };
  }

  throw new ResourceAdmissionError(
    `Cannot spawn worker because system resources are low (${failures.join("; ")}). Try again after other workers finish.`,
    {
      code: "worker.spawn.resource_exhausted",
      memoryFreePercent: snapshot.memoryFreePercent ?? null,
      totalMemoryMb,
      diskFreeMb: snapshot.diskFreeMb ?? null,
      minMemoryFreePercent,
      minDiskFreeMb,
      estimatedWorkerMemoryMb,
      pendingSpawnReservationMb,
    },
  );
}

export async function assertWorkerSpawnResources(args: {
  cwd: string;
  env: EnvLike;
  snapshotProvider?: SystemResourceSnapshotProvider;
}): Promise<void> {
  const admission = await acquireWorkerSpawnResources(args);
  admission.release();
}
