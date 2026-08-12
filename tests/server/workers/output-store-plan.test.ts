import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAppDataPath } from "@/server/app-root";
import {
  __resetOutputStoreCachesForTests,
  compactEntryForHistory,
  readLatestWorkerPlanEntries,
  readWorkerEntriesSince,
  workerOutputFilePathFor,
} from "@/server/workers/output-store";
import type { WorkerEntry } from "@/shared/worker-entries";

const createdRunIds: string[] = [];

afterEach(async () => {
  __resetOutputStoreCachesForTests();
  for (const runId of createdRunIds.splice(0)) {
    await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
  }
});

describe("readLatestWorkerPlanEntries", () => {
  it("preserves the ingress-bounded raw notification for accepted plan history", () => {
    const raw = {
      sessionUpdate: "plan",
      entries: [{ content: "Inspect", priority: "high", status: "pending" }],
      providerEvidence: "x".repeat(5_000),
    };
    const entry = {
      id: "accepted-plan",
      type: "plan",
      text: "Inspect",
      raw,
      planProjection: "accepted_core",
    };

    expect(compactEntryForHistory(entry)).toBe(entry);
    expect((compactEntryForHistory(entry).raw as typeof raw).providerEvidence).toHaveLength(5_000);
  });

  it("finds a boundary outside the tail window and retains only the current plan projection", async () => {
    const runId = `plan-read-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const workerId = "worker-plan-read";
    createdRunIds.push(runId);
    const filePath = workerOutputFilePathFor(runId, workerId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const entries: WorkerEntry[] = Array.from({ length: 1_500 }, (_, index) => ({
      id: `message-${index + 1}`,
      seq: index + 1,
      type: "message",
      text: `line ${index + 1}`,
      timestamp: new Date(1_700_000_000_000 + index).toISOString(),
    }));
    entries[99] = {
      id: "boundary-100",
      seq: 100,
      type: "system_note",
      text: "",
      timestamp: "2026-01-01T00:00:00.000Z",
      acpSessionId: "session-current",
      planProjection: "session_reset",
      diagnosticOnly: true,
    };
    entries[1_199] = {
      id: "plan-1200",
      seq: 1_200,
      type: "plan",
      text: "Ship it",
      timestamp: "2026-01-01T00:01:00.000Z",
      acpSessionId: "session-current",
      planProjection: "accepted_core",
      normalizedPlan: [{ id: "0", content: "Ship it", priority: "high", status: "in_progress", order: 0 }],
    };
    await fs.writeFile(filePath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const cacheWarm = await readWorkerEntriesSince(runId, workerId, 0);
    expect(cacheWarm.entries).toHaveLength(1_500);
    const cachedPage = await readWorkerEntriesSince(runId, workerId, 100);
    expect(cachedPage._path).toBe("cache.filtered");
    expect(cachedPage.entries).toHaveLength(200);

    const result = await readLatestWorkerPlanEntries(runId, workerId);

    expect(result.latestSeq).toBe(1_500);
    expect(result.entries.map((entry) => entry.id)).toEqual(["boundary-100", "plan-1200"]);
  });
});
