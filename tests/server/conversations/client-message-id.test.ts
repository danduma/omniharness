import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { messages, plans, runs } from "@/server/db/schema";
import { resolveUserMessageId } from "@/server/conversations/send-message";
import { createQueuedConversationMessage } from "@/server/conversations/queued-messages";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Every row here is keyed by a fresh uuid, so nothing needs clearing between
// tests. Truncating the shared tables would race the other server suites.
async function seedRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const now = new Date();
  await db.insert(plans).values({
    id: planId,
    path: `vibes/ad-hoc/${planId}.md`,
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
  return runId;
}

describe("resolveUserMessageId", () => {
  it("adopts a well-formed client id so the optimistic row and the persisted row are one row", async () => {
    const clientMessageId = randomUUID();

    await expect(resolveUserMessageId(clientMessageId)).resolves.toBe(clientMessageId);
  });

  it("normalises case so the id the client rendered under matches the one it gets back", async () => {
    const clientMessageId = randomUUID().toUpperCase();

    await expect(resolveUserMessageId(clientMessageId)).resolves.toBe(clientMessageId.toLowerCase());
  });

  it.each([
    ["absent", null],
    ["empty", ""],
    ["not a uuid", "optimistic-42"],
    ["uuid-shaped but not hex", "zzzzzzzz-2222-4333-8444-555555555555"],
  ])("mints its own id when the client id is %s", async (_label, clientMessageId) => {
    const resolved = await resolveUserMessageId(clientMessageId);

    expect(resolved).toMatch(UUID_PATTERN);
    expect(resolved).not.toBe(clientMessageId);
  });

  it("keeps an existing client id as the idempotency key", async () => {
    const runId = await seedRun();
    const clientMessageId = randomUUID();
    await db.insert(messages).values({
      id: clientMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "already landed",
      createdAt: new Date(),
    });

    const resolved = await resolveUserMessageId(clientMessageId);

    expect(resolved).toBe(clientMessageId);
  });
});

describe("createQueuedConversationMessage", () => {
  it("adopts the client id so the optimistic queue row and the server row are one row", async () => {
    const runId = await seedRun();
    const clientMessageId = randomUUID();

    const queued = await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "queue this while the worker is busy",
      clientMessageId,
    });

    expect(queued.id).toBe(clientMessageId);
  });

  it("mints its own id when no client id is supplied", async () => {
    const runId = await seedRun();

    const queued = await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "queue this while the worker is busy",
    });

    expect(queued.id).toMatch(UUID_PATTERN);
  });

  it("returns a matching existing queue row for an idempotent retry", async () => {
    const runId = await seedRun();
    const clientMessageId = randomUUID();
    await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "first",
      clientMessageId,
    });

    const resent = await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "first",
      clientMessageId,
    });

    expect(resent.id).toBe(clientMessageId);
  });

  it("rejects reuse of a queue id with different content", async () => {
    const runId = await seedRun();
    const clientMessageId = randomUUID();
    await createQueuedConversationMessage({ runId, action: "queue", content: "first", clientMessageId });

    await expect(createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "different",
      clientMessageId,
    })).rejects.toMatchObject({ status: 409, code: "conversation_message_id_conflict" });
  });

  it("rejects reuse of a queue id for different operation options", async () => {
    const runId = await seedRun();
    const clientMessageId = randomUUID();
    await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "first",
      clientMessageId,
      operationFingerprint: "fingerprint-a",
    });

    await expect(createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "first",
      clientMessageId,
      operationFingerprint: "fingerprint-b",
    })).rejects.toMatchObject({ status: 409, code: "conversation_message_id_conflict" });
  });
});
