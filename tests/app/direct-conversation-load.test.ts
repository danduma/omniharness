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

// useHomeViewModel uses React.useMemo. Stub it so the hook runs in a plain
// test environment — same pattern as tests/app/home-view-model.test.ts.
vi.mock("react", () => ({
  useMemo: (factory: () => unknown) => factory(),
}));

import { GET } from "@/app/api/events/route";
import { useHomeViewModel } from "@/app/home/useHomeViewModel";
import type { EventStreamState } from "@/app/home/types";

const LOAD_BUDGET_MS = 5_000;

type DirectFixture = {
  planId: string;
  runId: string;
  workerId: string;
  workerType: "gemini" | "claude" | "codex";
  workerStatus: "idle" | "cancelled";
  runStatus: "done" | "cancelled";
  title: string;
  entries: Array<{ id: string; type: string; text: string; timestamp: string }>;
};

function makeFixture(label: string, overrides: Partial<DirectFixture> = {}): DirectFixture {
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const baseMs = Date.now() - 60_000;
  return {
    planId: randomUUID(),
    runId,
    workerId,
    workerType: "gemini",
    workerStatus: "idle",
    runStatus: "done",
    title: label,
    entries: [
      { id: randomUUID(), type: "message", text: `[${label}] hello`, timestamp: new Date(baseMs).toISOString() },
      { id: randomUUID(), type: "tool_call", text: `[${label}] edit`, timestamp: new Date(baseMs + 1000).toISOString() },
      { id: randomUUID(), type: "message", text: `[${label}] done`, timestamp: new Date(baseMs + 2000).toISOString() },
    ],
    ...overrides,
  };
}

async function seedFixture(fixture: DirectFixture) {
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
    mode: "direct",
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
    // Empty legacy JSON — matches the real stuck sessions in the user's DB,
    // where every entry lives only in run-data/<runId>/<workerId>.jsonl.
    outputEntriesJson: "",
    currentText: "",
    lastText: "",
    workerNumber: 1,
    createdAt: now,
    updatedAt: now,
  });
  if (fixture.entries.length > 0) {
    await writeWorkerOutputEntries(fixture.runId, fixture.workerId, fixture.entries as never);
  }
}

async function cleanupFixture(fixture: DirectFixture) {
  await fs
    .rm(path.join(getAppDataPath("run-data"), fixture.runId), { recursive: true, force: true })
    .catch(() => undefined);
}

async function fetchSnapshot(runId: string): Promise<{ payload: EventStreamState; elapsedMs: number }> {
  const start = Date.now();
  // This is the exact URL the frontend uses (see buildPersistedSnapshotUrl in
  // LiveEventConnectionManager). If this path doesn't return outputEntries,
  // the UI is stuck on the Terminal empty state.
  const response = await GET(
    new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${runId}`),
  );
  const payload = (await response.json()) as EventStreamState;
  return { payload, elapsedMs: Date.now() - start };
}

function renderViewModel(state: EventStreamState, runId: string) {
  return useHomeViewModel({
    state,
    selectedRunId: runId,
    selectedConversationMode: "direct",
    selectedCliAgent: "gemini",
    selectedModel: "gemini-2.0-flash",
    selectedEffort: "medium",
    draftProjectPath: null,
    searchQuery: "",
    apiKeys: {},
    workerCatalogData: undefined,
  });
}

describe("direct-control conversation loading (frontend pipeline)", () => {
  const originalFetch = global.fetch;
  const fixtures: DirectFixture[] = [];

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
    // Bridge returns no live agents — represents reopening an old direct
    // session whose runtime worker has long since exited.
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
  });

  afterEach(async () => {
    for (const fixture of fixtures) {
      await cleanupFixture(fixture);
    }
    global.fetch = originalFetch;
  });

  // Mirrors the four runs the user reported (6f659eeee333, 2b665fecf0d1,
  // 732440d9ed81, 8929eaa10d7e): direct mode, idle/cancelled workers, run
  // status done/cancelled, no live agent on the bridge, output_entries_json
  // empty, real entries living only on disk.
  const scenarios: Array<{ label: string; build: () => DirectFixture }> = [
    {
      label: "direct/done gemini idle worker (6f659eeee333 shape)",
      build: () => makeFixture("direct-gemini-done"),
    },
    {
      label: "direct/done claude idle worker (8929eaa10d7e shape)",
      build: () => makeFixture("direct-claude-done", { workerType: "claude" }),
    },
    {
      label: "direct/done codex idle worker",
      build: () => makeFixture("direct-codex-done", { workerType: "codex" }),
    },
    {
      label: "direct/cancelled gemini worker (2b665fecf0d1 shape)",
      build: () => makeFixture("direct-gemini-cancelled", {
        workerStatus: "cancelled",
        runStatus: "cancelled",
      }),
    },
  ];

  for (const scenario of scenarios) {
    it(`renders ${scenario.label} with persisted outputEntries (no stuck loading)`, async () => {
      const fixture = scenario.build();
      fixtures.push(fixture);
      await seedFixture(fixture);

      const { payload, elapsedMs } = await fetchSnapshot(fixture.runId);
      expect(
        elapsedMs,
        `snapshot for ${scenario.label} took ${elapsedMs}ms — over budget means Terminal would stick on "Loading session"`,
      ).toBeLessThan(LOAD_BUDGET_MS);

      // Sanity: the server should expose the agent and its persisted entries.
      const apiAgent = payload.agents.find((agent) => agent.name === fixture.workerId);
      expect(apiAgent, `API snapshot is missing agent for ${fixture.workerId}`).toBeTruthy();
      expect(
        (apiAgent?.outputEntries ?? []).length,
        `API snapshot returned zero outputEntries for ${fixture.workerId} — disk read is broken`,
      ).toBeGreaterThanOrEqual(fixture.entries.length);

      // The actual regression we're guarding against lives downstream of the
      // API: useHomeViewModel synthesizes its own stripped agent when there
      // is no live runtime worker, and that synthetic agent has no
      // outputEntries — so the Terminal renders the empty state forever even
      // though the data is sitting right there in state.agents.
      const viewModel = renderViewModel(payload, fixture.runId);
      const primary = viewModel.primaryConversationAgent;
      expect(
        primary,
        `useHomeViewModel did not resolve a primaryConversationAgent for ${scenario.label}`,
      ).toBeTruthy();
      expect(
        (primary?.outputEntries ?? []).length,
        `primaryConversationAgent for ${scenario.label} surfaced ${
          primary?.outputEntries?.length ?? 0
        } outputEntries instead of the ${fixture.entries.length} persisted on disk — this is the "direct conversations show empty" bug`,
      ).toBeGreaterThanOrEqual(fixture.entries.length);

      const messageTexts = (primary?.outputEntries ?? [])
        .filter((entry) => entry.type === "message")
        .map((entry) => entry.text);
      expect(messageTexts.some((text) => text.includes(`[${fixture.title}]`))).toBe(true);
    });
  }

  it("renders every direct conversation on the sidebar list, not just the selected one", async () => {
    // Mirrors the user's complaint: clicking through every direct session in
    // the sidebar should expose its activity. We seed N runs, then iterate
    // selectedRunId across them and check primaryConversationAgent each
    // time. Any conversation with zero outputEntries is a bug.
    const list = [
      makeFixture("sidebar-direct-1"),
      makeFixture("sidebar-direct-2", { workerType: "claude" }),
      makeFixture("sidebar-direct-3", { workerType: "codex" }),
      makeFixture("sidebar-direct-4", { workerStatus: "cancelled", runStatus: "cancelled" }),
    ];
    for (const fixture of list) {
      fixtures.push(fixture);
      await seedFixture(fixture);
    }

    for (const fixture of list) {
      const { payload, elapsedMs } = await fetchSnapshot(fixture.runId);
      expect(elapsedMs).toBeLessThan(LOAD_BUDGET_MS);

      const viewModel = renderViewModel(payload, fixture.runId);
      const primary = viewModel.primaryConversationAgent;
      expect(
        primary?.outputEntries?.length ?? 0,
        `sidebar entry ${fixture.title} loaded with empty terminal — visible bug for the user`,
      ).toBeGreaterThanOrEqual(fixture.entries.length);
    }
  });
});
