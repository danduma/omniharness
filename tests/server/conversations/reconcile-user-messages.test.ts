import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";
import { reconcileWorkerUserMessagesInStream } from "@/server/conversations/send-message";

async function setupDirectRun() {
  __resetOutputStoreCachesForTests();
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  await db.insert(plans).values({
    id: planId,
    path: "docs/example.md",
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
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    cwd: "/tmp",
    status: "idle",
    workerNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { runId, workerId };
}

describe("reconcileWorkerUserMessagesInStream", () => {
  it("backfills missing user_input entries from DB rows without throwing", async () => {
    const { runId, workerId } = await setupDirectRun();

    const messageId = randomUUID();
    const messageCreatedAt = new Date();
    await db.insert(messages).values({
      id: messageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "what happened to my session?",
      createdAt: messageCreatedAt,
    });

    // Stream starts empty. The DB row points at a user_input the stream
    // never received — the exact crash-window state that used to produce
    // the 409 "Previous message is still being persisted" error.
    const before = await readWorkerOutputEntries(runId, workerId);
    expect(before.filter((entry) => (entry as { type?: string }).type === "user_input")).toHaveLength(0);

    await expect(reconcileWorkerUserMessagesInStream(runId, workerId)).resolves.toBeUndefined();

    const after = await readWorkerOutputEntries(runId, workerId);
    const userInputs = after.filter((entry) => (entry as { type?: string }).type === "user_input");
    expect(userInputs).toHaveLength(1);
    expect(userInputs[0]).toMatchObject({
      id: messageId,
      type: "user_input",
      text: "what happened to my session?",
    });
  });

  it("is a no-op when every DB user message already has a stream entry", async () => {
    const { runId, workerId } = await setupDirectRun();

    const messageId = randomUUID();
    const createdAt = new Date();
    await db.insert(messages).values({
      id: messageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "already streamed",
      createdAt,
    });
    await writeWorkerOutputEntries(runId, workerId, [
      {
        id: messageId,
        type: "user_input",
        text: "already streamed",
        timestamp: createdAt.toISOString(),
        authorRole: "user",
        channel: "stdin",
        seq: 1,
      },
    ]);

    const before = await readWorkerOutputEntries(runId, workerId);
    const beforeUserInputs = before.filter((entry) => (entry as { type?: string }).type === "user_input");
    expect(beforeUserInputs).toHaveLength(1);

    await reconcileWorkerUserMessagesInStream(runId, workerId);

    const after = await readWorkerOutputEntries(runId, workerId);
    const afterUserInputs = after.filter((entry) => (entry as { type?: string }).type === "user_input");
    // Still exactly 1; no double-append.
    expect(afterUserInputs).toHaveLength(1);
    expect(afterUserInputs[0].id).toBe(messageId);
  });
});
