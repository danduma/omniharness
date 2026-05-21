/**
 * Lifecycle: artifact-backed snapshot assembly.
 *
 * Writes execution events through the adapter (artifact stream + SQLite
 * row), then assembles a persisted snapshot via the same path the API
 * route uses. Asserts the snapshot:
 *
 *   - returns at most EXECUTION_EVENT_LIMIT events (cap is observed)
 *   - orders them newest-first
 *   - re-hydrates `details` from the artifact (legacy column is dual-written
 *     but the test bypasses the legacy column to confirm the artifact path)
 *   - reports snapshotScope.executionEvents.complete=false when capped
 */
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  artifactStreams,
  executionEvents,
  planItems,
  plans,
  runs,
} from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { buildPersistedEventPayload } from "@/server/events/persisted-snapshot";

async function seed(): Promise<string> {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: `docs/test/${planId}.md`,
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    status: "running",
    title: "snapshot scenario",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return runId;
}

describe("lifecycle — artifact-backed snapshot", () => {
  beforeEach(async () => {
    await db.delete(executionEvents);
    await db.delete(artifactStreams);
    await db.delete(planItems);
    await db.delete(runs);
    await db.delete(plans);
  });
  afterEach(async () => {
    await db.delete(executionEvents);
    await db.delete(artifactStreams);
    await db.delete(planItems);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("hydrates execution-event details from artifact stream when legacy column is null", async () => {
    const runId = await seed();
    await recordExecutionEvent({
      runId,
      eventType: "supervisor.observation",
      // `summary` survives the snapshot compactor's allowlist.
      details: { summary: "from-artifact" },
    });
    // Simulate post-cleanup state: the legacy `details` column is null
    // (after `--cleanup` is run), so hydration MUST come from the
    // artifact stream.
    await db.update(executionEvents).set({ details: null }).where(eq(executionEvents.runId, runId));

    const payload = await buildPersistedEventPayload({ selectedRunId: runId });
    expect(payload.executionEvents).toHaveLength(1);
    const event = payload.executionEvents[0]!;
    const parsedDetails = JSON.parse(event.details ?? "{}");
    expect(parsedDetails).toMatchObject({ summary: "from-artifact" });
  });

  it("respects the snapshot limit and reports complete=false when capped", async () => {
    const runId = await seed();
    // EXECUTION_EVENT_LIMIT = 100 — write 120 so we exceed it.
    for (let i = 0; i < 120; i += 1) {
      await recordExecutionEvent({
        runId,
        eventType: "supervisor.observation",
        details: { seconds: i, summary: `event-${i}` },
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
    }
    const payload = await buildPersistedEventPayload({ selectedRunId: runId });
    expect(payload.executionEvents.length).toBe(100);
    const scope = payload.snapshotScope?.executionEvents;
    expect(scope).toBeDefined();
    expect(scope!.complete).toBe(false);
    expect(scope!.limit).toBe(100);
    expect(scope!.oldestCreatedAt).not.toBeNull();
    // Newest-first.
    const seconds = payload.executionEvents.map((e) => JSON.parse(e.details ?? "{}").seconds);
    expect(seconds[0]).toBe(119);
    expect(seconds[seconds.length - 1]).toBe(20);
  });
});
