/**
 * Regression coverage for the transcript-head loss that silently truncated
 * runs e51514929b72 / e74cf7a81b7f / ef23fac96fdb / 1795ba24270e.
 *
 * The writer seeds its seq cursor from
 * `max(fileMaxSeq, artifact_streams.latest_seq) + 1`. When the stream file was
 * missing or empty while the DB cursor was already advanced, it resumed
 * numbering mid-stream and appended forward forever — the entries below that
 * seq were never written and the UI rendered the survivors as if the
 * conversation had started there.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { artifactStreams, plans, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { resolveArtifactStreamLocation } from "@/server/artifacts/append-only-store";
import {
  __resetOutputStoreCachesForTests,
  appendWorkerEntry,
  readWorkerOutputEntries,
} from "@/server/workers/output-store";

/**
 * The live stream lives under `<runId>/workers/<workerId>.jsonl`.
 * `workerOutputFilePathFor` reports the legacy flat path, which is NOT the file
 * the writer appends to — resolve the real one so these tests actually
 * reproduce the failure.
 */
async function streamFilePath(runId: string, workerId: string) {
  const location = await resolveArtifactStreamLocation(
    { runId, kind: "worker_entries", ownerId: workerId, projectPath: null },
    "read",
  );
  return location.filePath;
}

const cleanupPaths: string[] = [];
const seededRuns: Array<{ runId: string; workerId: string; planId: string }> = [];

afterEach(async () => {
  __resetOutputStoreCachesForTests();
  __resetNamedEventsForTests();
  // The runtime archive lives under the real cwd, so remove what we wrote.
  await Promise.all(cleanupPaths.splice(0).map((file) => fs.rm(file, { force: true })));
  // Drop seeded rows child-first; artifact_streams references runs, so leaving
  // them behind makes unrelated suites fail on a FK when they clear runs.
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
    id: workerId, runId, type: "claude", status: "working", cwd: process.cwd(),
    outputLog: "", outputEntriesJson: "[]", currentText: "", lastText: "", createdAt: now, updatedAt: now,
  });
  seededRuns.push({ runId, workerId, planId });
  return { runId, workerId };
}

async function appendMessages(runId: string, workerId: string, ids: string[]) {
  for (const id of ids) {
    await appendWorkerEntry(runId, workerId, {
      id,
      type: "message",
      text: `body-${id}`,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * The runtime's raw output archive — the source that survived the real
 * incident. Records are per-streaming-chunk, hence the split message below.
 */
async function writeRuntimeArchive(workerId: string, records: object[]) {
  const dir = path.join(process.cwd(), ".omniharness", "agent-runtime-output");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${workerId}.jsonl`);
  await fs.writeFile(file, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
  return file;
}

describe("stranded transcript head", () => {
  it("recovers the head from the runtime archive instead of resuming mid-stream", async () => {
    const { runId, workerId } = await seedRun();
    await appendMessages(runId, workerId, ["a", "b", "c"]);

    const filePath = await streamFilePath(runId, workerId);
    const before = await readWorkerOutputEntries(runId, workerId);
    expect(before.map((entry) => entry.seq)).toEqual([1, 2, 3]);

    // The runtime archive holds the same history, as streaming chunks.
    // "body-" + "a" are consecutive chunks of ONE message; the tool_call
    // between them and "body-b" is what ends a streaming run.
    const archiveFile = await writeRuntimeArchive(workerId, [
      { id: "a", type: "message", text: "body-", timestamp: "2026-01-01T00:00:00.000Z" },
      { id: "a2", type: "message", text: "a", timestamp: "2026-01-01T00:00:00.100Z" },
      { id: "t1", type: "tool_call", text: "Read", timestamp: "2026-01-01T00:00:00.500Z" },
      { id: "b", type: "message", text: "body-b", timestamp: "2026-01-01T00:00:01.000Z" },
      { id: "t2", type: "tool_call", text: "Edit", timestamp: "2026-01-01T00:00:01.500Z" },
      { id: "c", type: "message", text: "body-c", timestamp: "2026-01-01T00:00:02.000Z" },
    ]);
    cleanupPaths.push(archiveFile);

    // Reproduce the failure: the stream file is recreated empty (a fresh
    // artifact root, a lock-created placeholder, a racing migration) while
    // artifact_streams.latest_seq still says 3.
    __resetOutputStoreCachesForTests();
    await fs.writeFile(filePath, "", "utf8");

    await appendMessages(runId, workerId, ["d"]);

    const after = await readWorkerOutputEntries(runId, workerId);
    // The regression produced [4] here — a transcript starting mid-stream.
    expect(after[0]?.seq).toBe(1);
    // Seqs stay contiguous from 1 so the client can page back to the start.
    expect(after.map((entry) => entry.seq)).toEqual(after.map((_, index) => index + 1));
    // The head is back, and the new entry still landed.
    expect(after.map((entry) => entry.id)).toContain("d");
    expect(after.length).toBeGreaterThan(1);
    // Streaming chunks were rejoined rather than written one entry per chunk.
    expect(after.some((entry) => entry.text === "body-a")).toBe(true);
  });

  it("reports an unrecoverable head instead of silently stranding it", async () => {
    const { runId, workerId } = await seedRun();
    await appendMessages(runId, workerId, ["a", "b"]);

    const filePath = await streamFilePath(runId, workerId);
    __resetOutputStoreCachesForTests();
    // Empty file AND no fallback source holds the head.
    await fs.writeFile(filePath, "", "utf8");

    await appendMessages(runId, workerId, ["c"]);

    const after = await readWorkerOutputEntries(runId, workerId);
    // Numbering restarts at 1 rather than leaving a permanent phantom hole.
    expect(after[0]?.seq).toBe(1);

    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events.some((event) => event.kind === "worker.stream_head_unrecoverable")).toBe(true);
  });

  it("leaves healthy streams untouched", async () => {
    const { runId, workerId } = await seedRun();
    await appendMessages(runId, workerId, ["a", "b", "c"]);
    await appendMessages(runId, workerId, ["d"]);

    const after = await readWorkerOutputEntries(runId, workerId);
    expect(after.map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events.some((event) => event.kind.startsWith("worker.stream_head_"))).toBe(false);
  });
});
