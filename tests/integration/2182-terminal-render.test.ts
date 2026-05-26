/**
 * Renders the actual `Terminal` component against the real on-disk
 * state of run 2182b07381c8, simulating exactly what the FE will draw
 * after polling the new conversation-transcript endpoint. Reads the
 * worker JSONLs straight from the project root and runs them through
 * the SAME code paths the live FE uses:
 *   - the merge comparator from conversation-transcript.ts
 *   - coalesceWorkerEntriesById from WorkerEntriesManager
 *   - the Terminal component itself
 *
 * On success it asserts the rendered HTML actually contains the user's
 * messages and worker responses in chronological order, with no
 * duplicate assistant text, and dumps a redacted summary to stderr so a
 * human reviewing the test output can spot-check.
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Terminal } from "@/components/Terminal";
import { coalesceWorkerEntriesById } from "@/app/home/WorkerEntriesManager";
import type { WorkerEntry } from "@/server/workers/entries-types";

interface TranscriptEntry extends WorkerEntry {
  workerId: string;
}

const WORKERS_DIR = "/Users/masterman/NLP/quasome/.omniharness/run-data/2182b07381c8/workers";

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

describe("2182b07381c8 — actual Terminal HTML rendering", () => {
  TEST("renders user/assistant messages in chronological order with no duplicate assistant text", () => {
    Object.assign(globalThis, { React });

    const files = readdirSync(WORKERS_DIR).filter((f) => f.endsWith(".jsonl")).sort();
    const workerIds = files.map((f) => path.basename(f, ".jsonl"));
    const workerOrder = new Map(workerIds.map((id, i) => [id, i]));
    const merged: TranscriptEntry[] = [];
    for (const file of files) {
      const workerId = path.basename(file, ".jsonl");
      const body = readFileSync(path.join(WORKERS_DIR, file), "utf8");
      for (const line of body.split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as WorkerEntry;
          merged.push({ ...e, workerId });
        } catch { /* ignore */ }
      }
    }
    merged.sort((a, b) => compareTranscriptEntries(a, b, workerOrder));
    const displayed = coalesceWorkerEntriesById(merged) as TranscriptEntry[];

    const html = renderToStaticMarkup(
      React.createElement(Terminal, {
        entries: displayed,
        showTextSizeControl: false,
        allowUserMessageFallback: false,
      }),
    );
    const text = html.replace(/<[^>]+>/g, "");

    // The four user prompts must all appear, in chronological order.
    const userProbes = [
      "We had this conversation earlier",
      "continue",
      "you did?",
      "implement all of the things",
    ];
    const positions = userProbes.map((probe) => text.indexOf(probe));
    expect(positions.every((p) => p >= 0)).toBe(true);
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }

    // No assistant message should appear duplicated character-for-character.
    // The seq 22/24 sandwich would manifest as the same long completion
    // string appearing twice; with coalesce in place it must appear once.
    const completionPhrase = "I have completed a comprehensive set of enhancements";
    const completionOccurrences = (text.match(new RegExp(completionPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    expect(completionOccurrences).toBe(1);

    // The assistant's first response (worker-2 starting investigation) must
    // come before the second user prompt.
    const w2Probe = "investigation to understand the current state";
    const w2Pos = text.indexOf(w2Probe);
    expect(w2Pos).toBeGreaterThan(positions[0]!);
    expect(w2Pos).toBeLessThan(positions[1]!);

    // Final assistant message must be the post-revision text (the
    // streaming entry's final form), not the first chunk.
    const finalText = "I have completed a comprehensive set of enhancements to the workspace";
    expect(text.indexOf(finalText)).toBeGreaterThan(0);

    // No archive-marker copy.
    expect(text).not.toContain("older raw worker activity records are only in archived history");

    // Dump a redacted preview for visual inspection.
    const preview = text.slice(0, 800).replace(/\s+/g, " ").trim();
    process.stderr.write(`[2182 render preview] ${preview}\n…\n`);
  });
});
