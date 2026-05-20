import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { messages, plans, processSessions, runs, workerCounters, workers } from "@/server/db/schema";
import * as eventsRoute from "@/app/api/events/route";
import * as conversationsRoute from "@/app/api/conversations/route";
import * as runsRoute from "@/app/api/runs/[id]/route";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

let server: LifecycleServer;
let client: LifecycleClient;

async function cleanDb() {
  await db.delete(processSessions);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  await cleanDb();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/conversations", module: conversationsRoute },
      { pattern: "/api/runs/:id", module: runsRoute },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(13, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await cleanDb();
});

describe("lifecycle harness — session provider capabilities", () => {
  it("refuses Omni-only actions on process sessions with named events", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionType: "process",
        command: `${process.execPath} -e "setTimeout(() => {}, 5000)"`,
        projectPath: process.cwd(),
      }),
    });
    expect(createRes.status).toBe(200);
    const { runId } = await createRes.json() as { runId: string };

    await client.waitFor("session.status", {
      predicate: (frame) => (frame.payload as { runId?: string; next?: string } | null)?.runId === runId
        && (frame.payload as { next?: string } | null)?.next === "running",
      timeoutMs: 10_000,
    });

    const retryRes = await client.fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "retry", targetMessageId: "m1" }),
    });
    expect(retryRes.status).toBe(409);

    const refused = await client.waitFor("session.action.refused", {
      predicate: (frame) => (frame.payload as { runId?: string; action?: string } | null)?.runId === runId
        && (frame.payload as { action?: string } | null)?.action === "retry",
      timeoutMs: 10_000,
    });
    expect(refused.payload).toMatchObject({
      kind: "session.action.refused",
      sessionType: "process",
      code: "session.action.unsupported",
    });

    const stopRes = await client.fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stop_worker", workerId: `${runId}-worker-1` }),
    });
    expect(stopRes.status).toBe(200);
  });
});
