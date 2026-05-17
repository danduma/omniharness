import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { __resetOutputStoreCachesForTests, readWorkerOutputEntries } from "@/server/workers/output-store";

describe("persistWorkerSnapshot initial direct prompt ordering", () => {
  beforeEach(async () => {
    __resetOutputStoreCachesForTests();
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  afterEach(() => {
    __resetOutputStoreCachesForTests();
  });

  it("seeds the initial direct user prompt before bridge output entries", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const messageId = randomUUID();
    const initialPrompt = "Group all currently modified files into logical git commits.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "working",
      cwd: "/workspace",
      initialPrompt,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(messages).values({
      id: messageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: initialPrompt,
      createdAt: new Date(0),
    });

    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Worker response",
      outputEntries: [
        {
          id: "bridge-entry",
          type: "message",
          text: "Worker response",
          timestamp: new Date(1000).toISOString(),
        },
      ],
    });

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((entry) => ({ id: entry.id, type: entry.type, text: entry.text, seq: (entry as { seq?: number }).seq }))).toEqual([
      { id: messageId, type: "user_input", text: initialPrompt, seq: 1 },
      { id: "bridge-entry", type: "message", text: "Worker response", seq: 2 },
    ]);
  });

  it("does not seed initial prompts for implementation workers", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;

    await db.insert(plans).values({
      id: planId,
      path: "docs/superpowers/plans/test.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace",
      initialPrompt: "Supervisor worker prompt",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Worker response",
      outputEntries: [
        {
          id: "implementation-bridge-entry",
          type: "message",
          text: "Worker response",
          timestamp: new Date(1000).toISOString(),
        },
      ],
    });

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((entry) => entry.type)).toEqual(["message"]);
  });
});
