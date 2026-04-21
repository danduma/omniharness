import fs from "fs";
import path from "path";

export interface BridgeLockRecord {
  pid: number;
  bridgeUrl: string;
  startedAt: number;
}

export interface AcquireBridgeLockResult {
  status: "acquired" | "locked";
  owner?: BridgeLockRecord;
}

export function resolveBridgeLockPath(repoRoot: string) {
  return path.resolve(repoRoot, ".omniharness", "bridge.lock.json");
}

export function readBridgeLock(lockPath: string): BridgeLockRecord | null {
  try {
    const raw = fs.readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BridgeLockRecord>;

    if (
      typeof parsed.pid === "number" &&
      typeof parsed.bridgeUrl === "string" &&
      typeof parsed.startedAt === "number"
    ) {
      return {
        pid: parsed.pid,
        bridgeUrl: parsed.bridgeUrl,
        startedAt: parsed.startedAt,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    return code !== "ESRCH";
  }
}

function writeExclusiveLock(lockPath: string, record: BridgeLockRecord) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const handle = fs.openSync(lockPath, "wx");
  try {
    fs.writeFileSync(handle, JSON.stringify(record, null, 2), "utf8");
  } finally {
    fs.closeSync(handle);
  }
}

export function acquireBridgeLock(
  lockPath: string,
  record: BridgeLockRecord,
  pidAlive: (pid: number) => boolean = isProcessAlive,
): AcquireBridgeLockResult {
  try {
    writeExclusiveLock(lockPath, record);
    return { status: "acquired" };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code !== "EEXIST") {
      throw error;
    }
  }

  const existing = readBridgeLock(lockPath);
  if (existing && pidAlive(existing.pid)) {
    return { status: "locked", owner: existing };
  }

  fs.rmSync(lockPath, { force: true });
  writeExclusiveLock(lockPath, record);
  return { status: "acquired" };
}

export function releaseBridgeLock(lockPath: string, pid: number) {
  const existing = readBridgeLock(lockPath);
  if (existing?.pid === pid) {
    fs.rmSync(lockPath, { force: true });
  }
}
