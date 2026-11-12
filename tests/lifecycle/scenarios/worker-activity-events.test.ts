/**
 * `worker.activity` is the server-derived signal behind the office view and
 * status strip. It must reach SSE clients as a named event with an `id:`,
 * and a client that drops mid-turn must receive the transitions it missed
 * through Last-Event-ID replay instead of re-deriving them from transcripts.
 */
import { promises as fs } from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAppDataPath } from "@/server/app-root";
import { db } from "@/server/db";
import { executionEvents } from "@/server/db/schema";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { __resetOutputStoreCachesForTests, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { __resetWorkerActivityForTests } from "@/server/workers/activity-tracker";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

type BridgeEntry = NonNullable<Parameters<typeof writeWorkerOutputEntries>[2]>[number];

let server: LifecycleServer;
let client: LifecycleClient;
const runIds: string[] = [];

function toolCall(id: string, toolKind: string, text: string): BridgeEntry {
  return { id, type: "tool_call", text, toolKind, status: "in_progress", timestamp: new Date().toISOString() } as BridgeEntry;
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  __resetWorkerActivityForTests();
  __resetOutputStoreCachesForTests();
  await db.delete(executionEvents);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(1, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  for (const runId of runIds.splice(0)) {
    await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
  }
});

describe("worker.activity lifecycle", () => {
  it("streams activity transitions and replays the ones missed while disconnected", async () => {
    const { runId } = await seedDirectRun();
    runIds.push(runId);
    const workerId = "activity-worker";

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    await writeWorkerOutputEntries(runId, workerId, [toolCall("t1", "read", "Read src/a.ts")]);
    const researching = await client.waitFor("worker.activity", { timeoutMs: 10_000 });
    expect(researching.id).toBeTruthy();
    expect(researching.payload).toMatchObject({
      kind: "worker.activity",
      runId,
      workerId,
      activity: "researching",
      prev: null,
      source: "tool_kind",
    });

    client.dropSse();
    await writeWorkerOutputEntries(runId, workerId, [toolCall("t2", "edit", "Edit src/a.ts")]);
    await writeWorkerOutputEntries(runId, workerId, [toolCall("t3", "execute", "pnpm test:lifecycle")]);
    await client.subscribe({ runId });

    const testing = await client.waitFor("worker.activity", {
      predicate: (frame) => (frame.payload as { activity?: string }).activity === "testing",
      timeoutMs: 10_000,
    });
    expect(testing.payload).toMatchObject({ prev: "writing", source: "command_pattern" });
    const activities = client.events.filterByEvent("worker.activity")
      .map((frame) => (frame.payload as { activity: string }).activity);
    expect(activities).toEqual(["researching", "writing", "testing"]);
  });
});
