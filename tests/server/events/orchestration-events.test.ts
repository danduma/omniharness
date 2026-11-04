import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetNamedEventsForTests,
  emitNamedEvent,
  getNamedEventsSince,
  registerNamedEventListener,
  type NamedEvent,
} from "@/server/events/named-events";

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  __resetNamedEventsForTests();
});

describe("orchestration named events", () => {
  it("records orchestration events scoped to their run", () => {
    emitNamedEvent({ kind: "orchestration.stage_claimed", runId: "run-a", stageId: "s1", stage: "plan", attempt: 1, reason: "first" });
    emitNamedEvent({ kind: "error.surfaced", code: "orchestration.budget_exceeded", message: "cap", surface: "banner", runId: "run-a" });
    const entries = getNamedEventsSince(0).events;
    expect(entries.map((entry) => entry.runId)).toEqual(["run-a", "run-a"]);
    expect((entries[1]!.event as NamedEvent).kind).toBe("error.surfaced");
  });

  it("delivers events to in-process listeners after recording them", async () => {
    const seen: string[] = [];
    const unregister = registerNamedEventListener("test.listener", (event) => {
      seen.push(event.kind);
    });
    emitNamedEvent({ kind: "orchestration.workflow_completed", runId: "run-a" });
    expect(seen).toEqual([]);
    await flush();
    expect(seen).toEqual(["orchestration.workflow_completed"]);
    unregister();
    emitNamedEvent({ kind: "orchestration.workflow_completed", runId: "run-a" });
    await flush();
    expect(seen).toHaveLength(1);
  });

  it("reports a throwing listener as an event instead of breaking emission", async () => {
    const unregister = registerNamedEventListener("test.throwing", () => {
      throw new Error("boom");
    });
    emitNamedEvent({ kind: "orchestration.workflow_completed", runId: "run-a" });
    await flush();
    unregister();
    const failure = getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent).find((event) => event.kind === "events.listener_failed");
    expect(failure).toMatchObject({ listener: "test.throwing", reason: "boom" });
  });
});
