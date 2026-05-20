import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { messages, plans, processSessions, runs, workerCounters, workers } from "@/server/db/schema";
import * as eventsRoute from "@/app/api/events/route";
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
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(17, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await cleanDb();
});

describe("lifecycle harness — process session restart reconciliation", () => {
  it("marks persisted running process sessions without a live handle as orphaned on bootstrap", async () => {
    const now = new Date();
    const planId = "plan-process-restart";
    const runId = "run-process-restart";
    const workerId = "run-process-restart-worker-1";
    await db.insert(plans).values({
      id: planId,
      path: "/tmp/process-restart.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      sessionType: "process",
      mode: "direct",
      projectPath: process.cwd(),
      title: "Long process",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "process",
      status: "working",
      cwd: process.cwd(),
      workerNumber: 1,
      title: "Long process",
      initialPrompt: "node long.js",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(processSessions).values({
      runId,
      workerId,
      cwd: process.cwd(),
      commandJson: JSON.stringify([process.execPath, "-e", "setTimeout(() => {}, 5000)"]),
      commandPreview: "node long.js",
      envPolicy: "minimal",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await client.subscribe({ runId });
    const snapshotRes = await client.fetch(`/api/events?snapshot=1&persisted=1&runId=${runId}`);
    expect(snapshotRes.status).toBe(200);

    const status = await client.waitFor("session.status", {
      predicate: (frame) => (frame.payload as { runId?: string; next?: string } | null)?.runId === runId
        && (frame.payload as { next?: string } | null)?.next === "orphaned",
      timeoutMs: 10_000,
    });
    expect(status.payload).toMatchObject({
      kind: "session.status",
      sessionType: "process",
      reason: "server_restart",
    });

    const row = await db.select().from(processSessions).get();
    expect(row?.status).toBe("orphaned");
  });
});
