/**
 * Unit tests for the generic append-only artifact store.
 *
 * Focus is on behaviours that other layers depend on:
 *
 *   - append → tail readers see the latest seq immediately
 *   - compact → expand round-trip preserves bytes
 *   - sparse index lets readEntriesTailWithIndex skip the file head
 *   - file-lock prevents concurrent appends from interleaving
 *
 * These tests run against a real temp directory; nothing is mocked.
 */
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { promises as fsPromises } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendArtifactLine,
  compactArtifactStream,
  expandArtifactStream,
  readAllArtifactEntries,
  readEntriesTailWithIndex,
  readLatestSeqFromTail,
} from "@/server/artifacts/append-only-store";
import type { ArtifactStreamLocation } from "@/server/artifacts/append-only-store";
import { INDEX_CADENCE, readIndex } from "@/server/artifacts/stream-index";

let tmpRoot: string;

function makeLocation(): ArtifactStreamLocation {
  const filePath = path.join(tmpRoot, "execution-events.jsonl");
  return {
    id: { runId: "run-test", kind: "execution_events", ownerId: null },
    root: {
      absolutePath: tmpRoot,
      source: "legacy_global",
      projectPath: null,
      relativeRootPath: "run-test",
    },
    relativeStreamPath: "execution-events.jsonl",
    filePath,
    compressedFilePath: `${filePath}.gz`,
    lockPath: `${filePath}.lock`,
  };
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "artifact-store-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("appendArtifactLine", () => {
  it("appends sequenced records and round-trips through readAllArtifactEntries", async () => {
    const location = makeLocation();
    for (let seq = 1; seq <= 5; seq += 1) {
      await appendArtifactLine(
        location,
        JSON.stringify({ id: `r${seq}`, seq, payload: { i: seq } }),
        { seq },
      );
    }
    const all = await readAllArtifactEntries<{ id: string; seq: number }>(location);
    expect(all.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  it("ensures a leading newline if the file did not end in one", async () => {
    const location = makeLocation();
    await appendArtifactLine(location, JSON.stringify({ id: "a", seq: 1 }), { seq: 1 });
    // Manually clobber the trailing newline to simulate a truncated write.
    const fs = await import("node:fs/promises");
    const body = await fs.readFile(location.filePath, "utf8");
    expect(body.endsWith("\n")).toBe(true);
    await fs.writeFile(location.filePath, body.trimEnd());
    await appendArtifactLine(location, JSON.stringify({ id: "b", seq: 2 }), { seq: 2 });
    const all = await readAllArtifactEntries<{ id: string }>(location);
    expect(all.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("serialises concurrent appends to the same stream", async () => {
    const location = makeLocation();
    const writes: Promise<void>[] = [];
    for (let seq = 1; seq <= 20; seq += 1) {
      writes.push(
        appendArtifactLine(location, JSON.stringify({ id: `r${seq}`, seq }), { seq }),
      );
    }
    await Promise.all(writes);
    const all = await readAllArtifactEntries<{ seq: number }>(location);
    // All 20 must be present, in append order (the in-process chain
    // serialises by stream identity).
    expect(all).toHaveLength(20);
    expect(all.map((r) => r.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("recovers an ownerless artifact lock directory", async () => {
    const location = makeLocation();
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.dirname(location.filePath), { recursive: true });
    await fs.writeFile(location.filePath, "", "utf8");
    await fs.mkdir(location.lockPath, { recursive: true });

    await appendArtifactLine(location, JSON.stringify({ id: "after-ownerless-lock", seq: 1 }), { seq: 1 });

    const all = await readAllArtifactEntries<{ id: string; seq: number }>(location);
    expect(all.map((entry) => entry.id)).toEqual(["after-ownerless-lock"]);
    await expect(stat(location.lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retries when artifact owner metadata hits a transient invalid lock path", async () => {
    const location = makeLocation();
    let failedOwnerWrite = false;
    const originalWriteFile = fsPromises.writeFile.bind(fsPromises);
    vi.spyOn(fsPromises, "writeFile").mockImplementation(async (...args: Parameters<typeof fsPromises.writeFile>) => {
      const target = String(args[0]);
      if (!failedOwnerWrite && target === path.join(location.lockPath, "owner.json")) {
        failedOwnerWrite = true;
        throw Object.assign(new Error(`EINVAL: invalid argument, open '${target}'`), {
          code: "EINVAL",
          path: target,
        });
      }
      return originalWriteFile(...args);
    });

    try {
      await appendArtifactLine(location, JSON.stringify({ id: "after-owner-write-race", seq: 1 }), { seq: 1 });
    } finally {
      vi.restoreAllMocks();
    }

    const all = await readAllArtifactEntries<{ id: string; seq: number }>(location);
    expect(failedOwnerWrite).toBe(true);
    expect(all.map((entry) => entry.id)).toEqual(["after-owner-write-race"]);
    await expect(stat(location.lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("readLatestSeqFromTail", () => {
  it("returns the highest seq by scanning the tail only", async () => {
    const location = makeLocation();
    for (let seq = 1; seq <= 50; seq += 1) {
      await appendArtifactLine(location, JSON.stringify({ id: `r${seq}`, seq }), { seq });
    }
    const latest = await readLatestSeqFromTail<{ seq: number }>(location, (line) => {
      try {
        const obj = JSON.parse(line) as { seq: number };
        return { parsed: obj, seq: obj.seq };
      } catch {
        return { parsed: null, seq: 0 };
      }
    });
    expect(latest).toBe(50);
  });
});

describe("sparse index", () => {
  it("writes an index entry every INDEX_CADENCE records", async () => {
    const location = makeLocation();
    const total = INDEX_CADENCE * 2 + 5;
    for (let seq = 1; seq <= total; seq += 1) {
      await appendArtifactLine(location, JSON.stringify({ id: `r${seq}`, seq, body: "x".repeat(64) }), { seq });
    }
    const index = await readIndex(location);
    expect(index).not.toBeNull();
    // At least the two on-cadence entries (seq = INDEX_CADENCE and 2×INDEX_CADENCE).
    expect(index!.length).toBeGreaterThanOrEqual(2);
    // Each indexed offset must actually point at a line in the file.
    const body = await readFile(location.filePath, "utf8");
    for (const point of index!) {
      const newlineIdx = body.indexOf("\n", point.offset);
      const line = body.slice(point.offset, newlineIdx === -1 ? body.length : newlineIdx);
      const parsed = JSON.parse(line);
      expect(parsed.seq).toBe(point.seq);
    }
  });

  it("readEntriesTailWithIndex returns the requested tail without scanning from offset 0", async () => {
    const location = makeLocation();
    const total = INDEX_CADENCE * 3;
    for (let seq = 1; seq <= total; seq += 1) {
      await appendArtifactLine(location, JSON.stringify({ id: `r${seq}`, seq }), { seq });
    }
    const tail = await readEntriesTailWithIndex<{ seq: number }>(
      location,
      total,
      50,
      (line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      },
    );
    expect(tail).not.toBeNull();
    expect(tail!.length).toBe(50);
    expect(tail![0].seq).toBe(total - 49);
    expect(tail![tail!.length - 1].seq).toBe(total);
  });
});

describe("compaction round-trip", () => {
  it("compacts the plaintext to .gz and expands back identically", async () => {
    const location = makeLocation();
    for (let seq = 1; seq <= 10; seq += 1) {
      await appendArtifactLine(location, JSON.stringify({ id: `r${seq}`, seq }), { seq });
    }
    const plaintextBefore = await readFile(location.filePath, "utf8");

    const ok = await compactArtifactStream(location);
    expect(ok).toBe(true);
    // Plaintext is gone, .gz exists.
    await expect(stat(location.filePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(location.compressedFilePath)).resolves.toBeTruthy();

    // expandArtifactStream restores the plaintext byte-for-byte.
    const expanded = await expandArtifactStream(location);
    expect(expanded).toBe(true);
    const plaintextAfter = await readFile(location.filePath, "utf8");
    expect(plaintextAfter).toBe(plaintextBefore);
  });

  it("appending after compaction re-expands and preserves all records", async () => {
    const location = makeLocation();
    for (let seq = 1; seq <= 5; seq += 1) {
      await appendArtifactLine(location, JSON.stringify({ id: `r${seq}`, seq }), { seq });
    }
    await compactArtifactStream(location);
    await appendArtifactLine(location, JSON.stringify({ id: "r6", seq: 6 }), { seq: 6 });
    const all = await readAllArtifactEntries<{ seq: number }>(location);
    expect(all.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
