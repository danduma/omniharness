import { describe, expect, it } from "vitest";
import {
  ACTIVE_SESSION_ACTIVITY_WINDOW_MS,
  buildActiveConversationGroups,
  classifySidebarRun,
  compareActiveSidebarRunsDesc,
  filterActiveConversationGroups,
  getSidebarRunLastActivityAt,
  isSidebarRunCurrentlyWorking,
} from "@/app/home/sidebar-activity";
import type { SidebarGroup } from "@/app/home/types";

const NOW = new Date("2026-05-26T12:00:00.000Z").getTime();
const RECENT = new Date(NOW - 5 * 60 * 1000).toISOString(); // 5 min ago
const OLD = new Date(NOW - 25 * 60 * 1000).toISOString(); // 25 min ago — outside window
const ANCIENT = new Date(NOW - 60 * 60 * 1000).toISOString(); // 1 hour ago

function makeRun(overrides: Partial<{
  id: string; status: string; createdAt: string; updatedAt: string | null;
}> = {}) {
  return {
    id: "run-1",
    status: "done",
    createdAt: ANCIENT,
    updatedAt: null,
    ...overrides,
  };
}

function makeMsg(overrides: Partial<{
  runId: string; role: string; kind: string | null; createdAt: string;
}> = {}) {
  return {
    runId: "run-1",
    role: "user",
    kind: null,
    createdAt: RECENT,
    ...overrides,
  };
}

function makeWorker(overrides: Partial<{
  id: string; runId: string; status: string; updatedAt: string;
}> = {}) {
  return {
    id: "worker-1",
    runId: "run-1",
    status: "done",
    updatedAt: ANCIENT,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<{
  name: string; state: string; updatedAt: string;
}> = {}) {
  return {
    name: "worker-1",
    state: "idle",
    updatedAt: ANCIENT,
    ...overrides,
  };
}

function makeQueuedMsg(overrides: Partial<{
  runId: string; createdAt: string; updatedAt: string; deliveredAt: string | null;
}> = {}) {
  return {
    runId: "run-1",
    createdAt: RECENT,
    updatedAt: RECENT,
    deliveredAt: null,
    ...overrides,
  };
}

const BASE_ARGS = {
  messages: [],
  readMarkers: {},
  workers: [],
  agents: [],
  queuedMessages: [],
  workerOutputObservedAtByRunId: {},
  nowMs: NOW,
};

// ── getSidebarRunLastActivityAt ──────────────────────────────────────────────

describe("getSidebarRunLastActivityAt", () => {
  it("returns null when no messages or observations", () => {
    const result = getSidebarRunLastActivityAt({ ...BASE_ARGS, run: makeRun() });
    expect(result).toBeNull();
  });

  it("returns user message timestamp", () => {
    const result = getSidebarRunLastActivityAt({
      ...BASE_ARGS,
      run: makeRun(),
      messages: [makeMsg({ createdAt: RECENT })],
    });
    expect(result).toBe(RECENT);
  });

  it("does not count supervisor/intervention messages as user input", () => {
    const result = getSidebarRunLastActivityAt({
      ...BASE_ARGS,
      run: makeRun(),
      messages: [
        makeMsg({ role: "supervisor", kind: null, createdAt: RECENT }),
        makeMsg({ role: "user", kind: "intervention", createdAt: RECENT }),
        makeMsg({ role: "user", kind: "internal", createdAt: RECENT }),
      ],
    });
    expect(result).toBeNull();
  });

  it("counts queued message deliveredAt", () => {
    const result = getSidebarRunLastActivityAt({
      ...BASE_ARGS,
      run: makeRun(),
      queuedMessages: [makeQueuedMsg({ deliveredAt: RECENT })],
    });
    expect(result).toBe(RECENT);
  });

  it("returns live worker output observation", () => {
    const result = getSidebarRunLastActivityAt({
      ...BASE_ARGS,
      run: makeRun(),
      workerOutputObservedAtByRunId: { "run-1": RECENT },
    });
    expect(result).toBe(RECENT);
  });

  it("returns max of user message and worker output", () => {
    const workerAt = new Date(NOW - 2 * 60 * 1000).toISOString(); // 2 min ago
    const msgAt = new Date(NOW - 3 * 60 * 1000).toISOString(); // 3 min ago
    const result = getSidebarRunLastActivityAt({
      ...BASE_ARGS,
      run: makeRun(),
      messages: [makeMsg({ createdAt: msgAt })],
      workerOutputObservedAtByRunId: { "run-1": workerAt },
    });
    expect(result).toBe(workerAt);
  });
});

// ── isSidebarRunCurrentlyWorking ─────────────────────────────────────────────

describe("isSidebarRunCurrentlyWorking", () => {
  it("terminal run is never working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "done" }),
      workers: [makeWorker({ status: "working" })],
      agents: [],
    })).toBe(false);
  });

  it("failed run is never working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "failed" }),
      workers: [makeWorker({ status: "working" })],
      agents: [],
    })).toBe(false);
  });

  it("needs_recovery run is not working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "needs_recovery" }),
      workers: [],
      agents: [],
    })).toBe(false);
  });

  it("running run with active worker is working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "running" }),
      workers: [makeWorker({ status: "working" })],
      agents: [],
    })).toBe(true);
  });

  it("running run with no workers is still working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "running" }),
      workers: [],
      agents: [],
    })).toBe(true);
  });

  it("running run with active agent is working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "running" }),
      workers: [makeWorker({ status: "done" })],
      agents: [makeAgent({ name: "worker-1", state: "working" })],
    })).toBe(true);
  });

  it("stale active worker does not make terminal run working", () => {
    expect(isSidebarRunCurrentlyWorking({
      run: makeRun({ status: "done" }),
      workers: [makeWorker({ status: "working" })],
      agents: [makeAgent({ state: "working" })],
    })).toBe(false);
  });
});

// ── classifySidebarRun ───────────────────────────────────────────────────────

describe("classifySidebarRun", () => {
  it("unread run is active", () => {
    const run = makeRun({ status: "done", updatedAt: RECENT });
    const messages = [makeMsg({ role: "assistant", createdAt: RECENT })];
    const result = classifySidebarRun({ ...BASE_ARGS, run, messages });
    expect(result.isUnread).toBe(true);
    expect(result.isActive).toBe(true);
  });

  it("working run is active", () => {
    const run = makeRun({ status: "running" });
    const result = classifySidebarRun({
      ...BASE_ARGS,
      run,
      workers: [makeWorker({ status: "working" })],
    });
    expect(result.isWorking).toBe(true);
    expect(result.isActive).toBe(true);
  });

  it("recent activity run is active", () => {
    const result = classifySidebarRun({
      ...BASE_ARGS,
      run: makeRun(),
      messages: [makeMsg({ createdAt: RECENT })],
    });
    expect(result.isRecent).toBe(true);
    expect(result.isActive).toBe(true);
  });

  it("old read terminal run is not active", () => {
    const run = makeRun({ status: "done", updatedAt: OLD });
    const result = classifySidebarRun({
      ...BASE_ARGS,
      run,
      readMarkers: { "run-1": NOW.toString() },
      messages: [makeMsg({ createdAt: OLD })],
    });
    expect(result.isActive).toBe(false);
  });

  it("recent activity beyond 20 minutes is not recent", () => {
    const result = classifySidebarRun({
      ...BASE_ARGS,
      run: makeRun(),
      messages: [makeMsg({ createdAt: OLD })],
    });
    expect(result.isRecent).toBe(false);
  });

  it("working-only run has deterministic activeSortAt", () => {
    const run = makeRun({ status: "running" });
    const result = classifySidebarRun({
      ...BASE_ARGS,
      run,
      workers: [makeWorker({ status: "working", updatedAt: RECENT })],
    });
    expect(result.activeSortAt).toBeTruthy();
  });

  it("unread-only run has deterministic activeSortAt", () => {
    const run = makeRun({ status: "done", updatedAt: RECENT });
    const messages = [makeMsg({ role: "assistant", createdAt: RECENT })];
    const result = classifySidebarRun({ ...BASE_ARGS, run, messages });
    expect(result.activeSortAt).toBeTruthy();
  });
});

// ── compareActiveSidebarRunsDesc ─────────────────────────────────────────────

describe("compareActiveSidebarRunsDesc", () => {
  it("sorts by activeSortAt descending", () => {
    const newer = { id: "b", createdAt: ANCIENT, activeSortAt: RECENT };
    const older = { id: "a", createdAt: ANCIENT, activeSortAt: OLD };
    expect(compareActiveSidebarRunsDesc(newer, older)).toBeLessThan(0);
    expect(compareActiveSidebarRunsDesc(older, newer)).toBeGreaterThan(0);
  });

  it("ties broken by createdAt descending", () => {
    const newerCreated = { id: "b", createdAt: RECENT, activeSortAt: OLD };
    const olderCreated = { id: "a", createdAt: OLD, activeSortAt: OLD };
    expect(compareActiveSidebarRunsDesc(newerCreated, olderCreated)).toBeLessThan(0);
  });

  it("ties broken by id ascending as final tiebreaker", () => {
    const a = { id: "aaa", createdAt: OLD, activeSortAt: OLD };
    const b = { id: "bbb", createdAt: OLD, activeSortAt: OLD };
    expect(compareActiveSidebarRunsDesc(a, b)).toBeLessThan(0);
  });
});

// ── buildActiveConversationGroups ────────────────────────────────────────────

function makeGroup(path: string, runs: Array<{ id: string; status: string; createdAt: string }>): SidebarGroup {
  return {
    path,
    name: path.split("/").pop() || path,
    runs: runs.map((r) => ({
      id: r.id,
      title: `Run ${r.id}`,
      path: `${path}/${r.id}`,
      status: r.status,
      createdAt: r.createdAt,
    })),
  };
}

describe("buildActiveConversationGroups", () => {
  it("hides projects with no active sessions", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, readMarkers: { "run-1": NOW.toString() } });
    expect(result).toHaveLength(0);
  });

  it("includes projects with unread sessions", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const messages = [{ runId: "run-1", role: "assistant", kind: null, createdAt: RECENT }];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, messages });
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(1);
  });

  it("includes projects with working sessions", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "running", createdAt: ANCIENT }])];
    const workers = [makeWorker({ runId: "run-1", status: "working" })];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, workers });
    expect(result).toHaveLength(1);
  });

  it("includes sessions with recent user input", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const messages = [makeMsg({ createdAt: RECENT })];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, messages });
    expect(result).toHaveLength(1);
  });

  it("excludes sessions with only old activity", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const messages = [makeMsg({ createdAt: OLD })];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, messages, readMarkers: { "run-1": NOW.toString() } });
    expect(result).toHaveLength(0);
  });

  it("sorts runs within group by activeSortAt desc", () => {
    const groups = [makeGroup("/proj/a", [
      { id: "run-old", status: "done", createdAt: ANCIENT },
      { id: "run-new", status: "done", createdAt: ANCIENT },
    ])];
    const newerAt = new Date(NOW - 2 * 60 * 1000).toISOString();
    const olderAt = new Date(NOW - 10 * 60 * 1000).toISOString();
    const messages = [
      makeMsg({ runId: "run-old", createdAt: olderAt }),
      makeMsg({ runId: "run-new", createdAt: newerAt }),
    ];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, messages });
    expect(result[0].runs[0].id).toBe("run-new");
    expect(result[0].runs[1].id).toBe("run-old");
  });

  it("sorts projects by newest child activity desc", () => {
    const projA = makeGroup("/proj/a", [{ id: "run-a", status: "done", createdAt: ANCIENT }]);
    const projB = makeGroup("/proj/b", [{ id: "run-b", status: "done", createdAt: ANCIENT }]);
    const newerAt = new Date(NOW - 2 * 60 * 1000).toISOString();
    const olderAt = new Date(NOW - 10 * 60 * 1000).toISOString();
    const messages = [
      makeMsg({ runId: "run-a", createdAt: olderAt }),
      makeMsg({ runId: "run-b", createdAt: newerAt }),
    ];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups: [projA, projB], messages });
    expect(result[0].path).toBe("/proj/b");
    expect(result[1].path).toBe("/proj/a");
  });

  it("terminal run with stale active worker is not working", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const workers = [makeWorker({ runId: "run-1", status: "working" })];
    const result = buildActiveConversationGroups({ ...BASE_ARGS, groups, workers, readMarkers: { "run-1": NOW.toString() } });
    // Not active unless there's also an unread or recent signal
    expect(result).toHaveLength(0);
  });

  it("includes recent worker-output observed via live cursor observation", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const result = buildActiveConversationGroups({
      ...BASE_ARGS,
      groups,
      workerOutputObservedAtByRunId: { "run-1": RECENT },
    });
    expect(result).toHaveLength(1);
  });

  it("keeps selected run visible even when read, not working, and not recent", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const result = buildActiveConversationGroups({
      ...BASE_ARGS,
      groups,
      readMarkers: { "run-1": NOW.toString() },
      selectedRunId: "run-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].runs[0].id).toBe("run-1");
  });

  it("does not keep a non-selected stale read run visible", () => {
    const groups = [makeGroup("/proj/a", [{ id: "run-1", status: "done", createdAt: ANCIENT }])];
    const result = buildActiveConversationGroups({
      ...BASE_ARGS,
      groups,
      readMarkers: { "run-1": NOW.toString() },
      selectedRunId: "run-2",
    });
    expect(result).toHaveLength(0);
  });
});

// ── filterActiveConversationGroups ───────────────────────────────────────────

describe("filterActiveConversationGroups", () => {
  it("returns all groups when no search query", () => {
    const groups: SidebarGroup[] = [
      { path: "/proj/a", name: "a", runs: [{ id: "r1", title: "run 1", path: "/proj/a/r1", status: "done", createdAt: ANCIENT }] },
    ];
    expect(filterActiveConversationGroups(groups, "")).toEqual(groups);
  });

  it("project name match shows all active sessions in that project", () => {
    const groups: SidebarGroup[] = [
      {
        path: "/proj/myproject",
        name: "myproject",
        runs: [
          { id: "r1", title: "something else", path: "/proj/myproject/r1", status: "done", createdAt: ANCIENT },
          { id: "r2", title: "another thing", path: "/proj/myproject/r2", status: "done", createdAt: ANCIENT },
        ],
      },
    ];
    const result = filterActiveConversationGroups(groups, "myproject");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(2);
  });

  it("non-matching project only shows sessions matching by title or path", () => {
    const groups: SidebarGroup[] = [
      {
        path: "/proj/other",
        name: "other",
        runs: [
          { id: "r1", title: "fix login bug", path: "/proj/other/r1", status: "done", createdAt: ANCIENT },
          { id: "r2", title: "refactor auth", path: "/proj/other/r2", status: "done", createdAt: ANCIENT },
        ],
      },
    ];
    const result = filterActiveConversationGroups(groups, "login");
    expect(result[0].runs.map((r) => r.id)).toEqual(["r1"]);
  });

  it("hides project when no session matches and project name does not match", () => {
    const groups: SidebarGroup[] = [
      {
        path: "/proj/other",
        name: "other",
        runs: [{ id: "r1", title: "something", path: "/proj/other/r1", status: "done", createdAt: ANCIENT }],
      },
    ];
    const result = filterActiveConversationGroups(groups, "xyz-nomatch");
    expect(result).toHaveLength(0);
  });
});
