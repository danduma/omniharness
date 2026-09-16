import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeOutputRetentionManager } from "@/server/agent-runtime/output-retention";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "omni-output-retention-"));
  tempDirs.push(dir);
  return dir;
}

function writeArchive(directory: string, name: string, bytes: number, modifiedAt: number) {
  const filePath = join(directory, name);
  writeFileSync(filePath, "x".repeat(bytes));
  const timestamp = new Date(modifiedAt);
  utimesSync(filePath, timestamp, timestamp);
  return filePath;
}

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("RuntimeOutputRetentionManager", () => {
  it("deletes the oldest raw output archives until the directory is within its byte limit", () => {
    const dataDir = createTempDir();
    const directory = join(dataDir, "agent-runtime-output");
    mkdirSync(directory);
    const oldest = writeArchive(directory, "old-worker.jsonl", 10, 1_000);
    const middle = writeArchive(directory, "middle-worker.jsonl.2026-01-01T00-00-00-000Z.prev", 10, 2_000);
    const newest = writeArchive(directory, "new-worker.jsonl", 10, 3_000);
    writeArchive(directory, "sqlite.db", 100, 500);

    const report = new RuntimeOutputRetentionManager().sweep({
      dataDir,
      maxBytes: 20,
      protectedPaths: new Set(),
    });

    expect(existsSync(oldest)).toBe(false);
    expect(existsSync(middle)).toBe(true);
    expect(existsSync(newest)).toBe(true);
    expect(existsSync(join(directory, "sqlite.db"))).toBe(true);
    expect(report).toMatchObject({
      deletedFiles: 1,
      deletedBytes: 10,
      remainingBytes: 20,
      deferredBytes: 0,
    });
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "runtime.output_logs_pruned",
      deletedFiles: 1,
      deletedBytes: 10,
      remainingBytes: 20,
      maxBytes: 20,
    }));
  });

  it("protects active and starting archives and reports when they keep usage above the limit", () => {
    const dataDir = createTempDir();
    const directory = join(dataDir, "agent-runtime-output");
    mkdirSync(directory);
    const active = writeArchive(directory, "active-worker.jsonl", 20, 1_000);
    const oldInactive = writeArchive(directory, "old-inactive-worker.jsonl", 10, 2_000);
    const newInactive = writeArchive(directory, "new-inactive-worker.jsonl", 10, 3_000);

    const report = new RuntimeOutputRetentionManager().sweep({
      dataDir,
      maxBytes: 15,
      protectedPaths: new Set([active]),
    });

    expect(existsSync(active)).toBe(true);
    expect(existsSync(oldInactive)).toBe(false);
    expect(existsSync(newInactive)).toBe(false);
    expect(report).toMatchObject({
      deletedFiles: 2,
      deletedBytes: 20,
      remainingBytes: 20,
      deferredBytes: 5,
      protectedFiles: 1,
      protectedBytes: 20,
    });
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "runtime.output_logs_prune_deferred",
      remainingBytes: 20,
      maxBytes: 15,
      protectedFiles: 1,
    }));
  });

  it("does nothing when the archive directory does not exist", () => {
    const dataDir = createTempDir();

    const report = new RuntimeOutputRetentionManager().sweep({
      dataDir,
      maxBytes: 20,
      protectedPaths: new Set(),
    });

    expect(report).toMatchObject({
      scannedFiles: 0,
      deletedFiles: 0,
      remainingBytes: 0,
      deferredBytes: 0,
    });
    expect(getNamedEventsSince(0).events).toHaveLength(0);
  });

  it("surfaces a typed failure when the archive directory cannot be scanned", () => {
    const dataDir = createTempDir();
    writeFileSync(join(dataDir, "agent-runtime-output"), "not a directory");

    const report = new RuntimeOutputRetentionManager().sweep({
      dataDir,
      maxBytes: 20,
      protectedPaths: new Set(),
    });

    expect(report.failures).toBe(1);
    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "runtime.output_logs_prune_failed",
      failures: 1,
    }));
    expect(events).toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      code: "runtime.output_logs_prune_failed",
      surface: "log",
    }));
  });
});
