import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { getNamedEventsSince } from "@/server/events/named-events";
import { appendWorkerEntry, __resetOutputStoreCachesForTests } from "@/server/workers/output-store";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { workerEntriesRoute } from "../../helpers/runtime-routes";
import { startLifecycleHarness } from "../harness/server";

it("keeps separate saved messages over HTTP after the live snapshot is lost", async () => {
  const server = await startLifecycleHarness({
    routes: [{ pattern: "/api/workers/:workerId/entries", module: { GET: workerEntriesRoute } }],
  });
  const runId = randomUUID();
  const planId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const now = new Date();
  try {
    await db.insert(plans).values({ id: planId, path: "test-plan.md", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({ id: runId, planId, mode: "direct", status: "running", createdAt: now, updatedAt: now });
    await db.insert(workers).values({ id: workerId, runId, type: "claude", status: "working", cwd: server.omniRoot, createdAt: now, updatedAt: now });
    const messages = ["Four inventories are running.", "Waiting on the last inventory.", "Writing the plan now."];
    await appendWorkerEntry(runId, workerId, { id: randomUUID(), type: "user_input", text: "Write the plan", timestamp: now.toISOString() });
    for (const text of messages) {
      await appendWorkerEntry(runId, workerId, { id: randomUUID(), type: "message", text, timestamp: now.toISOString() });
      await appendWorkerEntry(runId, workerId, { id: randomUUID(), type: "tool_call", text: "Research", timestamp: now.toISOString() });
    }
    const url = `${server.baseUrl}/api/workers/${workerId}/entries?afterSeq=0`;
    const before = await fetch(url);
    expect(before.status).toBe(200);
    const saved = await before.json();

    // Recreate the recovery boundary: durable entries survive, live output does not.
    __resetOutputStoreCachesForTests();
    await appendAskResponseFallbackEntry({ runId, workerId, snapshot: null, responseText: messages.join("") });

    const after = await fetch(url);
    expect(after.status).toBe(200);
    expect(await after.json()).toEqual(saved);
    expect(getNamedEventsSince(null, { runId }).events).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: { kind: "worker.response_fallback_skipped", runId, workerId, reason: "persisted_message" } }),
    ]));
  } finally {
    await db.delete(workers).where(eq(workers.id, workerId));
    await db.delete(runs).where(eq(runs.id, runId));
    await db.delete(plans).where(eq(plans.id, planId));
    __resetOutputStoreCachesForTests();
    await server.stop();
  }
});
