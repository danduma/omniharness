import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireBridgeLock,
  isBridgeStarterCommand,
  readBridgeLock,
  releaseBridgeLock,
  resolveBridgeLockPath,
  type BridgeLockRecord,
} from "@/server/dev/bridge-lock";

describe("bridge lock helpers", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeLockPath() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-bridge-lock-"));
    tempDirs.push(dir);
    return resolveBridgeLockPath(dir);
  }

  function record(overrides: Partial<BridgeLockRecord> = {}): BridgeLockRecord {
    return {
      pid: 11111,
      bridgeUrl: "http://127.0.0.1:7800",
      startedAt: 123,
      ...overrides,
    };
  }

  it("acquires a fresh lock file", () => {
    const lockPath = makeLockPath();

    const result = acquireBridgeLock(lockPath, record(), () => false);

    expect(result).toEqual({ status: "acquired" });
    expect(readBridgeLock(lockPath)).toEqual(record());
  });

  it("returns the live owner instead of stealing the lock", () => {
    const lockPath = makeLockPath();
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify(record({ pid: 22222 })));

    const result = acquireBridgeLock(lockPath, record({ pid: 33333 }), (pid) => pid === 22222);

    expect(result).toEqual({
      status: "locked",
      owner: record({ pid: 22222 }),
    });
    expect(readBridgeLock(lockPath)).toEqual(record({ pid: 22222 }));
  });

  it("replaces a stale lock file", () => {
    const lockPath = makeLockPath();
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify(record({ pid: 22222 })));

    const result = acquireBridgeLock(lockPath, record({ pid: 33333 }), () => false);

    expect(result).toEqual({ status: "acquired" });
    expect(readBridgeLock(lockPath)).toEqual(record({ pid: 33333 }));
  });

  it("releases only the owning lock", () => {
    const lockPath = makeLockPath();
    acquireBridgeLock(lockPath, record({ pid: 33333 }), () => false);

    releaseBridgeLock(lockPath, 44444);
    expect(readBridgeLock(lockPath)).toEqual(record({ pid: 33333 }));

    releaseBridgeLock(lockPath, 33333);
    expect(readBridgeLock(lockPath)).toBeNull();
  });

  it("matches OmniHarness bridge starter commands", () => {
    expect(isBridgeStarterCommand("node ./node_modules/.bin/tsx scripts/dev.ts")).toBe(true);
    expect(isBridgeStarterCommand("node /repo/scripts/agent-runtime.ts")).toBe(true);
    expect(isBridgeStarterCommand("/usr/libexec/mobileassetd")).toBe(false);
    expect(isBridgeStarterCommand("node scripts/devtools.ts")).toBe(false);
  });
});
