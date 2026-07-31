import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acquireRunnerLock,
  readRunnerLock,
  RunnerAlreadyRunningError,
} from "@/server/runner/runner-lock";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("runner lock", () => {
  it("reports the live owner and never replaces its lock", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omni-runner-lock-"));
    tempDirs.push(directory);
    const lockPath = path.join(directory, "runner.lock.json");
    const first = acquireRunnerLock({
      lockPath,
      record: {
        pid: 101,
        host: "127.0.0.1",
        port: 3050,
        startedAt: 1,
      },
      isProcessAlive: () => true,
    });

    expect(() => acquireRunnerLock({
      lockPath,
      record: {
        pid: 202,
        host: "127.0.0.1",
        port: 3050,
        startedAt: 2,
      },
      isProcessAlive: () => true,
    })).toThrow(RunnerAlreadyRunningError);
    expect(readRunnerLock(lockPath)?.pid).toBe(101);
    first.release();
  });

  it("replaces a stale lock and releases only its own record", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omni-runner-lock-"));
    tempDirs.push(directory);
    const lockPath = path.join(directory, "runner.lock.json");
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: 101,
      host: "127.0.0.1",
      port: 3050,
      startedAt: 1,
    }));

    const lock = acquireRunnerLock({
      lockPath,
      record: {
        pid: 202,
        host: "127.0.0.1",
        port: 4050,
        startedAt: 2,
      },
      isProcessAlive: () => false,
    });

    expect(readRunnerLock(lockPath)?.pid).toBe(202);
    lock.release();
    expect(readRunnerLock(lockPath)).toBeNull();
  });
});
