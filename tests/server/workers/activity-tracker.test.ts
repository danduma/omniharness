import { promises as fs } from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { getAppDataPath } from "@/server/app-root";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { __resetOutputStoreCachesForTests, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { __resetWorkerActivityForTests, classifyEntryActivity } from "@/server/workers/activity-tracker";

type BridgeEntry = NonNullable<Parameters<typeof writeWorkerOutputEntries>[2]>[number];

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toolCall(id: string, toolKind: string, text: string): BridgeEntry {
  return { id, type: "tool_call", text, toolKind, status: "in_progress", timestamp: "2026-10-07T00:00:00.000Z" } as BridgeEntry;
}

function activityEvents() {
  return getNamedEventsSince(0).events
    .map((entry) => entry.event)
    .filter((event): event is Extract<NamedEvent, { kind: "worker.activity" }> => event.kind === "worker.activity");
}

afterEach(() => {
  __resetOutputStoreCachesForTests();
  __resetNamedEventsForTests();
  __resetWorkerActivityForTests();
});

describe("classifyEntryActivity", () => {
  it("classifies tool calls, human input, and turn entries", () => {
    expect(classifyEntryActivity({ type: "tool_call", text: "Read file", toolKind: "read", seq: 1 }))
      .toEqual({ activity: "researching", source: "tool_kind" });
    expect(classifyEntryActivity({ type: "tool_call", text: "pnpm test:lifecycle", toolKind: "execute", seq: 1 }))
      .toEqual({ activity: "testing", source: "command_pattern" });
    expect(classifyEntryActivity({ type: "tool_call", text: "Think", toolKind: "think", seq: 1 }))
      .toEqual({ activity: "working", source: "tool_kind" });
    expect(classifyEntryActivity({ type: "permission", text: "Allow?", status: "pending", seq: 1 }))
      .toEqual({ activity: "waiting_user", source: "interaction" });
    expect(classifyEntryActivity({ type: "elicitation", text: "Answer", status: "answered", seq: 1 }))
      .toEqual({ activity: "working", source: "interaction" });
    expect(classifyEntryActivity({ type: "supervisor_input", text: "go", seq: 1 }))
      .toEqual({ activity: "working", source: "turn" });
    expect(classifyEntryActivity({ type: "tool_call_update", text: "done", seq: 1 })).toBeNull();
    expect(classifyEntryActivity({ type: "lifecycle", text: "spawned", seq: 1 })).toBeNull();
  });
});

describe("worker.activity emission", () => {
  it("emits one event per transition with prev, source and the entry seq", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await appendUserInputOnDelivery({ runId, workerId, text: "fix the bug", deliveredAt: new Date("2026-10-07T00:00:00.000Z") });
      await writeWorkerOutputEntries(runId, workerId, [toolCall("t1", "read", "Read src/a.ts")]);
      await writeWorkerOutputEntries(runId, workerId, [toolCall("t1", "read", "Read src/a.ts"), toolCall("t2", "search", "rg foo")]);
      await writeWorkerOutputEntries(runId, workerId, [toolCall("t2", "search", "rg foo"), toolCall("t3", "edit", "Edit src/a.ts")]);

      expect(activityEvents().map(({ activity, prev, source, entrySeq }) => ({ activity, prev, source, entrySeq }))).toEqual([
        { activity: "working", prev: null, source: "turn", entrySeq: 1 },
        { activity: "researching", prev: "working", source: "tool_kind", entrySeq: 2 },
        { activity: "writing", prev: "researching", source: "tool_kind", entrySeq: 4 },
      ]);
    } finally {
      await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
    }
  });

  it("publishes only the net transition of a large batch", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, workerId, [
        toolCall("a", "read", "Read"),
        toolCall("b", "edit", "Edit"),
        toolCall("c", "execute", "git status"),
        toolCall("d", "execute", "npx vitest run"),
      ]);
      const events = activityEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ runId, workerId, activity: "testing", prev: null, source: "command_pattern", entrySeq: 4 });
    } finally {
      await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
    }
  });

  it("tracks workers independently and stays silent for unclassifiable entries", async () => {
    const runId = uniqueId("run");
    const first = uniqueId("worker");
    const second = uniqueId("worker");
    try {
      await writeWorkerOutputEntries(runId, first, [toolCall("x", "edit", "Edit")]);
      await writeWorkerOutputEntries(runId, second, [toolCall("x", "edit", "Edit")]);
      await writeWorkerOutputEntries(runId, first, [
        { id: "plan-1", type: "plan", text: "1. step", timestamp: "2026-10-07T00:00:00.000Z" } as BridgeEntry,
      ]);
      expect(activityEvents().map((event) => event.workerId)).toEqual([first, second]);
    } finally {
      await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
    }
  });
});
