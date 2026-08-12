import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getAppDataPath } from "@/server/app-root";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { appendWorkerEntry } from "@/server/workers/output-store";
import { conversationTranscriptRoute as GET } from "@/../tests/helpers/runtime-routes";

function encodeAfterToken(cursors: Record<string, number>) {
  return Buffer.from(JSON.stringify({ cursors }), "utf8").toString("base64url");
}

function decodeAfterToken(raw: string) {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
    cursors: Record<string, number>;
  };
}

async function cleanupRun(runId: string, planId: string) {
  await db.delete(workers).where(eq(workers.runId, runId));
  await db.delete(runs).where(eq(runs.id, runId));
  await db.delete(plans).where(eq(plans.id, planId));
  await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
}

describe("GET /api/conversations/[id]/transcript", () => {
  const previousBypassAuth = process.env.OMNIHARNESS_TEST_BYPASS_AUTH;

  afterEach(() => {
    if (previousBypassAuth == null) {
      delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    } else {
      process.env.OMNIHARNESS_TEST_BYPASS_AUTH = previousBypassAuth;
    }
  });

  it("does not skip capped worker transcript pages when advancing the cursor", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();

    try {
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workers).values({
        id: workerId,
        runId,
        type: "claude",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });

      for (let seq = 1; seq <= 251; seq += 1) {
        await appendWorkerEntry(runId, workerId, {
          id: `entry-${seq}`,
          type: "message",
          text: `message ${seq}`,
          timestamp: new Date(now.getTime() + seq).toISOString(),
        });
      }

      const afterToken = encodeAfterToken({ [workerId]: 1 });
      const response = await GET(
        new Request(`http://localhost/api/conversations/${runId}/transcript?afterToken=${afterToken}`),
        { params: Promise.resolve({ id: runId }) },
      );
      const payload = await response.json() as {
        entries: Array<{ seq: number; text: string }>;
        latestToken: string;
      };

      expect(response.status).toBe(200);
      expect(payload.entries).toHaveLength(200);
      expect(payload.entries[0]).toMatchObject({ seq: 2, text: "message 2" });
      expect(payload.entries.at(-1)).toMatchObject({ seq: 201, text: "message 201" });
      expect(decodeAfterToken(payload.latestToken).cursors[workerId]).toBe(201);
    } finally {
      await cleanupRun(runId, planId);
    }
  });

  it("filters diagnostic plan rows while advancing the raw contiguous cursor", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();

    try {
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workers).values({
        id: workerId,
        runId,
        type: "claude",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });
      await appendWorkerEntry(runId, workerId, {
        id: "visible-message",
        type: "message",
        text: "working",
        timestamp: now.toISOString(),
      });
      await appendWorkerEntry(runId, workerId, {
        id: "plan-diagnostic",
        type: "system_note",
        text: "rejected plan",
        timestamp: new Date(now.getTime() + 1).toISOString(),
        planProjection: "rejected",
        diagnosticOnly: true,
      });

      const response = await GET(
        new Request(`http://localhost/api/conversations/${runId}/transcript?afterToken=${encodeAfterToken({ [workerId]: 0 })}`),
        { params: Promise.resolve({ id: runId }) },
      );
      const payload = await response.json() as {
        entries: Array<{ id: string; seq: number }>;
        latestToken: string;
      };

      expect(response.status).toBe(200);
      expect(payload.entries).toEqual([expect.objectContaining({ id: "visible-message", seq: 1 })]);
      expect(decodeAfterToken(payload.latestToken).cursors[workerId]).toBe(2);
    } finally {
      await cleanupRun(runId, planId);
    }
  });

  it("returns the latest transcript window on cold tail load", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();

    try {
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workers).values({
        id: workerId,
        runId,
        type: "claude",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });

      for (let seq = 1; seq <= 251; seq += 1) {
        await appendWorkerEntry(runId, workerId, {
          id: `entry-${seq}`,
          type: "message",
          text: `message ${seq}`,
          timestamp: new Date(now.getTime() + seq).toISOString(),
        });
      }

      const response = await GET(
        new Request(`http://localhost/api/conversations/${runId}/transcript?limit=100`),
        { params: Promise.resolve({ id: runId }) },
      );
      const payload = await response.json() as {
        entries: Array<{ seq: number; text: string }>;
        latestToken: string;
        oldestToken: string;
        hasOlder: boolean;
      };

      expect(response.status).toBe(200);
      expect(payload.entries).toHaveLength(100);
      expect(payload.entries[0]).toMatchObject({ seq: 152, text: "message 152" });
      expect(payload.entries.at(-1)).toMatchObject({ seq: 251, text: "message 251" });
      expect(decodeAfterToken(payload.latestToken).cursors[workerId]).toBe(251);
      expect(decodeAfterToken(payload.oldestToken).cursors[workerId]).toBe(152);
      expect(payload.hasOlder).toBe(true);
    } finally {
      await cleanupRun(runId, planId);
    }
  });

  it("returns the previous transcript window before the oldest cursor", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();

    try {
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workers).values({
        id: workerId,
        runId,
        type: "claude",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });

      for (let seq = 1; seq <= 251; seq += 1) {
        await appendWorkerEntry(runId, workerId, {
          id: `entry-${seq}`,
          type: "message",
          text: `message ${seq}`,
          timestamp: new Date(now.getTime() + seq).toISOString(),
        });
      }

      const beforeToken = encodeAfterToken({ [workerId]: 152 });
      const response = await GET(
        new Request(`http://localhost/api/conversations/${runId}/transcript?beforeToken=${beforeToken}&limit=100`),
        { params: Promise.resolve({ id: runId }) },
      );
      const payload = await response.json() as {
        entries: Array<{ seq: number; text: string }>;
        oldestToken: string;
        hasOlder: boolean;
      };

      expect(response.status).toBe(200);
      expect(payload.entries).toHaveLength(100);
      expect(payload.entries[0]).toMatchObject({ seq: 52, text: "message 52" });
      expect(payload.entries.at(-1)).toMatchObject({ seq: 151, text: "message 151" });
      expect(decodeAfterToken(payload.oldestToken).cursors[workerId]).toBe(52);
      expect(payload.hasOlder).toBe(true);
    } finally {
      await cleanupRun(runId, planId);
    }
  });

  it("hides the branch a rewind discarded across every transcript page", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const oldWorkerId = `${runId}-worker-1`;
    const newWorkerId = `${runId}-worker-2`;
    const now = new Date();

    try {
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      const workerRow = {
        runId,
        type: "claude",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(workers).values([
        // The rewind supersedes seq 2 (the original delivery of the edited
        // message) through seq 3 (the stream tip when the user hit save).
        { ...workerRow, id: oldWorkerId, supersededSeqRanges: '[{"from":2,"through":3}]' },
        { ...workerRow, id: newWorkerId, createdAt: new Date(now.getTime() + 1_000) },
      ]);

      await appendWorkerEntry(runId, oldWorkerId, {
        id: "kept-1",
        type: "message",
        text: "before the rewind",
        timestamp: new Date(now.getTime() + 1).toISOString(),
      });
      await appendWorkerEntry(runId, oldWorkerId, {
        id: "edited-message",
        type: "user_input",
        text: "original wording",
        timestamp: new Date(now.getTime() + 2).toISOString(),
      });
      await appendWorkerEntry(runId, oldWorkerId, {
        id: "discarded-answer",
        type: "message",
        text: "answer from the discarded attempt",
        timestamp: new Date(now.getTime() + 3).toISOString(),
      });
      await appendWorkerEntry(runId, newWorkerId, {
        id: "edited-message",
        type: "user_input",
        text: "edited wording",
        timestamp: new Date(now.getTime() + 4).toISOString(),
      });

      const tailResponse = await GET(
        new Request(`http://localhost/api/conversations/${runId}/transcript?limit=50`),
        { params: Promise.resolve({ id: runId }) },
      );
      const tail = await tailResponse.json() as { entries: Array<{ id: string; text: string }> };

      expect(tailResponse.status).toBe(200);
      expect(tail.entries.map((entry) => entry.text)).toEqual(["before the rewind", "edited wording"]);

      // Incremental polling must not re-add them either.
      const afterResponse = await GET(
        new Request(`http://localhost/api/conversations/${runId}/transcript?afterToken=${encodeAfterToken({ [oldWorkerId]: 0, [newWorkerId]: 0 })}`),
        { params: Promise.resolve({ id: runId }) },
      );
      const after = await afterResponse.json() as { entries: Array<{ id: string; text: string }> };
      expect(after.entries.map((entry) => entry.text)).toEqual(["before the rewind", "edited wording"]);
    } finally {
      await cleanupRun(runId, planId);
    }
  });
});
