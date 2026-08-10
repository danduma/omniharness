import { describe, expect, it } from "vitest";
import {
  MAX_ACP_PLAN_ITEM_CODE_POINTS,
  MAX_ACP_PLAN_ITEMS,
  normalizeAcpCorePlan,
  reduceWorkerPlanEntries,
  type AcpCorePlanUpdate,
} from "@/shared/acp-plan";
import type { WorkerEntry } from "@/shared/worker-entries";

function planUpdate(entries: AcpCorePlanUpdate["entries"]): AcpCorePlanUpdate {
  return {
    sessionUpdate: "plan",
    entries,
  };
}

function acceptedEntry(
  seq: number,
  sessionId: string,
  update: AcpCorePlanUpdate,
  id = `plan-${seq}`,
): WorkerEntry {
  const normalized = normalizeAcpCorePlan(update);
  if (!normalized.ok) throw new Error(normalized.reason);
  return {
    id,
    seq,
    type: "plan",
    text: normalized.items.map((item) => item.content).join("\n"),
    timestamp: new Date(1700000000000 + seq).toISOString(),
    raw: update,
    acpSessionId: sessionId,
    planProjection: "accepted_core",
    normalizedPlan: normalized.items,
  };
}

function boundary(seq: number, sessionId: string): WorkerEntry {
  return {
    id: `boundary-${seq}`,
    seq,
    type: "system_note",
    text: "",
    timestamp: new Date(1700000000000 + seq).toISOString(),
    acpSessionId: sessionId,
    planProjection: "session_reset",
    diagnosticOnly: true,
  };
}

describe("ACP core plan validation", () => {
  it("normalizes a complete plan while preserving order and duplicate content", () => {
    const result = normalizeAcpCorePlan(planUpdate([
      { content: "  Inspect source  ", priority: "high", status: "in_progress" },
      { content: "Inspect source", priority: "low", status: "pending" },
    ]));

    expect(result).toEqual({
      ok: true,
      items: [
        { id: "0", content: "Inspect source", priority: "high", status: "in_progress", order: 0 },
        { id: "1", content: "Inspect source", priority: "low", status: "pending", order: 1 },
      ],
    });
  });

  it("accepts an empty plan and rejects invalid or oversized entries", () => {
    expect(normalizeAcpCorePlan(planUpdate([]))).toEqual({ ok: true, items: [] });
    expect(normalizeAcpCorePlan(planUpdate([
      { content: "", priority: "medium", status: "pending" },
    ]))).toMatchObject({ ok: false, reason: "empty_content" });
    expect(normalizeAcpCorePlan(planUpdate([
      { content: "x", priority: "urgent" as never, status: "pending" },
    ]))).toMatchObject({ ok: false, reason: "invalid_priority" });
    expect(normalizeAcpCorePlan(planUpdate([
      { content: "x".repeat(MAX_ACP_PLAN_ITEM_CODE_POINTS + 1), priority: "medium", status: "pending" },
    ]))).toMatchObject({ ok: false, reason: "item_too_long" });
    expect(normalizeAcpCorePlan({
      sessionUpdate: "plan",
      entries: Array.from({ length: MAX_ACP_PLAN_ITEMS + 1 }, (_, index) => ({
        content: `item ${index}`,
        priority: "medium",
        status: "pending",
      })),
    })).toMatchObject({ ok: false, reason: "too_many_items" });
  });
});

describe("reduceWorkerPlanEntries", () => {
  it("replaces the complete list and ignores older sessions", () => {
    const entries = [
      boundary(1, "session-a"),
      acceptedEntry(2, "session-a", planUpdate([
        { content: "old", priority: "medium", status: "completed" },
      ])),
      boundary(3, "session-b"),
      acceptedEntry(4, "session-b", planUpdate([
        { content: "new", priority: "high", status: "in_progress" },
      ])),
      acceptedEntry(5, "session-a", planUpdate([
        { content: "stale", priority: "low", status: "pending" },
      ])),
    ];

    expect(reduceWorkerPlanEntries(entries, "run-1", "worker-1")).toMatchObject({
      acpSessionId: "session-b",
      planBoundarySeq: 3,
      lastEntrySeq: 4,
      visible: true,
      items: [{ id: "3:0", content: "new", status: "in_progress" }],
    });
  });

  it("returns a reset tombstone until the new session publishes a plan", () => {
    expect(reduceWorkerPlanEntries([
      boundary(8, "session-c"),
    ], "run-1", "worker-1")).toMatchObject({
      acpSessionId: "session-c",
      planBoundarySeq: 8,
      lastEntrySeq: 8,
      lastAcceptedEntryId: null,
      visible: false,
      items: [],
    });
  });
});
