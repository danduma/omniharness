import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { db } from "@/server/db";
import { plans, runs } from "@/server/db/schema";
import { DELETE } from "@/app/api/runs/[id]/route";
import {
  __getRingForTests,
  __resetNamedEventsForTests,
} from "@/server/events/named-events";

vi.mock("@/server/auth/guards", () => ({
  requireApiSession: vi.fn().mockResolvedValue({ response: null, account: { id: "test" } }),
}));
vi.mock("@/server/bridge-client", () => ({
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/supervisor/observer", () => ({
  stopRunObserver: vi.fn(),
}));
vi.mock("@/server/supervisor/wake", () => ({
  cancelSupervisorWake: vi.fn(),
}));

const RUN_ID = "run-delete-events";

async function seed() {
  const now = new Date();
  await db.insert(plans).values({
    id: "plan-delete-events",
    path: "/tmp/x.md",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: RUN_ID,
    planId: "plan-delete-events",
    mode: "direct",
    title: "Delete",
    status: "ready",
    createdAt: now,
    updatedAt: now,
  });
}

function deleteReq(id: string) {
  return new NextRequest(new URL(`/api/runs/${id}`, "http://localhost").toString(), {
    method: "DELETE",
  });
}

describe("conversation delete named events", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    await db.delete(runs);
    await db.delete(plans);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("emits conversation.deleted on successful delete", async () => {
    await seed();
    const res = await DELETE(deleteReq(RUN_ID), { params: Promise.resolve({ id: RUN_ID }) });
    expect(res.status).toBe(200);

    const deleted = __getRingForTests().filter((entry) => entry.event.kind === "conversation.deleted");
    expect(deleted).toHaveLength(1);
    expect(deleted[0]!.event).toMatchObject({ kind: "conversation.deleted", runId: RUN_ID });
  });

  it("emits conversation.delete_failed + error.surfaced when underlying db throws", async () => {
    await seed();
    // Force a failure mid-flight by passing a non-existent runId after seed:
    // route's first lookup returns null and replies 404 with no named event.
    // Instead, simulate a true error by injecting a thrown delete via a
    // schema FK we can trigger: insert an executionEvent referencing the
    // run, then have the route hit it. But our route deletes execution
    // events first, so we have to make something else fail.
    //
    // Simpler: monkey-patch db.delete to throw on the first call.
    const originalDelete = db.delete.bind(db);
    const spy = vi.spyOn(db, "delete").mockImplementationOnce(() => {
      throw Object.assign(new Error("FOREIGN KEY constraint failed"), { name: "SqliteError" });
    });

    try {
      const res = await DELETE(deleteReq(RUN_ID), { params: Promise.resolve({ id: RUN_ID }) });
      expect(res.status).toBe(409);
    } finally {
      spy.mockRestore();
      void originalDelete;
    }

    const failed = __getRingForTests().filter((entry) => entry.event.kind === "conversation.delete_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.event).toMatchObject({
      kind: "conversation.delete_failed",
      runId: RUN_ID,
    });

    const surfaced = __getRingForTests().filter((entry) => entry.event.kind === "error.surfaced");
    expect(surfaced).toHaveLength(1);
    expect(surfaced[0]!.event).toMatchObject({
      kind: "error.surfaced",
      code: "conversation.delete.foreign_key",
      runId: RUN_ID,
    });
  });
});
