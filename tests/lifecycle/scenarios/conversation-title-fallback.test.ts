import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { buildInitialConversationTitle } from "@/server/conversations/initial-title";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { __resetOutputStoreCachesForTests } from "@/server/workers/output-store";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { compareEventStreamIds } from "@/shared/runtime";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { LifecycleClient } from "../harness/client";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  __resetOutputStoreCachesForTests();
  await db.delete(messages);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(41, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  __resetOutputStoreCachesForTests();
});

describe("conversation title fallback lifecycle", () => {
  it("delivers missing-source and harness-title events over the production SSE stream", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const userMessage = "Restore reliable conversation title generation";
    const assistantReply = "Both provider metadata sources are empty, so the harness fallback is running.";
    const now = new Date();

    await db.update(runs).set({
      title: buildInitialConversationTitle(userMessage),
      status: "running",
      updatedAt: now,
    }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace",
      initialPrompt: userMessage,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: userMessage,
      createdAt: now,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: assistantReply,
      outputEntries: [{
        id: "assistant-reply",
        type: "message",
        text: assistantReply,
        timestamp: new Date(now.getTime() + 1_000).toISOString(),
      }],
    });

    const updated = await client.waitFor("conversation.title_updated", { timeoutMs: 10_000 });
    const missing = client.events.filterByEvent("conversation.title_sources_missing")[0]!;
    expect(missing.payload).toMatchObject({
      kind: "conversation.title_sources_missing",
      runId,
      workerId,
      fallback: "harness_llm",
    });
    expect(updated.payload).toMatchObject({
      kind: "conversation.title_updated",
      runId,
      source: "harness_llm",
      title: "Restore Reliable Conversation Title Generation",
    });
    expect(compareEventStreamIds(missing.id!, updated.id!)).toBe(-1);
  });
});
