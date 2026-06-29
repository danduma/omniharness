import { promises as fs } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppDataPath } from "@/server/app-root";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  __getOutputStoreCacheStatsForTests,
  __resetOutputStoreCachesForTests,
  appendWorkerEntry,
  compactWorkerOutputFile,
  readWorkerEntriesSince,
  readWorkerLatestSeq,
  readWorkerOutputEntries,
  workerOutputFilePathFor,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";

type BridgeEntry = NonNullable<Parameters<typeof writeWorkerOutputEntries>[2]>[number];
type PersistedEntryShape = { id: string; text: string; seq: number };

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

describe("appendWorkerEntry", () => {
  it("assigns monotonically increasing seqs", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const a = await appendWorkerEntry(runId, workerId, {
        id: "a", type: "message", text: "hi", timestamp: "2026-01-01T00:00:00.000Z",
      });
      const b = await appendWorkerEntry(runId, workerId, {
        id: "b", type: "thought", text: "hmm", timestamp: "2026-01-01T00:00:01.000Z",
      });
      const c = await appendWorkerEntry(runId, workerId, {
        id: "c", type: "user_input", text: "go", timestamp: "2026-01-01T00:00:02.000Z", authorRole: "user",
      });
      expect(a.seq).toBe(1);
      expect(b.seq).toBe(2);
      expect(c.seq).toBe(3);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("deduplicates by id — repeated append is a no-op", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await appendWorkerEntry(runId, workerId, {
        id: "dup", type: "message", text: "once", timestamp: "2026-01-01T00:00:00.000Z",
      });
      await appendWorkerEntry(runId, workerId, {
        id: "dup", type: "message", text: "again", timestamp: "2026-01-01T00:00:01.000Z",
      });
      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all).toHaveLength(1);
      expect((all[0] as any).text).toBe("once");
    } finally {
      await cleanupRun(runId);
    }
  });

  it("recovers an ownerless worker output lock directory", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const filePath = workerOutputFilePathFor(runId, workerId);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, "", "utf8");
      await fs.mkdir(`${filePath}.lock`, { recursive: true });

      const entry = await appendWorkerEntry(runId, workerId, {
        id: "after-ownerless-lock",
        type: "message",
        text: "recovered",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(entry.seq).toBe(1);
      await expect(fs.stat(`${filePath}.lock`)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await cleanupRun(runId);
    }
  });

  it("retries when owner metadata hits a transient invalid lock path", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const filePath = workerOutputFilePathFor(runId, workerId);
      let failedOwnerWrite = false;
      const originalWriteFile = fs.writeFile.bind(fs);
      vi.spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
        const target = String(args[0]);
        if (!failedOwnerWrite && target === `${filePath}.lock/owner.json`) {
          failedOwnerWrite = true;
          const error = Object.assign(new Error(`EINVAL: invalid argument, open '${target}'`), {
            code: "EINVAL",
            path: target,
          });
          throw error;
        }
        return originalWriteFile(...args);
      });

      const entry = await appendWorkerEntry(runId, workerId, {
        id: "after-owner-write-race",
        type: "message",
        text: "recovered",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(failedOwnerWrite).toBe(true);
      expect(entry.seq).toBe(1);
      await expect(fs.stat(`${filePath}.lock`)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      vi.restoreAllMocks();
      await cleanupRun(runId);
    }
  });

  it("serializes concurrent appends through the per-worker chain", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const promises = Array.from({ length: 50 }, (_, i) =>
        appendWorkerEntry(runId, workerId, {
          id: `e-${i}`, type: "message", text: `m${i}`, timestamp: new Date(1700000000000 + i).toISOString(),
        }),
      );
      const persisted = await Promise.all(promises);
      const seqs = persisted.map((p) => p.seq).sort((a, b) => a - b);
      expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all).toHaveLength(50);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("survives a simulated crash that truncated the last line", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await appendWorkerEntry(runId, workerId, {
        id: "a", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z",
      });
      await appendWorkerEntry(runId, workerId, {
        id: "b", type: "message", text: "two", timestamp: "2026-01-01T00:00:01.000Z",
      });

      // Simulate a partial-line crash by appending half a JSON line.
      const filePath = workerOutputFilePathFor(runId, workerId);
      await fs.appendFile(filePath, "{\"id\":\"c\",\"seq\":3,\"type\":\"messa");

      // Drop in-memory state so the next writer rebuilds from disk.
      __resetOutputStoreCachesForTests();

      const next = await appendWorkerEntry(runId, workerId, {
        id: "d", type: "message", text: "after-crash", timestamp: "2026-01-01T00:00:02.000Z",
      });
      // Truncated line is skipped; next seq picks up from max valid seq + 1 = 3.
      expect(next.seq).toBe(3);

      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all.map((e) => (e as any).text)).toEqual(["one", "two", "after-crash"]);
    } finally {
      await cleanupRun(runId);
    }
  });
});

describe("readWorkerEntriesSince", () => {
  it("returns entries strictly after the given seq, with latestSeq", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      for (let i = 0; i < 5; i += 1) {
        await appendWorkerEntry(runId, workerId, {
          id: `e-${i}`, type: "message", text: `m${i}`, timestamp: new Date(1700000000000 + i).toISOString(),
        });
      }

      const all = await readWorkerEntriesSince(runId, workerId, 0);
      expect(all.entries).toHaveLength(5);
      expect(all.latestSeq).toBe(5);

      const tail = await readWorkerEntriesSince(runId, workerId, 3);
      expect(tail.entries.map((e) => e.seq)).toEqual([4, 5]);
      expect(tail.latestSeq).toBe(5);

      const empty = await readWorkerEntriesSince(runId, workerId, 5);
      expect(empty.entries).toEqual([]);
      expect(empty.latestSeq).toBe(5);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("writes a sparse seq→offset index every INDEX_CADENCE records on append", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      // Append 250 entries — at INDEX_CADENCE=100 we expect index points for
      // seqs 100 and 200, and the line at each indexed offset must parse
      // back to that seq.
      for (let i = 0; i < 250; i += 1) {
        await appendWorkerEntry(runId, workerId, {
          id: `e-${i}`,
          type: "message",
          text: `m${i}`,
          timestamp: new Date(1700000000000 + i).toISOString(),
        });
      }
      const filePath = workerOutputFilePathFor(runId, workerId);
      const idxPath = `${filePath}.idx`;
      const body = await fs.readFile(idxPath, "utf8");
      const points = body.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { seq: number; offset: number });
      expect(points.map((p) => p.seq)).toEqual([100, 200]);

      const fileBytes = await fs.readFile(filePath);
      for (const point of points) {
        // Slice from the index offset to the next newline and confirm the
        // line decodes to a record at the indexed seq.
        const newlineIdx = fileBytes.indexOf(0x0a, point.offset);
        const lineEnd = newlineIdx === -1 ? fileBytes.length : newlineIdx;
        const line = fileBytes.subarray(point.offset, lineEnd).toString("utf8");
        const parsed = JSON.parse(line) as { seq: number };
        expect(parsed.seq).toBe(point.seq);
      }

      // A tail read should still produce the correct entries; this exercises
      // the index-seek path in readWorkerEntriesSince.
      const tail = await readWorkerEntriesSince(runId, workerId, 245);
      expect(tail.entries.map((e) => e.seq)).toEqual([246, 247, 248, 249, 250]);
      expect(tail.latestSeq).toBe(250);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("serves incremental reads from the JSONL tail", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const dir = path.dirname(workerOutputFilePathFor(runId, workerId));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(workerOutputFilePathFor(runId, workerId), Array.from({ length: 2_000 }, (_, i) => (
        JSON.stringify({
          id: `e-${i}`,
          seq: i + 1,
          type: "message",
          text: `m${i}`,
          timestamp: new Date(1700000000000 + i).toISOString(),
        })
      )).join("\n") + "\n", "utf8");

      const tail = await readWorkerEntriesSince(runId, workerId, 1_995);

      expect(tail.entries.map((entry) => entry.seq)).toEqual([1996, 1997, 1998, 1999, 2000]);
      expect(tail.latestSeq).toBe(2000);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("backfills virtual seqs on a legacy file with no seq fields", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const dir = path.dirname(workerOutputFilePathFor(runId, workerId));
      await fs.mkdir(dir, { recursive: true });
      const filePath = workerOutputFilePathFor(runId, workerId);
      // Legacy: no seq, no id.
      const legacy = [
        JSON.stringify({ type: "message", text: "legacy-1", timestamp: "2026-01-01T00:00:00.000Z" }),
        JSON.stringify({ type: "message", text: "legacy-2", timestamp: "2026-01-01T00:00:01.000Z" }),
      ].join("\n") + "\n";
      await fs.writeFile(filePath, legacy, "utf8");

      const result = await readWorkerEntriesSince(runId, workerId, 0);
      expect(result.entries.map((e) => e.seq)).toEqual([1, 2]);
      expect(result.latestSeq).toBe(2);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("keeps mixed legacy and newly appended entries in file order", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const dir = path.dirname(workerOutputFilePathFor(runId, workerId));
      await fs.mkdir(dir, { recursive: true });
      const filePath = workerOutputFilePathFor(runId, workerId);
      const legacy = [
        JSON.stringify({ type: "message", text: "legacy-1", timestamp: "2026-01-01T00:00:00.000Z" }),
        JSON.stringify({ type: "message", text: "legacy-2", timestamp: "2026-01-01T00:00:01.000Z" }),
      ].join("\n") + "\n";
      await fs.writeFile(filePath, legacy, "utf8");

      __resetOutputStoreCachesForTests();
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "new", type: "message", text: "new", timestamp: "2026-01-01T00:00:02.000Z" } as any,
      ]);

      const result = await readWorkerEntriesSince(runId, workerId, 0);
      expect(result.entries.map((entry) => entry.text)).toEqual(["legacy-1", "legacy-2", "new"]);
      expect(result.entries.map((entry) => entry.seq)).toEqual([1, 2, 3]);
      expect(result.latestSeq).toBe(3);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("normalizes an already-corrupted stream with duplicate persisted ids", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const dir = path.dirname(workerOutputFilePathFor(runId, workerId));
      await fs.mkdir(dir, { recursive: true });
      const filePath = workerOutputFilePathFor(runId, workerId);
      const duplicate = { id: "dup", type: "message", text: "one", seq: 1, timestamp: "2026-01-01T00:00:00.000Z" };
      await fs.writeFile(filePath, [
        JSON.stringify(duplicate),
        JSON.stringify(duplicate),
        JSON.stringify({ id: "next", type: "message", text: "two", seq: 2, timestamp: "2026-01-01T00:00:01.000Z" }),
      ].join("\n") + "\n", "utf8");

      const result = await readWorkerEntriesSince(runId, workerId, 0);
      expect(result.entries.map((entry) => ({ id: entry.id, text: entry.text, seq: entry.seq }))).toEqual([
        { id: "dup", text: "one", seq: 1 },
        { id: "next", text: "two", seq: 2 },
      ]);
      expect(result.latestSeq).toBe(2);
    } finally {
      await cleanupRun(runId);
    }
  });
});

describe("readWorkerLatestSeq", () => {
  it("reads the latest seq from the JSONL tail without returning entries", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      for (let i = 0; i < 5; i += 1) {
        await appendWorkerEntry(runId, workerId, {
          id: `e-${i}`, type: "message", text: `m${i}`, timestamp: new Date(1700000000000 + i).toISOString(),
        });
      }

      await expect(readWorkerLatestSeq(runId, workerId)).resolves.toBe(5);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("falls back for legacy files without seq fields", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const dir = path.dirname(workerOutputFilePathFor(runId, workerId));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(workerOutputFilePathFor(runId, workerId), [
        JSON.stringify({ type: "message", text: "legacy-1", timestamp: "2026-01-01T00:00:00.000Z" }),
        JSON.stringify({ type: "message", text: "legacy-2", timestamp: "2026-01-01T00:00:01.000Z" }),
      ].join("\n") + "\n", "utf8");

      await expect(readWorkerLatestSeq(runId, workerId)).resolves.toBe(2);
    } finally {
      await cleanupRun(runId);
    }
  });
});

describe("compaction interaction with appends", () => {
  it("preserves every entry under interleaved appends and compaction sweeps", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      const totalAppends = 100;
      const ops: Array<Promise<unknown>> = [];
      for (let i = 0; i < totalAppends; i += 1) {
        ops.push(appendWorkerEntry(runId, workerId, {
          id: `e-${i}`,
          type: "message",
          text: `m${i}`,
          timestamp: new Date(1700000000000 + i).toISOString(),
        }));
        if (i % 17 === 0) {
          ops.push(compactWorkerOutputFile(runId, workerId));
        }
      }
      await Promise.all(ops);

      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all).toHaveLength(totalAppends);
      const seqs = all.map((entry) => (entry as any).seq).sort((a, b) => a - b);
      expect(seqs[0]).toBe(1);
      expect(seqs[totalAppends - 1]).toBe(totalAppends);
    } finally {
      await cleanupRun(runId);
    }
  });
});

describe("stream writer wake events", () => {
  it("does not re-emit worker.entry_appended for duplicate stable entries", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await appendUserInputOnDelivery({
        id: "message-1",
        runId,
        workerId,
        text: "Initial prompt",
        deliveredAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await appendUserInputOnDelivery({
        id: "message-1",
        runId,
        workerId,
        text: "Initial prompt",
        deliveredAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const events = getNamedEventsSince(0).events
        .map((entry) => entry.event)
        .filter((event) => event.kind === "worker.entry_appended");
      expect(events.map((event) => event.seq)).toEqual([1]);
    } finally {
      await cleanupRun(runId);
    }
  });
});

describe("writeWorkerOutputEntries (diff-and-append)", () => {
  it("emits worker entry wake events for appended bridge entries", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "a", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } as any,
        { id: "b", type: "message", text: "two", timestamp: "2026-01-01T00:00:01.000Z" } as any,
      ]);

      const events = getNamedEventsSince(0).events
        .map((entry) => entry.event)
        .filter((event) => event.kind === "worker.entry_appended");
      expect(events.map((event) => ({
        runId: event.runId,
        workerId: event.workerId,
        seq: event.seq,
      }))).toEqual([
        { runId, workerId, seq: 1 },
        { runId, workerId, seq: 2 },
      ]);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("does not re-add an entry with the same id", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "a", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } as any,
        { id: "b", type: "message", text: "two", timestamp: "2026-01-01T00:00:01.000Z" } as any,
      ]);
      // Same snapshot replayed (e.g. another bridge poll) — no duplicates.
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "a", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } as any,
        { id: "b", type: "message", text: "two", timestamp: "2026-01-01T00:00:01.000Z" } as any,
        { id: "c", type: "message", text: "three", timestamp: "2026-01-01T00:00:02.000Z" } as any,
      ]);
      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all.map((e) => (e as any).id)).toEqual(["a", "b", "c"]);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("does not rebuild the full worker transcript cache on every streaming append", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      for (let i = 0; i < 5; i += 1) {
        await writeWorkerOutputEntries(runId, workerId, [
          { id: `entry-${i}`, type: "message", text: `chunk ${i}`, timestamp: new Date(1700000000000 + i).toISOString() } as any,
        ]);
      }

      const stats = __getOutputStoreCacheStatsForTests();
      expect(stats.workerCacheCount).toBe(1);
      expect(stats.diskRefreshCount).toBe(1);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("deduplicates exact repeated entries inside a single bridge snapshot", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "dup", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } as any,
        { id: "dup", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } as any,
        { id: "next", type: "message", text: "two", timestamp: "2026-01-01T00:00:02.000Z" } as any,
      ]);
      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all.map((e) => ({ id: (e as any).id, text: (e as any).text, seq: (e as any).seq }))).toEqual([
        { id: "dup", text: "one", seq: 1 },
        { id: "next", text: "two", seq: 2 },
      ]);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("appends changed bridge message revisions so streaming prose can expand", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "msg", type: "message", text: "One", timestamp: "2026-01-01T00:00:00.000Z" } satisfies BridgeEntry,
      ]);
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "msg", type: "message", text: "One more useful detail arrived after the first token.", timestamp: "2026-01-01T00:00:01.000Z" } satisfies BridgeEntry,
      ]);

      const all = await readWorkerOutputEntries(runId, workerId);
      expect(all.map((e) => {
        const entry = e as PersistedEntryShape;
        return { id: entry.id, text: entry.text, seq: entry.seq };
      })).toEqual([
        { id: "msg", text: "One", seq: 1 },
        { id: "msg", text: "One more useful detail arrived after the first token.", seq: 2 },
      ]);

      const events = getNamedEventsSince(0).events
        .map((entry) => entry.event)
        .filter((event) => event.kind === "worker.entry_appended");
      expect(events.map((event) => event.seq)).toEqual([1, 2]);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("refreshes from disk before appending when another writer beat the local cache", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, workerId, [
        { id: "a", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } satisfies BridgeEntry,
        { id: "b", type: "message", text: "two", timestamp: "2026-01-01T00:00:01.000Z" } satisfies BridgeEntry,
      ]);
      expect(__getOutputStoreCacheStatsForTests().diskRefreshCount).toBe(1);

      const filePath = workerOutputFilePathFor(runId, workerId);
      await fs.appendFile(filePath, JSON.stringify({
        id: "c",
        type: "message",
        text: "three",
        seq: 3,
        timestamp: "2026-01-01T00:00:02.000Z",
      }) + "\n", "utf8");

      await writeWorkerOutputEntries(runId, workerId, [
        { id: "a", type: "message", text: "one", timestamp: "2026-01-01T00:00:00.000Z" } satisfies BridgeEntry,
        { id: "b", type: "message", text: "two", timestamp: "2026-01-01T00:00:01.000Z" } satisfies BridgeEntry,
        { id: "c", type: "message", text: "three replayed", timestamp: "2026-01-01T00:00:02.000Z" } satisfies BridgeEntry,
        { id: "d", type: "message", text: "four", timestamp: "2026-01-01T00:00:03.000Z" } satisfies BridgeEntry,
      ]);
      expect(__getOutputStoreCacheStatsForTests().diskRefreshCount).toBe(2);

      const raw = (await fs.readFile(filePath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(raw.map((entry) => ({ id: entry.id, text: entry.text, seq: entry.seq }))).toEqual([
        { id: "a", text: "one", seq: 1 },
        { id: "b", text: "two", seq: 2 },
        { id: "c", text: "three", seq: 3 },
        { id: "c", text: "three replayed", seq: 4 },
        { id: "d", text: "four", seq: 5 },
      ]);
    } finally {
      await cleanupRun(runId);
    }
  });
});

describe("output-store cache memory bounds", () => {
  // Regression: under supervisor load with many workers, the per-(run,worker)
  // module-level Maps in output-store grew without bound. These tests pin
  // the LRU caps so a memory regression fails CI instead of OOMing prod.
  it("bounds readEntriesByKey to 32 chains across many workers", async () => {
    const runId = uniqueId("run");
    const workerIds: string[] = [];
    try {
      for (let i = 0; i < 80; i += 1) {
        const workerId = uniqueId(`w-${i}`);
        workerIds.push(workerId);
        await appendWorkerEntry(runId, workerId, {
          id: `seed-${i}`,
          type: "message",
          text: `m${i}`,
          timestamp: new Date(1700000000000 + i).toISOString(),
        });
        // readWorkerEntriesSince is what populates readEntriesByKey.
        await readWorkerEntriesSince(runId, workerId, 0);
      }
      const stats = __getOutputStoreCacheStatsForTests();
      expect(stats.readEntriesCacheCount).toBeLessThanOrEqual(32);
    } finally {
      await Promise.all(workerIds.map(() => cleanupRun(runId)));
    }
  });

  it("bounds seenIds/fingerprints/nextSeq chain caches to 64 across many workers", async () => {
    const runId = uniqueId("run");
    const workerIds: string[] = [];
    try {
      for (let i = 0; i < 120; i += 1) {
        const workerId = uniqueId(`cw-${i}`);
        workerIds.push(workerId);
        // appendWorkerEntry is what populates the write-side chain caches.
        await appendWorkerEntry(runId, workerId, {
          id: `seed-${i}`,
          type: "message",
          text: `m${i}`,
          timestamp: new Date(1700000000000 + i).toISOString(),
        });
      }
      const stats = __getOutputStoreCacheStatsForTests();
      expect(stats.workerCacheCount).toBeLessThanOrEqual(64);
      expect(stats.seenIdsCacheCount).toBeLessThanOrEqual(64);
      expect(stats.fingerprintsCacheCount).toBeLessThanOrEqual(64);
    } finally {
      await cleanupRun(runId);
    }
  });

  it("LRU keeps the most-recently-used chain resident under hot-cold interleaving", async () => {
    const runId = uniqueId("run");
    const hotWorkerId = uniqueId("hot");
    try {
      // Seed the hot worker first.
      await appendWorkerEntry(runId, hotWorkerId, {
        id: "hot-seed",
        type: "message",
        text: "hot",
        timestamp: new Date(1700000000000).toISOString(),
      });
      // Spam many cold workers — more than the 64-key cap.
      for (let i = 0; i < 100; i += 1) {
        const coldId = uniqueId(`cold-${i}`);
        await appendWorkerEntry(runId, coldId, {
          id: `cold-${i}`,
          type: "message",
          text: `c${i}`,
          timestamp: new Date(1700000001000 + i).toISOString(),
        });
        // Touch hot worker every 5 iterations so it stays MRU.
        if (i % 5 === 0) {
          await appendWorkerEntry(runId, hotWorkerId, {
            id: `hot-${i}`,
            type: "message",
            text: `still hot ${i}`,
            timestamp: new Date(1700000002000 + i).toISOString(),
          });
        }
      }
      // The hot worker must still be cached — its append should hit the
      // cache (no disk refresh) on the next call.
      const refreshesBefore = __getOutputStoreCacheStatsForTests().diskRefreshCount;
      await appendWorkerEntry(runId, hotWorkerId, {
        id: "hot-final",
        type: "message",
        text: "still here",
        timestamp: new Date(1700000003000).toISOString(),
      });
      const refreshesAfter = __getOutputStoreCacheStatsForTests().diskRefreshCount;
      expect(refreshesAfter).toBe(refreshesBefore);
    } finally {
      await cleanupRun(runId);
    }
  });
});
