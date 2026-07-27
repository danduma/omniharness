import { existsSync, promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import {
  compactRunOutputs,
  compactStaleWorkerOutputs,
  readWorkerOutputEntries,
  resolveWorkerOutputFilePaths,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function cleanupRun(runId: string) {
  await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
}

async function seedWorkerRow(runId: string, workerId: string) {
  // compactRunOutputs enumerates workers from the database, so a transcript on
  // disk with no worker row is invisible to it.
  const planId = randomUUID();
  const now = new Date();
  await db.insert(plans).values({
    id: planId,
    path: `vibes/ad-hoc/compaction-${planId}.md`,
    status: "done",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    title: "Compaction run",
    status: "done",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "claude",
    cwd: "/tmp",
    status: "completed",
    workerNumber: 1,
    title: "terminal",
    initialPrompt: "",
    createdAt: now,
    updatedAt: now,
  });
}

describe("workers/output-store compaction lifecycle", () => {
  it("compactRunOutputs gzips per-worker files and reads stay transparent", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    const entries = [
      { type: "agent_message", text: "hello" } as any,
      { type: "agent_message", text: "world" } as any,
    ];

    await seedWorkerRow(runId, workerId);
    await writeWorkerOutputEntries(runId, workerId, entries);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, workerId)).filePath)).toBe(true);

    const result = await compactRunOutputs(runId);
    expect(result.compactedWorkerIds).toEqual([workerId]);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, workerId)).filePath)).toBe(false);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, workerId)).compressedFilePath)).toBe(true);

    const readBack = await readWorkerOutputEntries(runId, workerId);
    expect(readBack.map((e) => (e as any).text)).toEqual(["hello", "world"]);

    await cleanupRun(runId);
  });

  it("write auto-expands the compressed file so a resumed worker can keep emitting", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    await seedWorkerRow(runId, workerId);
    await writeWorkerOutputEntries(runId, workerId, [
      { id: "e1", type: "agent_message", text: "before" } as any,
    ]);
    await compactRunOutputs(runId);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, workerId)).compressedFilePath)).toBe(true);

    await writeWorkerOutputEntries(runId, workerId, [
      { id: "e2", type: "agent_message", text: "after-resume" } as any,
    ]);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, workerId)).filePath)).toBe(true);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, workerId)).compressedFilePath)).toBe(false);

    // Append-only: the resumed worker continues the transcript rather
    // than replacing it. The compacted history is auto-expanded so the
    // new entry lands at the tail.
    const final = await readWorkerOutputEntries(runId, workerId);
    expect(final.map((e) => (e as any).text)).toEqual(["before", "after-resume"]);

    await cleanupRun(runId);
  });

  it("compactStaleWorkerOutputs only touches terminal workers with stale files", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const terminalWorkerId = randomUUID();
    const activeWorkerId = randomUUID();
    const freshTerminalWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: `vibes/ad-hoc/compaction-${planId}.md`,
      status: "done",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Compaction run",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values([
      {
        id: terminalWorkerId,
        runId,
        type: "claude",
        cwd: "/tmp",
        status: "completed",
        workerNumber: 1,
        title: "terminal",
        initialPrompt: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: activeWorkerId,
        runId,
        type: "claude",
        cwd: "/tmp",
        status: "working",
        workerNumber: 2,
        title: "active",
        initialPrompt: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: freshTerminalWorkerId,
        runId,
        type: "claude",
        cwd: "/tmp",
        status: "completed",
        workerNumber: 3,
        title: "fresh terminal",
        initialPrompt: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    for (const wId of [terminalWorkerId, activeWorkerId, freshTerminalWorkerId]) {
      await writeWorkerOutputEntries(runId, wId, [
        { type: "agent_message", text: `entry-${wId}` } as any,
      ]);
    }

    // Backdate the two we want to consider stale.
    const stale = new Date(Date.now() - 10 * 60 * 1000);
    await fs.utimes((await resolveWorkerOutputFilePaths(runId, terminalWorkerId)).filePath, stale, stale);
    await fs.utimes((await resolveWorkerOutputFilePaths(runId, activeWorkerId)).filePath, stale, stale);
    // Leave freshTerminalWorkerId mtime current.

    const { compacted } = await compactStaleWorkerOutputs();
    const compactedIds = compacted.map((c) => c.workerId);
    expect(compactedIds).toContain(terminalWorkerId);
    expect(compactedIds).not.toContain(activeWorkerId);
    expect(compactedIds).not.toContain(freshTerminalWorkerId);

    expect(existsSync((await resolveWorkerOutputFilePaths(runId, terminalWorkerId)).compressedFilePath)).toBe(true);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, activeWorkerId)).filePath)).toBe(true);
    expect(existsSync((await resolveWorkerOutputFilePaths(runId, freshTerminalWorkerId)).filePath)).toBe(true);

    // Still readable transparently after compaction.
    const restored = await readWorkerOutputEntries(runId, terminalWorkerId);
    expect((restored[0] as any).text).toBe(`entry-${terminalWorkerId}`);

    await cleanupRun(runId);
  });
});
