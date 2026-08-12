import { describe, expect, it } from "vitest";
import { AcpPlanStream } from "@/server/agent-runtime/acp/plan-stream";
import type { NamedEvent } from "@/server/events/named-events";
import type { WorkerEntry } from "@/shared/worker-entries";
import {
  MAX_ACP_PLAN_BYTES,
  measureAcpPlanJsonBytes,
} from "@/shared/acp-plan";

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

  it("buffers startup callbacks by generation and drains only the authoritative session", async () => {
    const { stream, entries, events } = makeStream();
    const startup = stream.beginWorkerPlanStartup("run-1", "worker-1", "session-1");

    expect(stream.bufferWorkerPlanStartupUpdate(startup, {
      sessionId: "session-1",
      update: corePlan,
    })).toBe("buffered");
    expect(stream.bufferWorkerPlanStartupUpdate(startup, {
      sessionId: "wrong-session",
      update: corePlan,
    })).toBe("buffered");

    await stream.completeWorkerPlanStartup(startup, "session-1");

    expect(entries.map((entry) => entry.planProjection)).toEqual([
      "session_reset",
      "accepted_core",
      "rejected",
    ]);
    expect(events.filter((event) => event.kind === "worker.plan_rejected")).toContainEqual(
      expect.objectContaining({ reason: "startup_session_mismatch", sessionId: "wrong-session" }),
    );
  });

  it("discards buffered callbacks when startup is aborted", async () => {
    const { stream, entries } = makeStream();
    const startup = stream.beginWorkerPlanStartup("run-1", "worker-1", null);
    stream.bufferWorkerPlanStartupUpdate(startup, { sessionId: "session-1", update: corePlan });

    stream.abortWorkerPlanStartup(startup);

    expect(entries).toEqual([]);
  });

  it("surfaces event publication failure after the durable append without appending twice", async () => {
    const entries: WorkerEntry[] = [];
    const events: NamedEvent[] = [];
    let seq = 0;
    let throwNextPlanEvent = true;
    const stream = new AcpPlanStream({
      append: async (_runId, _workerId, entry) => {
        const persisted = { ...entry, seq: ++seq } as WorkerEntry;
        entries.push(persisted);
        return { entry: persisted, appended: true };
      },
      read: async () => ({ entries: [...entries], latestSeq: seq }),
      emit: (event) => {
        if (throwNextPlanEvent && event.kind === "worker.plan_updated") {
          throwNextPlanEvent = false;
          throw new Error("ring unavailable");
        }
        events.push(event);
      },
    });
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");

    await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: corePlan,
    });

    expect(entries).toHaveLength(2);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      code: "worker.plan.event_publish_failed",
      runId: "run-1",
      workerId: "worker-1",
    }));
  });

  it("does not publish duplicate wake-ups when the stream writer deduplicates an accepted update", async () => {
    const entriesById = new Map<string, WorkerEntry>();
    const events: NamedEvent[] = [];
    let seq = 0;
    let idCall = 0;
    const stream = new AcpPlanStream({
      append: async (_runId, _workerId, entry) => {
        const existing = entriesById.get(entry.id);
        if (existing) return { entry: existing, appended: false };
        const persisted = { ...entry, seq: ++seq } as WorkerEntry;
        entriesById.set(persisted.id, persisted);
        return { entry: persisted, appended: true };
      },
      read: async () => ({ entries: [...entriesById.values()], latestSeq: seq }),
      emit: (event) => events.push(event),
      createId: () => idCall++ === 0 ? "boundary" : "accepted-replay",
    });
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");
    await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: corePlan,
    });
    const eventCount = events.length;

    await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: corePlan,
    });

    expect(entriesById).toHaveLength(2);
    expect(events).toHaveLength(eventCount);
  });

  it("persists a complete-plan recurrence as A to B to A instead of content-deduplicating the final A", async () => {
    const entriesById = new Map<string, WorkerEntry>();
    let seq = 0;
    const stream = new AcpPlanStream({
      append: async (_runId, _workerId, entry) => {
        const existing = entriesById.get(entry.id);
        if (existing) return { entry: existing, appended: false };
        const persisted = { ...entry, seq: ++seq } as WorkerEntry;
        entriesById.set(persisted.id, persisted);
        return { entry: persisted, appended: true };
      },
      read: async () => ({ entries: [...entriesById.values()], latestSeq: seq }),
      emit: () => undefined,
    });
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");
    const planA = corePlan;
    const planB = {
      ...corePlan,
      entries: [{ ...corePlan.entries[0], content: "Implement widget" }],
    };

    await stream.handleAcpSessionUpdate({ runId: "run-1", workerId: "worker-1", sessionId: "session-1", update: planA });
    await stream.handleAcpSessionUpdate({ runId: "run-1", workerId: "worker-1", sessionId: "session-1", update: planB });
    await stream.handleAcpSessionUpdate({ runId: "run-1", workerId: "worker-1", sessionId: "session-1", update: planA });

    expect([...entriesById.values()].filter((entry) => entry.planProjection === "accepted_core")).toHaveLength(3);
    expect((await stream.readWorkerPlan("run-1", "worker-1")).plan).toMatchObject({
      lastEntrySeq: 4,
      items: [{ content: "Inspect source" }],
    });
  });

  it("creates a fresh boundary when an older session id becomes authoritative again", async () => {
    const entriesById = new Map<string, WorkerEntry>();
    let seq = 0;
    const stream = new AcpPlanStream({
      append: async (_runId, _workerId, entry) => {
        const existing = entriesById.get(entry.id);
        if (existing) return { entry: existing, appended: false };
        const persisted = { ...entry, seq: ++seq } as WorkerEntry;
        entriesById.set(persisted.id, persisted);
        return { entry: persisted, appended: true };
      },
      read: async () => ({ entries: [...entriesById.values()], latestSeq: seq }),
      emit: () => undefined,
    });
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");

    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-a");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-b");
    const rebound = await stream.beginWorkerPlanSession("run-1", "worker-1", "session-a");

    expect([...entriesById.values()].filter((entry) => entry.planProjection === "session_reset")).toHaveLength(3);
    expect(rebound).toMatchObject({ sessionId: "session-a", boundarySeq: 3 });
    expect((await stream.readWorkerPlan("run-1", "worker-1")).plan).toMatchObject({
      acpSessionId: "session-a",
      planBoundarySeq: 3,
      visible: false,
    });
  });

  it("bounds startup overflow and missing-session callbacks as diagnostics", async () => {
    const { stream, entries, events } = makeStream();
    const startup = stream.beginWorkerPlanStartup("run-1", "worker-1", null);
    stream.bufferWorkerPlanStartupUpdate(startup, { sessionId: null, update: corePlan });
    for (let index = 0; index < 16; index += 1) {
      stream.bufferWorkerPlanStartupUpdate(startup, {
        sessionId: "session-1",
        update: { ...corePlan, entries: [{ ...corePlan.entries[0], content: `step ${index}` }] },
      });
    }

    await stream.completeWorkerPlanStartup(startup, "session-1");

    expect(entries.some((entry) => entry.raw && (entry.raw as { classification?: string }).classification === "missing_session")).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "worker.plan_rejected",
      reason: "startup_buffer_overflow",
    }));
  });

  it("bounds an oversized startup callback session id before buffering it", async () => {
    const { stream, entries } = makeStream();
    const startup = stream.beginWorkerPlanStartup("run-1", "worker-1", null);

    expect(stream.bufferWorkerPlanStartupUpdate(startup, {
      sessionId: "s".repeat(MAX_ACP_PLAN_BYTES),
      update: corePlan,
    })).toBe("buffered");
    await stream.completeWorkerPlanStartup(startup, "session-1");

    expect(entries.map((entry) => entry.planProjection)).toEqual(["session_reset", "rejected"]);
    expect(entries[1]).toMatchObject({
      acpSessionId: null,
      raw: { classification: "oversized", measuredBytes: MAX_ACP_PLAN_BYTES },
    });
    expect(measureAcpPlanJsonBytes(entries[1])).toBeLessThanOrEqual(MAX_ACP_PLAN_BYTES);
  });

  it("surfaces boundary, accepted, diagnostic, and hydration failures without false plan events", async () => {
    const cases = [
      {
        expectedCode: "worker.plan.boundary_append_failed",
        run: async (stream: AcpPlanStream) => {
          await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
          await expect(stream.beginWorkerPlanSession("run-1", "worker-1", "session-1")).rejects.toThrow("append failed");
        },
        failProjection: "session_reset",
      },
      {
        expectedCode: "worker.plan.append_failed",
        run: async (stream: AcpPlanStream) => {
          await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
          await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");
          await stream.handleAcpSessionUpdate({
            runId: "run-1",
            workerId: "worker-1",
            sessionId: "session-1",
            update: corePlan,
          });
        },
        failProjection: "accepted_core",
      },
      {
        expectedCode: "worker.plan.diagnostic_append_failed",
        run: async (stream: AcpPlanStream) => {
          await stream.handleAcpSessionUpdate({
            runId: "run-1",
            workerId: "worker-1",
            sessionId: null,
            update: corePlan,
          });
        },
        failProjection: "rejected",
      },
    ] as const;

    for (const failureCase of cases) {
      const events: NamedEvent[] = [];
      let seq = 0;
      const entries: WorkerEntry[] = [];
      const stream = new AcpPlanStream({
        append: async (_runId, _workerId, entry) => {
          if (entry.planProjection === failureCase.failProjection) throw new Error("append failed");
          const persisted = { ...entry, seq: ++seq } as WorkerEntry;
          entries.push(persisted);
          return { entry: persisted, appended: true };
        },
        read: async () => ({ entries, latestSeq: seq }),
        emit: (event) => events.push(event),
      });

      await failureCase.run(stream);

      expect(events).toContainEqual(expect.objectContaining({
        kind: "error.surfaced",
        code: failureCase.expectedCode,
        runId: "run-1",
        workerId: "worker-1",
      }));
      expect(events.some((event) => event.kind === "worker.plan_updated")).toBe(false);
    }

    const hydrationEvents: NamedEvent[] = [];
    const hydrationStream = new AcpPlanStream({
      readPlan: async () => { throw new Error("read failed"); },
      emit: (event) => hydrationEvents.push(event),
    });
    await expect(hydrationStream.hydrateWorkerPlanBinding("run-1", "worker-1")).rejects.toThrow("read failed");
    expect(hydrationEvents).toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      code: "worker.plan.binding_hydration_failed",
      runId: "run-1",
      workerId: "worker-1",
    }));
  });

  it("invalidates an old binding when a later hydration fails", async () => {
    const entries: WorkerEntry[] = [];
    const events: NamedEvent[] = [];
    let seq = 0;
    let failHydration = false;
    const stream = new AcpPlanStream({
      append: async (_runId, _workerId, entry) => {
        const persisted = { ...entry, seq: ++seq } as WorkerEntry;
        entries.push(persisted);
        return { entry: persisted, appended: true };
      },
      readPlan: async () => {
        if (failHydration) throw new Error("read failed");
        return { entries, latestSeq: seq };
      },
      emit: (event) => events.push(event),
    });
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");
    failHydration = true;
    await expect(stream.hydrateWorkerPlanBinding("run-1", "worker-1")).rejects.toThrow("read failed");

    const result = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update: corePlan,
    });

    expect(result).toMatchObject({ kind: "rejected", reason: "hydrating" });
    expect(entries.some((entry) => entry.planProjection === "accepted_core")).toBe(false);
  });

  it("rejects an ingress-valid plan when the complete durable representation exceeds 64 KiB", async () => {
    const { stream, entries } = makeStream();
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");
    await stream.beginWorkerPlanSession("run-1", "worker-1", "session-1");

    const emptyPaddingUpdate = { ...corePlan, padding: "" };
    const update = {
      ...emptyPaddingUpdate,
      padding: "x".repeat(MAX_ACP_PLAN_BYTES - measureAcpPlanJsonBytes(emptyPaddingUpdate)),
    };
    expect(measureAcpPlanJsonBytes(update)).toBe(MAX_ACP_PLAN_BYTES);

    const result = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "session-1",
      update,
    });

    expect(result).toMatchObject({ kind: "rejected", reason: "oversized" });
    expect(entries.some((entry) => entry.planProjection === "accepted_core")).toBe(false);
    expect(entries.at(-1)).toMatchObject({
      planProjection: "rejected",
      diagnosticOnly: true,
      raw: { classification: "oversized", measuredBytes: MAX_ACP_PLAN_BYTES },
    });
  });

  it("refuses an oversized session boundary without persisting it", async () => {
    const { stream, entries, events } = makeStream();
    await stream.hydrateWorkerPlanBinding("run-1", "worker-1");

    await expect(
      stream.beginWorkerPlanSession("run-1", "worker-1", "s".repeat(MAX_ACP_PLAN_BYTES)),
    ).rejects.toThrow(/session id/i);

    expect(entries).toEqual([]);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      code: "worker.plan.boundary_append_failed",
    }));
  });

  it("stores an oversized callback session id only as a bounded diagnostic", async () => {
    const { stream, entries } = makeStream();

    const result = await stream.handleAcpSessionUpdate({
      runId: "run-1",
      workerId: "worker-1",
      sessionId: "s".repeat(MAX_ACP_PLAN_BYTES),
      update: corePlan,
    });

    expect(result).toMatchObject({ kind: "rejected", reason: "oversized" });
    expect(entries[0]).toMatchObject({
      acpSessionId: null,
      planProjection: "rejected",
      diagnosticOnly: true,
      raw: { classification: "oversized" },
    });
    expect(measureAcpPlanJsonBytes(entries[0])).toBeLessThanOrEqual(MAX_ACP_PLAN_BYTES);
  });
});
