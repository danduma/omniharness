import { describe, expect, it } from "vitest";
import { EventStreamStateManager } from "@/app/home/EventStreamStateManager";
import { EventStreamSnapshotCacheManager } from "@/app/home/EventStreamSnapshotCacheManager";
import { WorkerOutputLineCacheManager } from "@/app/home/WorkerOutputLineCacheManager";
import type { EventStreamState } from "@/app/home/types";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function createState(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    ...overrides,
  };
}

describe("EventStreamStateManager", () => {
  it("hydrates a scoped event stream snapshot before the next network update arrives", () => {
    const storage = new MemoryStorage();
    const snapshotCache = new EventStreamSnapshotCacheManager({
      storage,
      storageKey: "test-event-stream-snapshot-cache",
    });

    const cachedState = createState({
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "message",
        content: "Already visible before reload",
        createdAt: "2026-05-04T00:00:00.000Z",
      }],
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "implementation",
        status: "running",
        createdAt: "2026-05-04T00:00:00.000Z",
        projectPath: "/repo",
        title: "Cached conversation",
      }],
    });

    snapshotCache.rememberState(cachedState, "run-1");

    const reloadedManager = new EventStreamStateManager(createState(), {
      snapshotCache: new EventStreamSnapshotCacheManager({
        storage,
        storageKey: "test-event-stream-snapshot-cache",
      }),
      snapshotCacheScope: "run-1",
    });

    expect(reloadedManager.getSnapshot().runs.map((run) => run.title)).toEqual(["Cached conversation"]);
    expect(reloadedManager.getSnapshot().messages.map((message) => message.content)).toEqual([
      "Already visible before reload",
    ]);
  });

  it("does not let a cached working snapshot override a fresh completed bootstrap", () => {
    const storage = new MemoryStorage();
    const snapshotCache = new EventStreamSnapshotCacheManager({
      storage,
      storageKey: "test-event-stream-snapshot-cache",
    });

    snapshotCache.rememberState(createState({
      messages: [{
        id: "stale-message",
        runId: "run-1",
        role: "supervisor",
        kind: "update",
        content: "Still checking...",
        createdAt: "2026-05-04T00:00:00.000Z",
      }],
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "implementation",
        status: "running",
        createdAt: "2026-05-04T00:00:00.000Z",
        projectPath: "/repo",
        title: "Cached conversation",
      }],
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Still working",
      }],
    }), "run-1");

    const reloadedManager = new EventStreamStateManager(createState({
      messages: [{
        id: "completion-message",
        runId: "run-1",
        role: "supervisor",
        kind: "completion",
        content: "Final summary",
        createdAt: "2026-05-04T00:01:00.000Z",
      }],
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "implementation",
        status: "done",
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:01:00.000Z",
        projectPath: "/repo",
        title: "Cached conversation",
      }],
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "cancelled" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "cancelled",
        currentText: "",
        lastText: "Finished",
        bridgeMissing: true,
      }],
    }), {
      snapshotCache: new EventStreamSnapshotCacheManager({
        storage,
        storageKey: "test-event-stream-snapshot-cache",
      }),
      snapshotCacheScope: "run-1",
    });

    expect(reloadedManager.getSnapshot().runs[0].status).toBe("done");
    expect(reloadedManager.getSnapshot().messages.map((message) => message.id)).toEqual(["completion-message"]);
    expect(reloadedManager.getSnapshot().agents[0]).toEqual(expect.objectContaining({
      state: "cancelled",
      bridgeMissing: true,
    }));
  });

  it("persists worker output lines once globally and hydrates them after a reload", () => {
    const storage = new MemoryStorage();
    const cacheOptions = {
      storage,
      storageKey: "test-worker-output-cache",
      now: () => Date.parse("2026-05-04T00:00:10.000Z"),
    };

    new EventStreamStateManager(createState({
      agents: [
        {
          name: "run-1-worker-1",
          type: "codex",
          state: "working",
          outputEntries: [
            {
              id: "entry-0",
              type: "message",
              text: "Shared line\nShared line",
              timestamp: "2026-05-04T00:00:00.000Z",
            },
          ],
        },
        {
          name: "run-2-worker-1",
          type: "codex",
          state: "working",
          outputEntries: [
            {
              id: "entry-other-worker",
              type: "message",
              text: "Shared line",
              timestamp: "2026-05-04T00:00:01.000Z",
            },
          ],
        },
      ],
    }), {
      outputLineCache: new WorkerOutputLineCacheManager(cacheOptions),
    });

    const persisted = JSON.parse(storage.getItem("test-worker-output-cache") ?? "{}") as {
      lines?: Record<string, { text: string }>;
      workers?: Record<string, unknown>;
    };
    expect(Object.values(persisted.lines ?? {}).map((line) => line.text)).toEqual(["Shared line"]);
    expect(Object.keys(persisted.workers ?? {}).sort()).toEqual(["run-1-worker-1", "run-2-worker-1"]);
    const persistedAfterFirstSnapshot = storage.getItem("test-worker-output-cache");

    new EventStreamStateManager(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [{
          id: "entry-0",
          type: "message",
          text: "Shared line\nShared line",
          timestamp: "2026-05-04T00:00:00.000Z",
        }],
      }],
    }), {
      outputLineCache: new WorkerOutputLineCacheManager(cacheOptions),
    });
    expect(storage.getItem("test-worker-output-cache")).toBe(persistedAfterFirstSnapshot);

    const reloadedManager = new EventStreamStateManager(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [
          {
            id: "output-entries-omitted:entry-0:entry-9",
            type: "message",
            text: "8 earlier output entries omitted from this live payload.",
            timestamp: "2026-05-04T00:00:09.000Z",
          },
        ],
      }],
    }), {
      outputLineCache: new WorkerOutputLineCacheManager(cacheOptions),
    });

    expect(reloadedManager.getSnapshot().agents[0].outputEntries?.map((entry) => [entry.id, entry.text])).toEqual([
      ["entry-0", "Shared line\nShared line"],
      ["output-entries-omitted:entry-0:entry-9", "8 earlier output entries omitted from this live payload."],
    ]);
  });

  it("cleans stale worker output caches while preserving recent worker lines", () => {
    const storage = new MemoryStorage();
    const oldNow = Date.parse("2026-05-04T00:00:00.000Z");
    const oldCache = new WorkerOutputLineCacheManager({
      storage,
      storageKey: "test-worker-output-cache",
      now: () => oldNow,
      cleanupIntervalMs: 0,
      workerTtlMs: 1_000,
    });
    oldCache.rememberState(createState({
      agents: [{
        name: "stale-worker",
        type: "codex",
        state: "done",
        outputEntries: [{
          id: "stale-entry",
          type: "message",
          text: "Stale line",
          timestamp: "2026-05-04T00:00:00.000Z",
        }],
      }],
    }));

    const recentNow = oldNow + 2_000;
    const recentCache = new WorkerOutputLineCacheManager({
      storage,
      storageKey: "test-worker-output-cache",
      now: () => recentNow,
      cleanupIntervalMs: 0,
      workerTtlMs: 1_000,
    });
    recentCache.rememberState(createState({
      agents: [{
        name: "recent-worker",
        type: "codex",
        state: "working",
        outputEntries: [{
          id: "recent-entry",
          type: "message",
          text: "Recent line",
          timestamp: "2026-05-04T00:00:02.000Z",
        }],
      }],
    }));

    const persisted = JSON.parse(storage.getItem("test-worker-output-cache") ?? "{}") as {
      lines?: Record<string, { text: string }>;
      workers?: Record<string, unknown>;
    };

    expect(Object.keys(persisted.workers ?? {})).toEqual(["recent-worker"]);
    expect(Object.values(persisted.lines ?? {}).map((line) => line.text)).toEqual(["Recent line"]);
  });

  it("keeps visited conversation transcript messages when another run payload arrives", () => {
    const manager = new EventStreamStateManager(createState({
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "Run one",
        },
      ],
      messages: [
        {
          id: "run-1-message-1",
          runId: "run-1",
          role: "user",
          content: "Original run one request",
          createdAt: "2026-05-04T00:00:00.000Z",
        },
        {
          id: "run-1-message-2",
          runId: "run-1",
          role: "supervisor",
          content: "Run one response",
          createdAt: "2026-05-04T00:00:01.000Z",
        },
      ],
    }));

    const next = manager.update(createState({
      runs: [
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          projectPath: null,
          title: "Run two",
        },
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "Run one",
        },
      ],
      messages: [
        {
          id: "run-2-message-1",
          runId: "run-2",
          role: "user",
          content: "Run two request",
          createdAt: "2026-05-04T00:01:00.000Z",
        },
      ],
    }));

    expect(next.messages.map((message) => message.id)).toEqual([
      "run-1-message-1",
      "run-1-message-2",
      "run-2-message-1",
    ]);
  });

  it("does not let an older scoped payload roll a generated conversation title back", () => {
    const manager = new EventStreamStateManager(createState({
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          updatedAt: "2026-05-04T00:00:10.000Z",
          projectPath: null,
          title: "Debug Gemini title flicker",
        },
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          updatedAt: "2026-05-04T00:01:10.000Z",
          projectPath: null,
          title: "Compare direct sessions",
        },
      ],
    }));

    const next = manager.update(createState({
      runs: [
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          updatedAt: "2026-05-04T00:01:00.000Z",
          projectPath: null,
          title: "compare the two direct control sessions and tell me what is happening",
        },
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          updatedAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "debug title flicker when switching between sessions",
        },
      ],
    }));

    expect(next.runs.map((run) => [run.id, run.title])).toEqual([
      ["run-2", "Compare direct sessions"],
      ["run-1", "Debug Gemini title flicker"],
    ]);
  });

  it("keeps visited worker agent output available across scoped conversation switches", () => {
    const manager = new EventStreamStateManager(createState({
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "Run one",
        },
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          projectPath: null,
          title: "Run two",
        },
      ],
      workers: [
        { id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" },
        { id: "run-2-worker-1", runId: "run-2", type: "codex", status: "working" },
      ],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [{
          id: "run-1-entry-1",
          type: "message",
          text: "Run one cached line",
          timestamp: "2026-05-04T00:00:01.000Z",
        }],
      }],
    }));

    const afterSwitchAway = manager.update(createState({
      runs: [
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          projectPath: null,
          title: "Run two",
        },
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "Run one",
        },
      ],
      workers: [
        { id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" },
        { id: "run-2-worker-1", runId: "run-2", type: "codex", status: "working" },
      ],
      agents: [{
        name: "run-2-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [{
          id: "run-2-entry-1",
          type: "message",
          text: "Run two line",
          timestamp: "2026-05-04T00:01:01.000Z",
        }],
      }],
    }));

    expect(afterSwitchAway.agents.map((agent) => agent.name).sort()).toEqual([
      "run-1-worker-1",
      "run-2-worker-1",
    ]);

    const runOneAgent = afterSwitchAway.agents.find((agent) => agent.name === "run-1-worker-1");
    expect(runOneAgent?.outputEntries?.map((entry) => entry.text)).toEqual(["Run one cached line"]);
  });

  it("hydrates worker output from the line cache on normal stream updates", () => {
    const storage = new MemoryStorage();
    const cacheOptions = {
      storage,
      storageKey: "test-worker-output-cache",
      now: () => Date.parse("2026-05-04T00:00:10.000Z"),
    };
    const cache = new WorkerOutputLineCacheManager(cacheOptions);
    cache.rememberState(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [{
          id: "entry-0",
          type: "message",
          text: "Hydrated cached line",
          timestamp: "2026-05-04T00:00:00.000Z",
        }],
      }],
    }));

    const manager = new EventStreamStateManager(createState(), {
      outputLineCache: new WorkerOutputLineCacheManager(cacheOptions),
    });

    const next = manager.update(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [{
          id: "output-entries-omitted:entry-0:entry-9",
          type: "message",
          text: "8 earlier output entries omitted from this live payload.",
          timestamp: "2026-05-04T00:00:09.000Z",
        }],
      }],
    }));

    expect(next.agents[0].outputEntries?.map((entry) => [entry.id, entry.text])).toEqual([
      ["entry-0", "Hydrated cached line"],
      ["output-entries-omitted:entry-0:entry-9", "8 earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail."],
    ]);
  });

  it("replaces cached transcript messages for the run included in the latest payload", () => {
    const manager = new EventStreamStateManager(createState({
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "Run one",
        },
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          projectPath: null,
          title: "Run two",
        },
      ],
      messages: [
        {
          id: "run-1-message-stale",
          runId: "run-1",
          role: "supervisor",
          content: "Stale run one response",
          createdAt: "2026-05-04T00:00:00.000Z",
        },
        {
          id: "run-2-message-1",
          runId: "run-2",
          role: "user",
          content: "Run two request",
          createdAt: "2026-05-04T00:01:00.000Z",
        },
      ],
    }));

    const next = manager.update(createState({
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-05-04T00:00:00.000Z",
          projectPath: null,
          title: "Run one",
        },
        {
          id: "run-2",
          planId: "plan-2",
          status: "running",
          createdAt: "2026-05-04T00:01:00.000Z",
          projectPath: null,
          title: "Run two",
        },
      ],
      messages: [
        {
          id: "run-1-message-fresh",
          runId: "run-1",
          role: "user",
          content: "Fresh run one request",
          createdAt: "2026-05-04T00:00:02.000Z",
        },
      ],
    }));

    expect(next.messages.map((message) => message.id)).toEqual([
      "run-1-message-fresh",
      "run-2-message-1",
    ]);
  });

  it("keeps live worker output when a persisted-only snapshot arrives for the same active worker", () => {
    const manager = new EventStreamStateManager(createState());
    manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Reading files",
        displayText: "Reading files",
        bridgeMissing: false,
      }],
    }));

    const next = manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "",
        displayText: "",
        lastText: "Older persisted output",
        outputEntries: [],
        bridgeMissing: true,
      }],
    }));

    expect(next.agents[0]).toEqual(expect.objectContaining({
      name: "run-1-worker-1",
      currentText: "Reading files",
      displayText: "Reading files",
      bridgeMissing: false,
    }));
  });

  it("accepts persisted-only snapshots for finished workers", () => {
    const manager = new EventStreamStateManager(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Reading files",
        displayText: "Reading files",
        bridgeMissing: false,
      }],
    }));

    const next = manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "done" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "done",
        currentText: "",
        displayText: "",
        lastText: "Finished",
        bridgeMissing: true,
      }],
    }));

    expect(next.agents[0]).toEqual(expect.objectContaining({
      state: "done",
      lastText: "Finished",
      bridgeMissing: true,
    }));
  });

  it("drops cached live agents once the persisted worker is terminal", () => {
    const manager = new EventStreamStateManager(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Still typing",
        displayText: "Still typing",
        bridgeMissing: false,
      }],
    }));

    const next = manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "cancelled" }],
      agents: [],
    }));

    expect(next.agents).toEqual([]);
  });

  it("keeps previously seen worker output entries when live snapshots only include a compact window", () => {
    const manager = new EventStreamStateManager(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [
          {
            id: "entry-0",
            type: "message",
            text: "Started",
            timestamp: "2026-05-04T00:00:00.000Z",
          },
          {
            id: "entry-1",
            type: "message",
            text: "Middle work",
            timestamp: "2026-05-04T00:00:01.000Z",
          },
        ],
      }],
    }));

    const next = manager.update(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: "Middle work updated",
            timestamp: "2026-05-04T00:00:01.000Z",
          },
          {
            id: "entry-2",
            type: "tool_call_update",
            text: "Tool call completed",
            timestamp: "2026-05-04T00:00:02.000Z",
            toolCallId: "call-1",
            status: "completed",
          },
        ],
      }],
    }));

    expect(next.agents[0].outputEntries?.map((entry) => [entry.id, entry.text])).toEqual([
      ["entry-0", "Started"],
      ["entry-1", "Middle work updated"],
      ["entry-2", "Tool call completed"],
    ]);
  });

  it("removes omitted-history markers when a fuller worker history window arrives", () => {
    const manager = new EventStreamStateManager(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [
          {
            id: "entry-0",
            type: "message",
            text: "Started",
            timestamp: "2026-05-04T00:00:00.000Z",
          },
          {
            id: "output-entries-omitted:entry-0:entry-9",
            type: "message",
            text: "8 earlier output entries omitted from this live payload.",
            timestamp: "2026-05-04T00:00:01.000Z",
          },
          {
            id: "entry-9",
            type: "message",
            text: "Tail",
            timestamp: "2026-05-04T00:00:09.000Z",
          },
        ],
      }],
    }));

    const next = manager.update(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: Array.from({ length: 10 }, (_, index) => ({
          id: `entry-${index}`,
          type: "message" as const,
          text: `Entry ${index}`,
          timestamp: `2026-05-04T00:00:0${index}.000Z`,
        })),
      }],
    }));

    expect(next.agents[0].outputEntries?.some((entry) => entry.id.startsWith("output-entries-omitted:"))).toBe(false);
    expect(next.agents[0].outputEntries).toHaveLength(10);
  });

  it("does not show compact-window markers when the worker output is already cached", () => {
    const manager = new EventStreamStateManager(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: Array.from({ length: 90 }, (_, index) => ({
          id: `entry-${index}`,
          type: "message" as const,
          text: `Entry ${index}`,
          timestamp: new Date(index * 1000).toISOString(),
        })),
      }],
    }));

    const next = manager.update(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [
          ...Array.from({ length: 6 }, (_, index) => ({
            id: `entry-${index}`,
            type: "message" as const,
            text: `Entry ${index}`,
            timestamp: new Date(index * 1000).toISOString(),
          })),
          {
            id: "output-entries-omitted:entry-5:entry-66",
            type: "message" as const,
            text: "60 earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.",
            timestamp: new Date(66_000).toISOString(),
          },
          ...Array.from({ length: 24 }, (_, index) => {
            const entryIndex = index + 66;
            return {
              id: `entry-${entryIndex}`,
              type: "message" as const,
              text: `Entry ${entryIndex}`,
              timestamp: new Date(entryIndex * 1000).toISOString(),
            };
          }),
        ],
      }],
    }));

    expect(next.agents[0].outputEntries?.some((entry) => entry.id.startsWith("output-entries-omitted:"))).toBe(false);
    expect(next.agents[0].outputEntries).toHaveLength(90);
  });

  it("keeps only the latest compact-window marker when actual entries are still missing", () => {
    const firstCompactWindow = [
      {
        id: "entry-0",
        type: "message" as const,
        text: "Entry 0",
        timestamp: "2026-05-04T00:00:00.000Z",
      },
      {
        id: "output-entries-omitted:entry-0:entry-60",
        type: "message" as const,
        text: "59 earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.",
        timestamp: "2026-05-04T00:01:00.000Z",
      },
      {
        id: "entry-60",
        type: "message" as const,
        text: "Entry 60",
        timestamp: "2026-05-04T00:01:00.000Z",
      },
    ];
    const manager = new EventStreamStateManager(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: firstCompactWindow,
      }],
    }));

    const next = manager.update(createState({
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        outputEntries: [
          firstCompactWindow[0],
          {
            id: "output-entries-omitted:entry-0:entry-67",
            type: "message" as const,
            text: "66 earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.",
            timestamp: "2026-05-04T00:01:07.000Z",
          },
          {
            id: "entry-67",
            type: "message" as const,
            text: "Entry 67",
            timestamp: "2026-05-04T00:01:07.000Z",
          },
        ],
      }],
    }));

    const markers = next.agents[0].outputEntries?.filter((entry) => entry.id.startsWith("output-entries-omitted:"));
    expect(markers).toHaveLength(1);
    expect(markers?.[0].text).toContain("65 earlier output entries omitted");
    expect(next.agents[0].outputEntries?.map((entry) => entry.id)).toEqual([
      "entry-0",
      "entry-60",
      "output-entries-omitted:entry-0:entry-67",
      "entry-67",
    ]);
  });

  it("keeps existing selected-run messages when a scoped live payload omits them but includes newer worker messages", () => {
    const manager = new EventStreamStateManager(createState({
      messages: [{
        id: "user-message",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start the task",
        createdAt: "2026-05-14T15:15:49.000Z",
      }],
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "direct",
        status: "running",
        createdAt: "2026-05-14T15:15:49.000Z",
        updatedAt: "2026-05-14T15:15:49.000Z",
        title: "New conversation",
      }],
    }));

    const next = manager.update(createState({
      messages: [{
        id: "worker-message",
        runId: "run-1",
        role: "worker",
        kind: "direct",
        content: "Working on it",
        workerId: "run-1-worker-1",
        createdAt: "2026-05-14T15:16:00.000Z",
      }],
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "direct",
        status: "running",
        createdAt: "2026-05-14T15:15:49.000Z",
        updatedAt: "2026-05-14T15:16:00.000Z",
        title: "New conversation",
      }],
      workers: [{
        id: "run-1-worker-1",
        runId: "run-1",
        type: "gemini",
        status: "working",
        createdAt: "2026-05-14T15:15:49.000Z",
        updatedAt: "2026-05-14T15:16:00.000Z",
      }],
    }));

    expect(next.messages.map((message) => message.id)).toEqual(["user-message", "worker-message"]);
  });
});
