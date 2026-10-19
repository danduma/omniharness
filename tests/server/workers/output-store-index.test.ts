import { promises as fs } from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { getAppDataPath } from "@/server/app-root";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  __drainWorkerIndexRebuildsForTests,
  __resetOutputStoreCachesForTests,
  readWorkerEntriesSince,
  readWorkerEntriesTail,
  workerOutputFilePathFor,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

// The sparse seq→offset index bounds every incremental transcript read. A
// stale index once made each poll of a 25MB transcript parse 12.5MB from
// its single surviving index point — fast with free RAM, a multi-minute
// event-loop stall under memory pressure. These tests pin the invariant:
// an index is either current and accurate, or it is not used.

type BridgeEntry = NonNullable<Parameters<typeof writeWorkerOutputEntries>[2]>[number];

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function cleanupRun(runId: string) {
  await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
}

afterEach(() => {
  __resetOutputStoreCachesForTests();
  __resetNamedEventsForTests();
});

/** Write a seq'd transcript directly and return the byte offset of each seq's line. */
async function writeFixture(runId: string, workerId: string, count: number): Promise<Map<number, number>> {
  const filePath = workerOutputFilePathFor(runId, workerId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const offsets = new Map<number, number>();
  let cursor = 0;
  const lines: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const line = JSON.stringify({
      id: `e-${i}`,
      seq: i,
      type: "message",
      text: `m${i}`,
      timestamp: new Date(1700000000000 + i).toISOString(),
    });
    offsets.set(i, cursor);
    cursor += Buffer.byteLength(line, "utf8") + 1;
    lines.push(line);
  }
  await fs.writeFile(filePath, lines.join("\n") + "\n", "utf8");
  return offsets;
}

async function writeIndexFile(runId: string, workerId: string, points: Array<{ seq: number; offset: number }>) {
  const idxPath = `${workerOutputFilePathFor(runId, workerId)}.idx`;
  await fs.writeFile(idxPath, points.map((point) => `${JSON.stringify(point)}\n`).join(""), "utf8");
}

async function readIndexPoints(runId: string, workerId: string) {
  const filePath = workerOutputFilePathFor(runId, workerId);
  const body = await fs.readFile(`${filePath}.idx`, "utf8");
  return body.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { seq: number; offset: number });
}

async function expectIndexPointsAccurate(runId: string, workerId: string) {
  const filePath = workerOutputFilePathFor(runId, workerId);
  const fileBytes = await fs.readFile(filePath);
  const points = await readIndexPoints(runId, workerId);
  for (const point of points) {
    const newlineIdx = fileBytes.indexOf(0x0a, point.offset);
    const line = fileBytes.subarray(point.offset, newlineIdx === -1 ? fileBytes.length : newlineIdx).toString("utf8");
    expect((JSON.parse(line) as { seq: number }).seq).toBe(point.seq);
  }
  return points;
}

function indexRebuildEvents() {
  return getNamedEventsSince(0).events
    .map((entry) => entry.event)
    .filter((event) => event.kind === "worker.stream_index_rebuilt");
}

describe("worker stream index maintenance", () => {
  it("writes index points from batch appends with accurate offsets", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      // Odd batch size so index points land mid-batch, not on batch edges.
      for (let start = 0; start < 250; start += 37) {
        const batch: BridgeEntry[] = [];
        for (let i = start; i < Math.min(start + 37, 250); i += 1) {
          batch.push({ id: `b-${i}`, type: "message", text: `m${i}`, timestamp: new Date(1700000000000 + i).toISOString() } as BridgeEntry);
        }
        await writeWorkerOutputEntries(runId, workerId, batch);
      }
      const points = await expectIndexPointsAccurate(runId, workerId);
      expect(points.map((point) => point.seq)).toEqual([100, 200]);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("does not seek from a stale index point and rebuilds the index", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const offsets = await writeFixture(runId, workerId, 2_000);
      await writeIndexFile(runId, workerId, [{ seq: 100, offset: offsets.get(100)! }]);

      const first = await readWorkerEntriesSince(runId, workerId, 1_995);
      expect(first.entries.map((entry) => entry.seq)).toEqual([1996, 1997, 1998, 1999, 2000]);
      expect(first.latestSeq).toBe(2000);
      expect(first._path).not.toBe("jsonl.indexSeek");

      await __drainWorkerIndexRebuildsForTests();
      const points = await expectIndexPointsAccurate(runId, workerId);
      expect(points).toHaveLength(20);
      expect(indexRebuildEvents()).toEqual([
        expect.objectContaining({ runId, workerId, reason: "stale_index", indexPoints: 20 }),
      ]);

      const second = await readWorkerEntriesSince(runId, workerId, 1_995);
      expect(second.entries.map((entry) => entry.seq)).toEqual([1996, 1997, 1998, 1999, 2000]);
      expect(second._path).toBe("jsonl.indexSeek");
    } finally {
      await cleanupRun(runId);
    }
  });

  it("rejects an index point whose offset holds a different seq", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const offsets = await writeFixture(runId, workerId, 2_000);
      // Seq 1900's point records seq 1950's offset — the shape a whole-file
      // rewrite leaves behind. Seeking there would silently skip 1921–1950.
      await writeIndexFile(runId, workerId, [
        { seq: 1800, offset: offsets.get(1800)! },
        { seq: 1900, offset: offsets.get(1950)! },
      ]);

      const result = await readWorkerEntriesSince(runId, workerId, 1_920);
      expect(result.entries.map((entry) => entry.seq)).toEqual(
        Array.from({ length: 80 }, (_, i) => 1921 + i),
      );

      await __drainWorkerIndexRebuildsForTests();
      expect(indexRebuildEvents()).toEqual([
        expect.objectContaining({ runId, workerId, reason: "index_mismatch" }),
      ]);
      await expectIndexPointsAccurate(runId, workerId);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("does not read the latest page from a stale index", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const offsets = await writeFixture(runId, workerId, 2_000);
      await writeIndexFile(runId, workerId, Array.from({ length: 10 }, (_, i) => ({
        seq: (i + 1) * 100,
        offset: offsets.get((i + 1) * 100)!,
      })));

      const tail = await readWorkerEntriesTail(runId, workerId, 5);
      expect(tail?.entries.map((entry) => entry.seq)).toEqual([1996, 1997, 1998, 1999, 2000]);
      expect(tail?.latestSeq).toBe(2000);

      await __drainWorkerIndexRebuildsForTests();
      expect(indexRebuildEvents()).toEqual([
        expect.objectContaining({ runId, workerId, reason: "stale_index", indexPoints: 20 }),
      ]);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("rebuilds a missing index for a long transcript", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeFixture(runId, workerId, 2_000);

      const result = await readWorkerEntriesSince(runId, workerId, 1_998);
      expect(result.entries.map((entry) => entry.seq)).toEqual([1999, 2000]);

      await __drainWorkerIndexRebuildsForTests();
      expect(indexRebuildEvents()).toEqual([
        expect.objectContaining({ runId, workerId, reason: "missing_index", indexPoints: 20 }),
      ]);
      await expectIndexPointsAccurate(runId, workerId);
    } finally {
      await cleanupRun(runId);
    }
  });
});
