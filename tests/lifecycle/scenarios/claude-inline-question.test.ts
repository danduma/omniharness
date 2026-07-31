import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { derivePendingElicitationsFromWorkerEntries } from "@/interface/home/worker-elicitations";
import { getAppDataPath } from "@/server/app-root";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { appendWorkerEntry, readWorkerOutputEntries } from "@/server/workers/output-store";

describe("lifecycle — Claude inline question replay", () => {
  it("restores a pending multi-select after reconnect and removes it only after the durable outcome", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    try {
      await db.insert(plans).values({ id: planId, path: `docs/test/${planId}.md`, status: "running", createdAt: now, updatedAt: now });
      await db.insert(runs).values({ id: runId, planId, mode: "direct", status: "running", createdAt: now, updatedAt: now });
      await db.insert(workers).values({
        id: workerId, runId, type: "claude", status: "working", cwd: process.cwd(),
        outputLog: "", outputEntriesJson: "[]", currentText: "", lastText: "", createdAt: now, updatedAt: now,
      });
      await appendWorkerEntry(runId, workerId, {
        id: "question",
        type: "elicitation",
        text: "Question for user",
        timestamp: now.toISOString(),
        status: "pending",
        raw: {
          requestId: 2,
          mode: "form",
          sessionId: "session",
          toolCallId: "tool",
          message: "Do you have unfair access to any of these niches?",
          requestedSchema: {
            type: "object",
            properties: {
              question_0: { type: "array", title: "Niche access", items: { enum: ["Agencies", "Legal", "Property", "None"] } },
              customAnswer: { type: "string", title: "Other" },
            },
          },
        },
      });

      const reconnected = await readWorkerOutputEntries(runId, workerId);
      expect(derivePendingElicitationsFromWorkerEntries(reconnected)).toHaveLength(1);

      await appendWorkerEntry(runId, workerId, {
        id: "answer",
        type: "elicitation",
        text: "Question answered",
        timestamp: new Date(now.getTime() + 1).toISOString(),
        status: "answered",
        raw: { requestId: 2, action: "accept", content: { question_0: ["Agencies"] } },
      });
      expect(derivePendingElicitationsFromWorkerEntries(await readWorkerOutputEntries(runId, workerId))).toEqual([]);
    } finally {
      await db.delete(workers).where(eq(workers.runId, runId));
      await db.delete(runs).where(eq(runs.id, runId));
      await db.delete(plans).where(eq(plans.id, planId));
      await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
    }
  });
});
