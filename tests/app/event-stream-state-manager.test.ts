import { describe, expect, it } from "vitest";
import { EventStreamStateManager } from "@/app/home/EventStreamStateManager";
import type { EventStreamState } from "@/app/home/types";

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
    validationRuns: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    ...overrides,
  };
}

describe("EventStreamStateManager", () => {
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
      "entry-67",
      "output-entries-omitted:entry-0:entry-67",
    ]);
  });
});
