import { describe, expect, it } from "vitest";
import { MAIN_DESK_ID, OfficeRelationsManager } from "@/interface/office/OfficeRelationsManager";
import {
  buildOfficeLayout,
  describeDeskRelations,
  OFFICE_SINGLE_ROOM_MAX,
  roomForWorker,
} from "@/interface/office/office-model";
import type { AgentActivity } from "@/interface/office/deriveAgentActivity";

function relations(manager: OfficeRelationsManager) {
  return Object.values(manager.getSnapshot());
}

describe("OfficeRelationsManager", () => {
  it("opens a delegation and closes it once the worker acts, not on prompt delivery", () => {
    const manager = new OfficeRelationsManager();
    manager.onNamedEvent({ kind: "supervisor.delegated", runId: "r", toWorkerId: "w1", mode: "spawn", interventionType: null, intentPreview: "x" });
    expect(relations(manager)).toEqual([{ kind: "delegated", fromId: MAIN_DESK_ID, toId: "w1" }]);

    manager.onNamedEvent({ kind: "worker.activity", workerId: "w1", activity: "working", source: "turn", entrySeq: 1 });
    expect(relations(manager)).toHaveLength(1);

    manager.onNamedEvent({ kind: "worker.activity", workerId: "w1", activity: "researching", source: "tool_kind", entrySeq: 2 });
    expect(relations(manager)).toEqual([]);
  });

  it("tracks a failover handoff until the new worker acts", () => {
    const manager = new OfficeRelationsManager();
    manager.onNamedEvent({ kind: "worker.failover_completed", runId: "r", outgoingWorkerId: "old", newWorkerId: "new", newType: "claude" });
    expect(relations(manager)).toEqual([{ kind: "handoff", fromId: "old", toId: "new" }]);
    manager.onNamedEvent({ kind: "worker.activity", workerId: "old", activity: "writing", source: "tool_kind", entrySeq: 3 });
    expect(relations(manager)).toHaveLength(1);
    manager.onNamedEvent({ kind: "worker.activity", workerId: "new", activity: "writing", source: "tool_kind", entrySeq: 1 });
    expect(relations(manager)).toEqual([]);
  });

  it("keeps a review open through activity and closes it on review_finished", () => {
    const manager = new OfficeRelationsManager();
    manager.onNamedEvent({ kind: "worker.review_started", runId: "r", reviewerWorkerId: "rev", subjectWorkerId: "plan", reviewKind: "plan", round: 1 });
    manager.onNamedEvent({ kind: "worker.activity", workerId: "plan", activity: "writing", source: "tool_kind", entrySeq: 9 });
    expect(relations(manager)).toEqual([{ kind: "review", fromId: "rev", toId: "plan" }]);
    manager.onNamedEvent({ kind: "worker.review_finished", runId: "r", reviewerWorkerId: "rev", subjectWorkerId: "plan", reviewKind: "plan", outcome: "no_findings" });
    expect(relations(manager)).toEqual([]);
  });

  it("is idempotent under replay, ignores malformed frames, and resets on resync", () => {
    const manager = new OfficeRelationsManager();
    const frame = { kind: "worker.review_started", reviewerWorkerId: "rev", subjectWorkerId: "plan" };
    manager.onNamedEvent(frame);
    const snapshot = manager.getSnapshot();
    manager.onNamedEvent(frame);
    expect(manager.getSnapshot()).toBe(snapshot);

    manager.onNamedEvent(null);
    manager.onNamedEvent({ kind: "worker.review_started", reviewerWorkerId: "rev" });
    manager.onNamedEvent({ kind: "supervisor.delegated" });
    expect(relations(manager)).toHaveLength(1);

    manager.reset();
    expect(relations(manager)).toEqual([]);
  });
});

describe("describeDeskRelations", () => {
  const deskNumbers = new Map([["rev", 4], ["plan", 1], ["w2", 2]]);
  const all = [
    { kind: "review" as const, fromId: "rev", toId: "plan" },
    { kind: "delegated" as const, fromId: MAIN_DESK_ID, toId: "w2" },
    { kind: "handoff" as const, fromId: "gone", toId: "w2" },
  ];

  it("gives each desk its direction and counterpart number", () => {
    expect(describeDeskRelations("rev", all, deskNumbers)).toEqual([{ kind: "review", direction: "out", counterpartNumber: 1 }]);
    expect(describeDeskRelations("plan", all, deskNumbers)).toEqual([{ kind: "review", direction: "in", counterpartNumber: 4 }]);
    expect(describeDeskRelations(MAIN_DESK_ID, all, deskNumbers)).toEqual([{ kind: "delegated", direction: "out", counterpartNumber: 2 }]);
  });

  it("drops relations whose counterpart is not on screen", () => {
    expect(describeDeskRelations("w2", all, deskNumbers)).toEqual([{ kind: "delegated", direction: "in", counterpartNumber: null }]);
  });
});

describe("office rooms", () => {
  function inputs(roles: Array<string | null>, activity: AgentActivity = "working") {
    return roles.map((workerRole, index) => ({
      worker: { id: `w${index}`, runId: "r", type: "codex", status: "working", workerNumber: index + 1, workerRole },
      activity,
    }));
  }

  it("maps worker roles to rooms", () => {
    expect(roomForWorker({ workerRole: "implementation" })).toBe("implementation");
    expect(roomForWorker({ workerRole: "validation" })).toBe("validation");
    expect(roomForWorker({ workerRole: "plan_review" })).toBe("review");
    expect(roomForWorker({ workerRole: null })).toBe("main");
    expect(roomForWorker({ workerRole: "something-new" })).toBe("main");
  });

  it("keeps a single room up to the threshold or when every desk shares a role", () => {
    const small = buildOfficeLayout(inputs(["implementation", "validation", "plan_review"]));
    if (small.kind !== "office") throw new Error("expected office");
    expect(small.rooms).toHaveLength(1);

    const sameRole = buildOfficeLayout(inputs(Array.from({ length: OFFICE_SINGLE_ROOM_MAX + 3 }, () => "implementation")));
    if (sameRole.kind !== "office") throw new Error("expected office");
    expect(sameRole.rooms.map((group) => group.room)).toEqual(["implementation"]);
  });

  it("groups a busy office by role in a fixed room order", () => {
    const layout = buildOfficeLayout(inputs(["validation", "implementation", null, "plan_review", "implementation", "validation"]));
    if (layout.kind !== "office") throw new Error("expected office");
    expect(layout.rooms.map((group) => [group.room, group.seats.map((seat) => seat.worker.id)])).toEqual([
      ["main", ["w2"]],
      ["implementation", ["w1", "w4"]],
      ["validation", ["w0", "w5"]],
      ["review", ["w3"]],
    ]);
  });
});
