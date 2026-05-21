/**
 * Integration tests for the execution-event adapter.
 *
 * Verifies the durability contract callers rely on:
 *
 *   - recordExecutionEvent writes both the artifact line and the SQLite row,
 *     and the artifact body can be hydrated back through listExecutionEventsForRun.
 *   - Snapshot reader applies the limit cap and orders newest-first.
 *   - Delete-by-runId removes SQLite rows (the on-disk file is cascaded
 *     separately by cleanupRunArtifacts; that's covered elsewhere).
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
import {
  recordExecutionEvent,
  listExecutionEventsForRun,
  listExecutionEventsForSnapshot,
  deleteExecutionEventsForRun,
} from "@/server/events/execution-event-store";

async function createDirectRun(): Promise<string> {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: "docs/superpowers/plans/example.md",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return runId;
}

describe("execution-event-store", () => {
  beforeEach(async () => {
    await db.delete(executionEvents);
    await db.delete(artifactStreams);
    await db.delete(runs);
    await db.delete(planItems);
    await db.delete(plans);
  });
  afterEach(async () => {
    await db.delete(executionEvents);
    await db.delete(artifactStreams);
    await db.delete(runs);
    await db.delete(planItems);
    await db.delete(plans);
  });

  it("persists the artifact body and hydrates it back through listExecutionEventsForRun", async () => {
    const runId = await createDirectRun();
    const { artifactSeq } = await recordExecutionEvent({
      runId,
      eventType: "supervisor.wake_scheduled",
      details: { reason: "test", delayMs: 1500 },
    });
    expect(artifactSeq).toBe(1);
    const rows = await listExecutionEventsForRun(runId);
    expect(rows).toHaveLength(1);
    expect(rows[0].artifactSeq).toBe(1);
    expect(rows[0].detailsHash).not.toBeNull();
    expect(rows[0].detailsPreview).not.toBeNull();
    // Hydrate path returns the JSON-serialised payload through `details`.
    const parsed = JSON.parse(rows[0].details ?? "{}");
    expect(parsed).toMatchObject({ reason: "test", delayMs: 1500 });
  });

  it("orders snapshot reads newest-first and caps to limit", async () => {
    const runId = await createDirectRun();
    for (let i = 0; i < 5; i += 1) {
      await recordExecutionEvent({
        runId,
        eventType: "supervisor.observation",
        details: { i },
        // Force a deterministic createdAt order; recordExecutionEvent
        // defaults to `new Date()`, which can collide at ms resolution.
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
    }
    const snapshot = await listExecutionEventsForSnapshot(runId, 3);
    expect(snapshot).toHaveLength(3);
    const indexes = snapshot.map((r) => JSON.parse(r.details ?? "{}").i);
    expect(indexes).toEqual([4, 3, 2]);
  });

  it("recordExecutionEvent assigns monotonically-increasing seqs per run", async () => {
    const runId = await createDirectRun();
    const seqs: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const { artifactSeq } = await recordExecutionEvent({
        runId,
        eventType: "supervisor.observation",
        details: { i },
      });
      seqs.push(artifactSeq);
    }
    expect(seqs).toEqual([1, 2, 3, 4]);
    // artifact_streams.latest_seq must track the cursor.
    const row = await db
      .select()
      .from(artifactStreams)
      .where(eq(artifactStreams.runId, runId))
      .get();
    expect(row?.latestSeq).toBe(4);
  });

  it("deleteExecutionEventsForRun removes SQLite rows", async () => {
    const runId = await createDirectRun();
    await recordExecutionEvent({ runId, eventType: "supervisor.observation", details: { a: 1 } });
    await recordExecutionEvent({ runId, eventType: "supervisor.observation", details: { a: 2 } });
    expect((await listExecutionEventsForRun(runId)).length).toBe(2);
    await deleteExecutionEventsForRun(runId);
    expect((await listExecutionEventsForRun(runId)).length).toBe(0);
  });

  it("survives a payload with embedded newlines and escapes them safely in the artifact line", async () => {
    const runId = await createDirectRun();
    const multiline = "line1\nline2\nline3";
    await recordExecutionEvent({
      runId,
      eventType: "supervisor.observation",
      details: { multiline },
    });
    const rows = await listExecutionEventsForRun(runId);
    expect(rows).toHaveLength(1);
    const parsed = JSON.parse(rows[0].details ?? "{}");
    expect(parsed.multiline).toBe(multiline);
  });
});
