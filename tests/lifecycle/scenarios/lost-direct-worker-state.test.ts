/**
 * Regression for session 76d5d121fe24: after the runner restart, its only
 * remaining worker was persisted as `lost` with no ACP session metadata. The
 * next sync ignored `lost`, projected the run back to `running`, and resolved
 * the recovery incident as healthy even though no worker existed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  recoveryIncidents,
  runs,
  workers,
} from "@/server/db/schema";

import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/bridge-client", () => ({
  BRIDGE_URL: "http://localhost:0",
  getAgent: vi.fn().mockResolvedValue(null),
  spawnAgent: vi.fn().mockRejectedValue(new Error("unexpected spawn")),
  askAgent: vi.fn().mockRejectedValue(new Error("unexpected prompt")),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  respondElicitation: vi.fn().mockResolvedValue(undefined),
}));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(recoveryIncidents);
  await db.delete(messages);
  await db.delete(workers);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(0x76D5, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — persisted lost direct worker", () => {
  it("emits one recovery incident and never rewrites the run as healthy", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const now = new Date(0);
    const workerId = "w-lost-direct";
    await db.update(runs).set({ status: "running", updatedAt: now }).where(eq(runs.id, runId));
    await db.insert(messages).values({
      id: "m-original-request",
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Finish the original request",
      createdAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "lost",
      cwd: "/tmp",
      bridgeSessionId: null,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    const { syncConversationSessions } = await import("@/server/conversations/sync");
    await syncConversationSessions([], { selectedRunId: runId });
    await syncConversationSessions([], { selectedRunId: runId });

    const opened = await client.waitFor("recovery.opened", { timeoutMs: 10_000 });
    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => (frame.payload as { code?: string } | null)?.code === "recovery.needs_user",
      timeoutMs: 10_000,
    });
    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));

    expect(opened.payload).toMatchObject({ runId, recoveryKind: "worker_lost" });
    expect(surfaced.payload).toMatchObject({ runId, workerId });
    expect(storedRun?.status).toBe("needs_recovery");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({ workerId, status: "needs_user" });
  });
});
