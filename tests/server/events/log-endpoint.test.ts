import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/events/log/route";
import {
  __resetNamedEventsForTests,
  emitNamedEvent,
} from "@/server/events/named-events";

function makeReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost").toString());
}

describe("/api/events/log", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  it("returns 404 in production builds", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const res = await GET(makeReq("/api/events/log"));
    expect(res.status).toBe(404);
  });

  it("returns the buffered events when called without `since`", async () => {
    emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "starting", next: "running" });

    const res = await GET(makeReq("/api/events/log"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resyncRequired).toBe(false);
    expect(body.events.map((entry: { event: { kind: string } }) => entry.event.kind)).toEqual([
      "worker.spawned",
      "worker.status",
    ]);
    expect(body.lastEventId).toBe(2);
  });

  it("returns only events after `since`", async () => {
    emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "starting", next: "running" });

    const res = await GET(makeReq("/api/events/log?since=1"));
    const body = await res.json();
    expect(body.events.map((entry: { event: { kind: string } }) => entry.event.kind)).toEqual(["worker.status"]);
  });

  it("filters by runId", async () => {
    emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    emitNamedEvent({ kind: "worker.spawned", runId: "r2", workerId: "w2", workerType: "agent" });

    const res = await GET(makeReq("/api/events/log?runId=r1"));
    const body = await res.json();
    expect(body.events.map((entry: { runId: string }) => entry.runId)).toEqual(["r1"]);
  });

  it("rejects non-numeric `since`", async () => {
    const res = await GET(makeReq("/api/events/log?since=abc"));
    expect(res.status).toBe(400);
  });
});
