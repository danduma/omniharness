import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  recoveryIncidents,
  runs,
  supervisorInterventions,
  workerCounters,
  workers,
} from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import { writeWorkerOutputEntries } from "@/server/workers/output-store";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: vi.fn(),
}));

import { GET } from "@/app/api/events/route";

const LOAD_BUDGET_MS = 5_000;

type Fixture = {
  planId: string;
  runId: string;
  workerId: string;
  workerType: string;
  runMode: "implementation" | "direct" | "planning";
  runStatus: string;
  workerStatus: string;
  title: string;
  entries: Array<{ id: string; type: string; text: string; timestamp: string }>;
};

function buildFixture(label: string, runMode: Fixture["runMode"]): Fixture {
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const baseMs = Date.now() - 60_000;
  const entries = [
    {
      id: randomUUID(),
      type: "message",
      text: `[${label}] hello`,
      timestamp: new Date(baseMs).toISOString(),
    },
    {
      id: randomUUID(),
      type: "tool_call",
      text: `[${label}] edited file`,
      timestamp: new Date(baseMs + 1000).toISOString(),
    },
    {
      id: randomUUID(),
      type: "message",
      text: `[${label}] done`,
      timestamp: new Date(baseMs + 2000).toISOString(),
    },
  ];
  return {
    planId: randomUUID(),
    runId,
    workerId,
    workerType: runMode === "direct" ? "gemini" : "codex",
    runMode,
    runStatus: "done",
    workerStatus: "idle",
    title: `${label} conversation`,
    entries,
  };
}

async function seedFixture(fixture: Fixture) {
  const now = new Date();
  await db.insert(plans).values({
    id: fixture.planId,
    path: `vibes/ad-hoc/${fixture.runId}.md`,
    status: fixture.runStatus,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: fixture.runId,
    planId: fixture.planId,
    mode: fixture.runMode,
    status: fixture.runStatus,
    title: fixture.title,
    projectPath: "/workspace/app",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: fixture.workerId,
    runId: fixture.runId,
    type: fixture.workerType,
    status: fixture.workerStatus,
    cwd: "/workspace/app",
    outputLog: "",
    outputEntriesJson: "",
    currentText: "",
    lastText: "",
    workerNumber: 1,
    createdAt: now,
    updatedAt: now,
  });
  // The events route loads outputEntries from disk via readWorkerOutputEntries.
  // Persist them through the canonical writer so the fixture reflects how
  // production sessions store their per-worker activity log.
  await writeWorkerOutputEntries(fixture.runId, fixture.workerId, fixture.entries as never);
}

async function cleanupFixture(fixture: Fixture) {
  await fs
    .rm(path.join(getAppDataPath("run-data"), fixture.runId), { recursive: true, force: true })
    .catch(() => undefined);
}

async function loadSnapshot(runId: string) {
  const start = Date.now();
  const response = await GET(
    new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`),
  );
  const payload = (await response.json()) as {
    runs: Array<{ id: string }>;
    workers: Array<{ id: string; runId: string }>;
    agents: Array<{
      name: string;
      outputEntries?: Array<{ id: string; type: string; text: string }>;
    }>;
  };
  return { payload, elapsedMs: Date.now() - start };
}

describe("conversation load coverage", () => {
  const originalFetch = global.fetch;
  const fixtures: Fixture[] = [];

  beforeEach(async () => {
    __resetNamedEventsForTests();
    notifyEventStreamSubscribers();
    global.fetch = originalFetch;
    await db.delete(recoveryIncidents);
    await db.delete(supervisorInterventions);
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
    fixtures.length = 0;

    // Pretend the agent runtime bridge has no live sessions. The fixtures all
    // represent terminal/idle runs whose activity must be reconstructed from
    // the persisted run-data JSONL files alone — that's the bug class we're
    // guarding against (a direct gemini session 2 days old getting stuck on
    // "Loading session" because nothing was reaching the Terminal).
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
  });

  afterEach(async () => {
    for (const fixture of fixtures) {
      await cleanupFixture(fixture);
    }
    global.fetch = originalFetch;
  });

  it("every conversation in the sidebar list loads its activity within the budget", async () => {
    // Mix of CLI agent types and run modes to mirror the real sidebar — a
    // hang in any one of them is a bug per the user's requirement.
    const seedSpecs: Array<{ label: string; mode: Fixture["runMode"] }> = [
      { label: "direct-gemini", mode: "direct" },
      { label: "direct-codex", mode: "direct" },
      { label: "implementation", mode: "implementation" },
      { label: "planning", mode: "planning" },
      { label: "direct-completed", mode: "direct" },
    ];
    for (const spec of seedSpecs) {
      const fixture = buildFixture(spec.label, spec.mode);
      fixtures.push(fixture);
      await seedFixture(fixture);
    }

    for (const fixture of fixtures) {
      const { payload, elapsedMs } = await loadSnapshot(fixture.runId);

      expect(
        elapsedMs,
        `selecting ${fixture.title} took ${elapsedMs}ms — anything over ${LOAD_BUDGET_MS}ms means the Terminal would stick on "Loading session"`,
      ).toBeLessThan(LOAD_BUDGET_MS);

      expect(
        payload.runs.find((run) => run.id === fixture.runId),
        `run ${fixture.runId} missing from snapshot payload — sidebar entry would be unreachable`,
      ).toBeTruthy();

      const workerRecord = payload.workers.find((worker) => worker.id === fixture.workerId);
      expect(
        workerRecord,
        `worker ${fixture.workerId} missing from snapshot payload for run ${fixture.runId}`,
      ).toBeTruthy();

      const agent = payload.agents.find((candidate) => candidate.name === fixture.workerId);
      expect(
        agent,
        `agent snapshot missing for worker ${fixture.workerId} (${fixture.title}) — Terminal would render "Loading session" forever`,
      ).toBeTruthy();

      const outputEntries = agent?.outputEntries ?? [];
      expect(
        outputEntries.length,
        `agent ${fixture.workerId} returned with zero outputEntries despite ${fixture.entries.length} persisted on disk — this is the stuck-loading regression`,
      ).toBeGreaterThanOrEqual(fixture.entries.length);

      const messageTexts = outputEntries
        .filter((entry) => entry.type === "message")
        .map((entry) => entry.text);
      expect(
        messageTexts.some((text) => text.includes(`[${fixture.title.split(" ")[0]}]`)),
        `agent ${fixture.workerId} outputEntries do not include the persisted message text for ${fixture.title}`,
      ).toBe(true);
    }
  });

  it("loads a conversation whose worker output is gzip-compacted on disk", async () => {
    // Older terminal sessions (the case the user reported — 2-day-old direct
    // gemini session) have their JSONL gzipped by compactStaleWorkerOutputs.
    // Loading must still surface their entries; otherwise selecting the
    // conversation hangs on "Loading session".
    const fixture = buildFixture("gzip-archived", "direct");
    fixtures.push(fixture);
    await seedFixture(fixture);

    const { compactRunOutputs } = await import("@/server/workers/output-store");
    const compactResult = await compactRunOutputs(fixture.runId);
    expect(compactResult.compactedWorkerIds).toContain(fixture.workerId);

    const { payload, elapsedMs } = await loadSnapshot(fixture.runId);
    expect(elapsedMs).toBeLessThan(LOAD_BUDGET_MS);

    const agent = payload.agents.find((candidate) => candidate.name === fixture.workerId);
    expect(agent, "compacted/gzipped worker output failed to surface in the snapshot").toBeTruthy();
    expect((agent?.outputEntries ?? []).length).toBeGreaterThanOrEqual(fixture.entries.length);
  });

  it("a conversation with no persisted output still returns an agent shell (so the UI can render the empty state, not Loading session)", async () => {
    const fixture = buildFixture("empty-session", "direct");
    // Deliberately skip writeWorkerOutputEntries — represents a brand-new
    // session with nothing on disk yet.
    fixture.entries = [];
    fixtures.push(fixture);

    const now = new Date();
    await db.insert(plans).values({
      id: fixture.planId,
      path: `vibes/ad-hoc/${fixture.runId}.md`,
      status: fixture.runStatus,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: fixture.runId,
      planId: fixture.planId,
      mode: fixture.runMode,
      status: fixture.runStatus,
      title: fixture.title,
      projectPath: "/workspace/app",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: fixture.workerId,
      runId: fixture.runId,
      type: fixture.workerType,
      status: fixture.workerStatus,
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    const { payload, elapsedMs } = await loadSnapshot(fixture.runId);
    expect(elapsedMs).toBeLessThan(LOAD_BUDGET_MS);
    const agent = payload.agents.find((candidate) => candidate.name === fixture.workerId);
    expect(
      agent,
      "even with no persisted activity the worker must appear in payload.agents so the UI shows 'No activity yet' rather than the stuck Loading state",
    ).toBeTruthy();
  });
});
