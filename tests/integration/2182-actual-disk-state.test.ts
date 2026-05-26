/**
 * Verifies the bug fix against the actual on-disk state of run
 * 2182b07381c8 — the exact files the FE will read once it polls the
 * new transcript endpoint. Uses the same coalesce/sort logic the FE
 * uses, not a parallel simulation.
 *
 * This test only runs locally where the files exist; skipped in CI.
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { coalesceWorkerEntriesById } from "@/app/home/WorkerEntriesManager";
import type { WorkerEntry } from "@/server/workers/entries-types";

interface TranscriptEntry extends WorkerEntry {
  workerId: string;
}

const RUN_ID = "2182b07381c8";
const WORKERS_DIR = `/Users/masterman/NLP/quasome/.omniharness/run-data/${RUN_ID}/workers`;

function loadWorkerEntriesFromDisk(): { workerIds: string[]; entries: TranscriptEntry[] } {
  const files = readdirSync(WORKERS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .sort(); // sorted by filename → worker-1, worker-2, worker-3 in creation order
  const workerIds = files.map((f) => path.basename(f, ".jsonl"));
  const entries: TranscriptEntry[] = [];
  for (const file of files) {
    const workerId = path.basename(file, ".jsonl");
    const body = readFileSync(path.join(WORKERS_DIR, file), "utf8");
    for (const line of body.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as WorkerEntry;
        entries.push({ ...entry, workerId });
      } catch {
        // skip malformed
      }
    }
  }
  return { workerIds, entries };
}

// Mirrors the SERVER-SIDE comparator in
// `src/runtime/http/routes/conversation-transcript.ts` exactly.
function compareTranscriptEntries(
  a: TranscriptEntry,
  b: TranscriptEntry,
  workerOrder: Map<string, number>,
): number {
  const at = Date.parse(a.timestamp) || 0;
  const bt = Date.parse(b.timestamp) || 0;
  if (at !== bt) return at - bt;
  const ao = workerOrder.get(a.workerId) ?? Number.MAX_SAFE_INTEGER;
  const bo = workerOrder.get(b.workerId) ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.seq ?? 0) - (b.seq ?? 0);
}

const TEST = existsSync(WORKERS_DIR) ? it : it.skip;

describe("2182b07381c8 actual on-disk state through the real FE pipeline", () => {
  TEST("no duplicate ids in the displayed conversation", () => {
    const { workerIds, entries } = loadWorkerEntriesFromDisk();
    const workerOrder = new Map(workerIds.map((id, i) => [id, i]));
    const sorted = [...entries].sort((a, b) => compareTranscriptEntries(a, b, workerOrder));
    const displayed = coalesceWorkerEntriesById(sorted);

    const ids = displayed.map((e) => e.id).filter((id): id is string => typeof id === "string");
    expect(new Set(ids).size).toBe(ids.length);
  });

  TEST("the `eaa126ac` revision tower collapses to a single row with the final text", () => {
    const { workerIds, entries } = loadWorkerEntriesFromDisk();
    const workerOrder = new Map(workerIds.map((id, i) => [id, i]));
    const sorted = [...entries].sort((a, b) => compareTranscriptEntries(a, b, workerOrder));
    const displayed = coalesceWorkerEntriesById(sorted);

    const eaaRows = entries.filter((e) => e.id === "eaa126ac-6a21-4dfd-a810-ab67bb8ba57d");
    const eaaDisplayed = displayed.filter((e) => e.id === "eaa126ac-6a21-4dfd-a810-ab67bb8ba57d");
    expect(eaaRows.length).toBeGreaterThan(1); // confirms multiple revisions are on disk
    expect(eaaDisplayed).toHaveLength(1);
    // The displayed text should be the longest (latest) revision.
    const longestRow = eaaRows.reduce((a, b) => ((a.text ?? "").length >= (b.text ?? "").length ? a : b));
    expect(eaaDisplayed[0]?.text).toBe(longestRow.text);
  });

  TEST("user messages and assistant messages interleave in correct temporal order", () => {
    const { workerIds, entries } = loadWorkerEntriesFromDisk();
    const workerOrder = new Map(workerIds.map((id, i) => [id, i]));
    const sorted = [...entries].sort((a, b) => compareTranscriptEntries(a, b, workerOrder));
    const displayed = coalesceWorkerEntriesById(sorted);

    const visible = displayed.filter((e) => e.type === "user_input" || e.type === "message");
    // Every adjacent pair must be in non-decreasing timestamp order.
    for (let i = 1; i < visible.length; i += 1) {
      const prev = Date.parse(visible[i - 1]!.timestamp);
      const next = Date.parse(visible[i]!.timestamp);
      expect(next).toBeGreaterThanOrEqual(prev);
    }

    // First entry should be the original user prompt at 12:06:59.
    expect(visible[0]?.type).toBe("user_input");
    expect(visible[0]?.text).toContain("We had this conversation earlier");

    // No two consecutive entries should both be user_input AT THE SAME TIMESTAMP
    // (the "clustering at the end" bug would create such adjacency).
    for (let i = 1; i < visible.length; i += 1) {
      const prev = visible[i - 1]!;
      const next = visible[i]!;
      if (prev.type === "user_input" && next.type === "user_input") {
        // Allowed only if separated in time (user genuinely sent two
        // messages in a row before the worker responded — which is a
        // user behavior, not a bug).
        const gap = Date.parse(next.timestamp) - Date.parse(prev.timestamp);
        expect(gap).toBeGreaterThan(0);
      }
    }
  });

  TEST("no archive-marker rows leak into the display", () => {
    const { workerIds, entries } = loadWorkerEntriesFromDisk();
    const workerOrder = new Map(workerIds.map((id, i) => [id, i]));
    const sorted = [...entries].sort((a, b) => compareTranscriptEntries(a, b, workerOrder));
    const displayed = coalesceWorkerEntriesById(sorted);

    const markers = displayed.filter((e) => e.id === "output-archive-marker");
    expect(markers).toHaveLength(0);
  });
});
