/**
 * Regression coverage for the transcript hole in session 9d1e7dd343df.
 *
 * The runtime keeps only the newest ~80 entries live. A Codex /goal ran turns
 * for 8h47m while no sync persisted them; when one finally did, it appended
 * just the live window, so the stream jumped from 07:41 to 16:28 with nothing
 * in between, though the runtime archive held all of it.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { artifactStreams, plans, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { readArtifactStreamMetadata } from "@/server/artifacts/stream-metadata";
import {
  __resetOutputStoreCachesForTests,
  appendWorkerEntry,
  backfillWorkerStreamGapFromArchive,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

const cleanupPaths: string[] = [];
const seededRuns: Array<{ runId: string; workerId: string; planId: string }> = [];

afterEach(async () => {
  __resetOutputStoreCachesForTests();
  __resetNamedEventsForTests();
  await Promise.all(cleanupPaths.splice(0).map((file) => fs.rm(file, { force: true })));
  for (const { runId, workerId, planId } of seededRuns.splice(0)) {
    await db.delete(artifactStreams).where(eq(artifactStreams.runId, runId));
    await db.delete(workers).where(eq(workers.id, workerId));
    await db.delete(runs).where(eq(runs.id, runId));
    await db.delete(plans).where(eq(plans.id, planId));
  }
});

async function seedRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const now = new Date();
  await db.insert(plans).values({ id: planId, path: `docs/test/${planId}.md`, status: "running", createdAt: now, updatedAt: now });
  await db.insert(runs).values({ id: runId, planId, mode: "direct", status: "running", createdAt: now, updatedAt: now });
  await db.insert(workers).values({
    id: workerId, runId, type: "codex", status: "working", cwd: process.cwd(),
    outputLog: "", outputEntriesJson: "[]", currentText: "", lastText: "", createdAt: now, updatedAt: now,
  });
  seededRuns.push({ runId, workerId, planId });
  return { runId, workerId };
}

function entry(id: string, type = "tool_call") {
  return { id, type, text: `body-${id}`, timestamp: "2026-10-01T05:41:00.000Z" };
}

async function writeRuntimeArchive(workerId: string, ids: string[]) {
  const dir = path.join(process.cwd(), ".omniharness", "agent-runtime-output");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${workerId}.jsonl`);
  await fs.writeFile(file, ids.map((id) => JSON.stringify(entry(id))).join("\n") + "\n", "utf8");
  cleanupPaths.push(file);
}

const archiveMarker = {
  id: "output-archive-marker",
  type: "message",
  text: "3 older raw worker activity records are only in archived history, not in the current terminal output.",
  timestamp: "2026-10-01T05:41:00.000Z",
  status: "archived",
};

describe("worker stream gaps", () => {
  it("backfills entries that rolled out of the live window unsaved, in order, before the live window", async () => {
    const { runId, workerId } = await seedRun();
    await writeWorkerOutputEntries(runId, workerId, [entry("a"), entry("b")]);
    await writeRuntimeArchive(workerId, ["a", "b", "gap-1", "gap-2", "gap-3", "live-1", "live-2"]);

    await writeWorkerOutputEntries(runId, workerId, [archiveMarker, entry("live-1"), entry("live-2")]);

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((item) => item.id)).toEqual(["a", "b", "gap-1", "gap-2", "gap-3", "live-1", "live-2"]);
    expect(entries.map((item) => item.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getNamedEventsSince(0).events.map((item) => item.event)).toContainEqual(expect.objectContaining({
      kind: "worker.stream_gap_backfilled",
      runId,
      workerId,
      recoveredEntries: 3,
    }));
  });

  it("does not consult the archive when the live window overlaps what is saved", async () => {
    const { runId, workerId } = await seedRun();
    await writeWorkerOutputEntries(runId, workerId, [entry("a"), entry("b")]);
    // An archive that would inject "stray" if it were read.
    await writeRuntimeArchive(workerId, ["stray", "a", "b", "c"]);

    await writeWorkerOutputEntries(runId, workerId, [archiveMarker, entry("b"), entry("c")]);

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("reports a hole the archive cannot place instead of hiding it", async () => {
    const { runId, workerId } = await seedRun();
    await writeWorkerOutputEntries(runId, workerId, [entry("a")]);
    await writeRuntimeArchive(workerId, ["a"]);

    await writeWorkerOutputEntries(runId, workerId, [archiveMarker, entry("live-1")]);

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((item) => item.id)).toEqual(["a", "live-1"]);
    expect(getNamedEventsSince(0).events.map((item) => item.event)).toContainEqual(expect.objectContaining({
      kind: "worker.stream_gap_unrecoverable",
      runId,
      workerId,
      reason: "live_entry_not_archived",
    }));
  });

  it("repairs a hole already written mid-stream and moves later entries after it", async () => {
    const { runId, workerId } = await seedRun();
    for (const id of ["a", "b", "live-1", "live-2"]) {
      await appendWorkerEntry(runId, workerId, entry(id));
    }
    await writeRuntimeArchive(workerId, ["a", "b", "gap-1", "gap-2", "live-1", "live-2"]);

    const dryRun = await backfillWorkerStreamGapFromArchive(runId, workerId, 2, { dryRun: true });
    expect(dryRun).toEqual({ inserted: 2, latestSeq: 4 });
    expect((await readWorkerOutputEntries(runId, workerId)).map((item) => item.id)).toEqual(["a", "b", "live-1", "live-2"]);

    const result = await backfillWorkerStreamGapFromArchive(runId, workerId, 2);
    expect(result).toEqual({ inserted: 2, latestSeq: 6 });

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((item) => item.id)).toEqual(["a", "b", "gap-1", "gap-2", "live-1", "live-2"]);
    expect(entries.map((item) => item.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    const metadata = await readArtifactStreamMetadata({ runId, kind: "worker_entries", ownerId: workerId });
    expect(metadata?.latestSeq).toBe(6);

    // The writer resumes numbering after the repaired tail.
    await appendWorkerEntry(runId, workerId, entry("next"));
    expect((await readWorkerOutputEntries(runId, workerId)).at(-1)).toEqual(expect.objectContaining({ id: "next", seq: 7 }));
  });
});
