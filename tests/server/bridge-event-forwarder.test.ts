import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentRuntimeServer } from "@/server/agent-runtime/http";
import { createBridgeNamedEventForwarder } from "@/server/events/bridge-event-forwarder";
import {
  __getRingForTests,
  __resetNamedEventsForTests,
  emitNamedEvent,
  getEventStreamCursor,
  type NamedEvent,
} from "@/server/events/named-events";

const servers: Server[] = [];

function listen(server: Server) {
  servers.push(server);
  return new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

afterEach(async () => {
  for (const server of servers.splice(0)) await closeServer(server);
});

/** A stand-in for the bridge's `/runtime-events` drain with a scripted queue. */
function scriptedBridge(responses: Array<Record<string, unknown>>) {
  const requests: Array<{ since: string | null; waitMs: string | null }> = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requests.push({
      since: url.searchParams.get("since"),
      waitMs: url.searchParams.get("waitMs"),
    });
    const body = responses.shift() ?? { cursor: "epoch-1:0", resyncRequired: false, events: [] };
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
  return { server, requests };
}

function entry(event: NamedEvent, runId: string | null = null) {
  return { id: 1, streamId: "epoch-1:1", emittedAt: Date.now(), runId, event };
}

describe("bridge named-event forwarder", () => {
  it("ingests bridge events into the runner ring and follows the cursor", async () => {
    const { server, requests } = scriptedBridge([
      {
        cursor: "epoch-1:2",
        resyncRequired: false,
        events: [
          entry({ kind: "goal.set.completed", runId: "run-1", goalId: "g-1", revision: 1, leaseGeneration: 0, snapshot: {} } as unknown as NamedEvent, "run-1"),
          entry({ kind: "error.surfaced", code: "goal.payload.invalid", message: "bad", surface: "log", runId: "run-1" } as NamedEvent, "run-1"),
        ],
      },
      { cursor: "epoch-1:2", resyncRequired: false, events: [] },
    ]);
    const bridgeUrl = await listen(server);
    const ingested: Array<{ kind: string; runId: string | null }> = [];
    const forwarder = createBridgeNamedEventForwarder({
      bridgeUrl,
      waitMs: 0,
      ingest: (event, runId) => ingested.push({ kind: event.kind, runId: runId ?? null }),
    });

    expect(await forwarder.drainOnce()).toEqual({ ingested: 2, resynced: false });
    expect(ingested).toEqual([
      { kind: "goal.set.completed", runId: "run-1" },
      { kind: "error.surfaced", runId: "run-1" },
    ]);

    await forwarder.drainOnce();
    expect(requests[0]?.since).toBeNull();
    expect(requests[1]?.since).toBe("epoch-1:2");
  });

  it("drops the frame kinds the runner already emits for itself", async () => {
    const { server } = scriptedBridge([
      {
        cursor: "epoch-1:3",
        resyncRequired: false,
        events: [
          entry({ kind: "worker.entry_appended", runId: "run-1", workerId: "w-1", seq: 9 } as NamedEvent, "run-1"),
          entry({ kind: "worker.plan_updated", runId: "run-1", workerId: "w-1", seq: 9 } as unknown as NamedEvent, "run-1"),
        ],
      },
    ]);
    const bridgeUrl = await listen(server);
    const ingested: string[] = [];
    const forwarder = createBridgeNamedEventForwarder({
      bridgeUrl,
      waitMs: 0,
      ingest: (event) => ingested.push(event.kind),
    });

    expect(await forwarder.drainOnce()).toEqual({ ingested: 1, resynced: false });
    expect(ingested).toEqual(["worker.plan_updated"]);
  });

  it("resumes from head instead of replaying when the bridge reports a resync", async () => {
    const { server, requests } = scriptedBridge([
      { cursor: "epoch-2:41", resyncRequired: true, resyncReason: "epoch_mismatch", events: [] },
      { cursor: "epoch-2:41", resyncRequired: false, events: [] },
    ]);
    const bridgeUrl = await listen(server);
    const diagnostics: string[] = [];
    const forwarder = createBridgeNamedEventForwarder({
      bridgeUrl,
      waitMs: 0,
      ingest: () => { throw new Error("nothing should be ingested on a resync"); },
      onDiagnostic: (message) => diagnostics.push(message),
    });

    expect(await forwarder.drainOnce()).toEqual({ ingested: 0, resynced: true });
    await forwarder.drainOnce();
    expect(requests[1]?.since).toBe("epoch-2:41");
    expect(diagnostics[0]).toContain("epoch_mismatch");
  });

  it("reports a failing drain instead of failing silently", async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 503;
      res.end("{}");
    });
    const bridgeUrl = await listen(server);
    const forwarder = createBridgeNamedEventForwarder({ bridgeUrl, waitMs: 0 });

    await expect(forwarder.drainOnce()).rejects.toThrow(/HTTP 503/);
  });
});

describe("agent runtime /runtime-events drain", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("starts a first-time reader at head and then serves everything after its cursor", async () => {
    const bridgeUrl = await listen(createAgentRuntimeServer());

    emitNamedEvent({ kind: "runner.started", origin: "http://old", bridgeUrl: "http://old" } as NamedEvent);
    const attach = await (await fetch(`${bridgeUrl}/runtime-events`)).json() as {
      cursor: string;
      events: unknown[];
    };
    expect(attach.events).toEqual([]);
    expect(attach.cursor).toBe(getEventStreamCursor());

    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.payload.invalid",
      message: "from the bridge",
      surface: "log",
      runId: "run-1",
    } as NamedEvent);
    const drained = await (await fetch(
      `${bridgeUrl}/runtime-events?since=${encodeURIComponent(attach.cursor)}`,
    )).json() as { events: Array<{ runId: string | null; event: { kind: string } }> };

    expect(drained.events.map((item) => item.event.kind)).toEqual(["error.surfaced"]);
    expect(drained.events[0]?.runId).toBe("run-1");
  });

  it("carries an event emitted on the bridge into the runner ring", async () => {
    const bridgeUrl = await listen(createAgentRuntimeServer());
    const forwarder = createBridgeNamedEventForwarder({ bridgeUrl, waitMs: 0 });
    // Attach at head the way the runner does before any bridge event exists.
    await forwarder.drainOnce();

    emitNamedEvent({
      kind: "goal.plan.derivation_skipped",
      runId: "run-1",
      goalId: "g-1",
      reason: "no_plan_reference",
    } as NamedEvent);
    const before = __getRingForTests().length;
    await forwarder.drainOnce();

    // The bridge ring and the runner ring are the same module in one process,
    // so the ingested copy shows up as one extra entry carrying the same kind.
    const ring = __getRingForTests();
    expect(ring.length).toBe(before + 1);
    expect(ring.at(-1)?.event.kind).toBe("goal.plan.derivation_skipped");
    expect(ring.at(-1)?.runId).toBe("run-1");
  });
});
