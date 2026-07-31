import fs from "node:fs";
import path from "node:path";
import { isProcessAlive as defaultIsProcessAlive } from "@/server/process-ownership";

export interface RunnerLockRecord {
  pid: number;
  host: string;
  port: number;
  startedAt: number;
}

export class RunnerAlreadyRunningError extends Error {
  constructor(readonly owner: RunnerLockRecord) {
    super(
      `Another OmniHarness server (pid ${owner.pid}) owns ${owner.host}:${owner.port}.`,
    );
    this.name = "RunnerAlreadyRunningError";
  }
}

export function readRunnerLock(lockPath: string): RunnerLockRecord | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(lockPath, "utf8"),
    ) as Partial<RunnerLockRecord>;
    if (
      typeof parsed.pid !== "number"
      || typeof parsed.host !== "string"
      || typeof parsed.port !== "number"
      || typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    return parsed as RunnerLockRecord;
  } catch {
    return null;
  }
}

function writeExclusive(lockPath: string, record: RunnerLockRecord) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const handle = fs.openSync(lockPath, "wx");
  try {
    fs.writeFileSync(handle, JSON.stringify(record, null, 2), "utf8");
  } finally {
    fs.closeSync(handle);
  }
}

export function acquireRunnerLock({
  lockPath,
  record,
  isProcessAlive = defaultIsProcessAlive,
}: {
  lockPath: string;
  record: RunnerLockRecord;
  isProcessAlive?: (pid: number) => boolean;
}) {
  try {
    writeExclusive(lockPath, record);
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : null;
    if (code !== "EEXIST") {
      throw error;
    }
    const owner = readRunnerLock(lockPath);
    if (owner && isProcessAlive(owner.pid)) {
      throw new RunnerAlreadyRunningError(owner);
    }
    fs.rmSync(lockPath, { force: true });
    writeExclusive(lockPath, record);
  }

  let released = false;
  return {
    record,
    release() {
      if (released) {
        return;
      }
      released = true;
      if (readRunnerLock(lockPath)?.pid === record.pid) {
        fs.rmSync(lockPath, { force: true });
      }
    },
  };
}
