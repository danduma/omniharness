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
  workerOutputFilePathFor,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function cleanupRun(runId: string) {
  await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
}

describe("workers/output-store compaction lifecycle", () => {
  it("compactRunOutputs gzips per-worker files and reads stay transparent", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    const entries = [
      { type: "agent_message", text: "hello" } as any,
      { type: "agent_message", text: "world" } as any,
    ];

    await writeWorkerOutputEntries(runId, workerId, entries);
    expect(existsSync(workerOutputFilePathFor(runId, workerId))).toBe(true);

    const result = await compactRunOutputs(runId);
    expect(result.compactedWorkerIds).toEqual([workerId]);
    expect(existsSync(workerOutputFilePathFor(runId, workerId))).toBe(false);
    expect(existsSync(`${workerOutputFilePathFor(runId, workerId)}.gz`)).toBe(true);

    const readBack = await readWorkerOutputEntries(runId, workerId);
    expect(readBack.map((e) => (e as any).text)).toEqual(["hello", "world"]);

    await cleanupRun(runId);
  });

  it("write auto-expands the compressed file so a resumed worker can keep emitting", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    await writeWorkerOutputEntries(runId, workerId, [
      { type: "agent_message", text: "before" } as any,
    ]);
    await compactRunOutputs(runId);
    expect(existsSync(`${workerOutputFilePathFor(runId, workerId)}.gz`)).toBe(true);

    await writeWorkerOutputEntries(runId, workerId, [
      { type: "agent_message", text: "after-resume" } as any,
    ]);
    expect(existsSync(workerOutputFilePathFor(runId, workerId))).toBe(true);
    expect(existsSync(`${workerOutputFilePathFor(runId, workerId)}.gz`)).toBe(false);

    const final = await readWorkerOutputEntries(runId, workerId);
    expect(final.map((e) => (e as any).text)).toEqual(["after-resume"]);

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
    await fs.utimes(workerOutputFilePathFor(runId, terminalWorkerId), stale, stale);
    await fs.utimes(workerOutputFilePathFor(runId, activeWorkerId), stale, stale);
    // Leave freshTerminalWorkerId mtime current.

    const { compacted } = await compactStaleWorkerOutputs();
    const compactedIds = compacted.map((c) => c.workerId);
    expect(compactedIds).toContain(terminalWorkerId);
    expect(compactedIds).not.toContain(activeWorkerId);
    expect(compactedIds).not.toContain(freshTerminalWorkerId);

    expect(existsSync(`${workerOutputFilePathFor(runId, terminalWorkerId)}.gz`)).toBe(true);
    expect(existsSync(workerOutputFilePathFor(runId, activeWorkerId))).toBe(true);
    expect(existsSync(workerOutputFilePathFor(runId, freshTerminalWorkerId))).toBe(true);

    // Still readable transparently after compaction.
    const restored = await readWorkerOutputEntries(runId, terminalWorkerId);
    expect((restored[0] as any).text).toBe(`entry-${terminalWorkerId}`);

    await cleanupRun(runId);
  });
});
