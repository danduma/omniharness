/**
 * Force the DELETE handler to throw a FOREIGN KEY constraint error and
 * assert (1) the response is 409 with a typed body — not a raw 500,
 * (2) `conversation.delete_failed` + `error.surfaced` are emitted onto
 * the SSE stream.
 *
 * Models the second bug from the original incident: delete conversation
 * was producing an opaque 500 with no user-visible explanation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { executionEvents } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";
import * as runRoute from "@/app/api/runs/[id]/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

// The DELETE handler fires `cancelSupervisorWake` early, which itself
// kicks off a db.delete via `cancelDurableSupervisorWake`. We want our
// fault injection to land on the *main* delete chain (messages,
// clarifications, ...), so stub the supervisor-side delete to a no-op.
vi.mock("@/server/supervisor/wake", () => ({
  cancelSupervisorWake: vi.fn(),
}));
vi.mock("@/server/supervisor/observer", async () => {
  const actual = await vi.importActual<typeof import("@/server/supervisor/observer")>(
    "@/server/supervisor/observer",
  );
  return { ...actual, stopRunObserver: vi.fn() };
});
vi.mock("@/server/bridge-client", async () => {
  const actual = await vi.importActual<typeof import("@/server/bridge-client")>(
    "@/server/bridge-client",
  );
  return { ...actual, cancelAgent: vi.fn(), cancelAgentTerminalProcess: vi.fn() };
});

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/runs/:id", module: runRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(5, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle harness — delete conversation FK failure", () => {
  it("returns 409 + emits conversation.delete_failed + error.surfaced", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const spy = vi.spyOn(db, "delete").mockImplementationOnce(() => {
      throw Object.assign(new Error("FOREIGN KEY constraint failed"), {
        name: "SqliteError",
      });
    });
    try {
      const res = await client.fetch(`/api/runs/${runId}`, { method: "DELETE" });
      expect(res.status).toBe(409);
    } finally {
      spy.mockRestore();
    }

    const failed = await client.waitFor("conversation.delete_failed", { timeoutMs: 10_000 });
    expect(failed.payload).toMatchObject({
      kind: "conversation.delete_failed",
      runId,
    });

    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => (frame.payload as { code?: string } | null)?.code === "conversation.delete.foreign_key",
      timeoutMs: 10_000,
    });
    expect(surfaced.payload).toMatchObject({
      code: "conversation.delete.foreign_key",
      runId,
      surface: "toast",
    });
  });
});
