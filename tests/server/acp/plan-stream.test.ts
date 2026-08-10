import { describe, expect, it } from "vitest";
import { AcpPlanStream } from "@/server/agent-runtime/acp/plan-stream";
import type { NamedEvent } from "@/server/events/named-events";
import type { WorkerEntry } from "@/shared/worker-entries";

function makeStream() {
  const entries: WorkerEntry[] = [];
  const events: NamedEvent[] = [];
  let seq = 0;
  const stream = new AcpPlanStream({
    append: async (_runId, _workerId, entry) => {
      const persisted = { ...entry, seq: ++seq } as WorkerEntry;
      entries.push(persisted);
      return { entry: persisted, appended: true };
    },
    read: async () => ({ entries: [...entries], latestSeq: seq }),
    emit: (event) => events.push(event),
  });
  return { stream, entries, events };
}

const corePlan = {
  sessionUpdate: "plan" as const,
  entries: [{ content: "Inspect source", priority: "high" as const, status: "in_progress" as const }],
};

describe("AcpPlanStream", () => {
  it("persists a session boundary and accepts only the bound complete plan", async () => {
    const { stream, entries, events } = makeStream();

    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");
    const accepted = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: corePlan,
    });

    expect(accepted.kind).toBe("accepted");
    expect(entries.map((entry) => entry.planProjection)).toEqual(["session_reset", "accepted_core"]);
    expect(events.map((event) => event.kind)).toEqual([
      "worker.entry_appended",
      "worker.plan_boundary_started",
      "worker.entry_appended",
      "worker.plan_updated",
    ]);
    expect((await stream.readWorkerPlan("run-1", "worker-1")).plan).toMatchObject({
      visible: true,
      items: [{ content: "Inspect source" }],
    });
  });

  it("stores stale and unsupported updates as diagnostic rows without changing the plan", async () => {
    const { stream, entries, events } = makeStream();
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");
    await stream.handleAcpSessionUpdate({ runId: "run-1", workerId: "worker-1", sessionId: "session-1", update: corePlan });

    const stale = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "old-session",
      update: { ...corePlan, entries: [{ ...corePlan.entries[0], content: "stale" }] },
    });
    const unsupported = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: { sessionUpdate: "plan_removed", id: "provider-plan" },
    });

    expect(stale).toMatchObject({ kind: "rejected", reason: "stale_session" });
    expect(unsupported).toMatchObject({ kind: "rejected", reason: "unsupported" });
    expect(entries.slice(-2).every((entry) => entry.diagnosticOnly)).toBe(true);
    expect(events.filter((event) => event.kind === "worker.plan_rejected").map((event) => event.reason)).toEqual([
      "stale_session",
      "unsupported",
    ]);
    expect((await stream.readWorkerPlan("run-1", "worker-1")).plan?.items[0]?.content).toBe("Inspect source");
  });

  it("does not persist a plan callback before a session binding exists", async () => {
    const { stream, entries, events } = makeStream();
    const result = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: corePlan,
    });

    expect(result).toMatchObject({ kind: "rejected", reason: "unbound" });
    expect(entries[0]).toMatchObject({ diagnosticOnly: true, planProjection: "rejected" });
    expect(events.at(-1)).toMatchObject({ kind: "worker.plan_rejected", reason: "unbound" });
  });
});
