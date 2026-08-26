import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { buildInitialConversationTitle } from "@/server/conversations/initial-title";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { __resetOutputStoreCachesForTests } from "@/server/workers/output-store";
import { __resetCodexThreadTitleCacheForTests } from "@/server/conversations/agent-thread-title";
import { __resetTitleMissReportingForTests, persistWorkerSnapshot } from "@/server/workers/snapshots";
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
  __resetCodexThreadTitleCacheForTests();
  __resetTitleMissReportingForTests();
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

/**
 * Codex's thread index, in the project-scoped home the runtime gives a worker
 * that has no account of its own. Only the columns the reader touches.
 */
function seedCodexThreadIndex(args: { cwd: string; sessionId: string; title: string; firstUserMessage: string }) {
  const dir = join(args.cwd, ".omniharness", "cli-home", "codex", "sqlite");
  mkdirSync(dir, { recursive: true });
  const database = new Database(join(dir, "state_5.sqlite"));
  database.exec(`CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    first_user_message TEXT NOT NULL DEFAULT ''
  );`);
  database
    .prepare("INSERT INTO threads (id, title, first_user_message) VALUES (?, ?, ?)")
    .run(args.sessionId, args.title, args.firstUserMessage);
  database.close();
}

async function seedTitledDirectWorker(args: { userMessage: string; sessionId?: string; cwd?: string }) {
  const { runId } = await seedDirectRun();
  const workerId = `${runId}-worker-1`;
  const now = new Date();

  await db.update(runs).set({
    title: buildInitialConversationTitle(args.userMessage),
    status: "running",
    updatedAt: now,
  }).where(eq(runs.id, runId));
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    status: "working",
    cwd: args.cwd ?? "/workspace",
    initialPrompt: args.userMessage,
    bridgeSessionId: args.sessionId ?? null,
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
    content: args.userMessage,
    createdAt: now,
  });

  return { runId, workerId, now };
}

describe("conversation title fallback lifecycle", () => {
  it("keeps the initial title and delivers the missing-source event over the production SSE stream", async () => {
    const userMessage = "Restore reliable conversation title generation";
    const { runId, workerId, now } = await seedTitledDirectWorker({ userMessage });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Both provider metadata sources are empty.",
      outputEntries: [{
        id: "assistant-reply",
        type: "message",
        text: "Both provider metadata sources are empty.",
        timestamp: new Date(now.getTime() + 1_000).toISOString(),
      }],
    });

    const missing = await client.waitFor("conversation.title_sources_missing", { timeoutMs: 10_000 });
    expect(missing.payload).toMatchObject({
      kind: "conversation.title_sources_missing",
      runId,
      workerId,
      fallback: "initial_title",
    });

    // Nothing invents a title in the CLI's place.
    expect(client.events.filterByEvent("conversation.title_updated")).toHaveLength(0);
    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe(buildInitialConversationTitle(userMessage));
  });

  it("adopts the name Codex gave its own thread", async () => {
    const userMessage = "commit, push, pull, sync everything";
    const sessionId = randomUUID();
    const cwd = mkdtempSync(join(tmpdir(), "omni-codex-cwd-"));
    const { runId, workerId, now } = await seedTitledDirectWorker({ userMessage, sessionId, cwd });
    seedCodexThreadIndex({
      cwd,
      sessionId,
      title: "Sync and push everything",
      firstUserMessage: userMessage,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Pushed.",
      sessionId,
      outputEntries: [{
        id: "assistant-reply",
        type: "message",
        text: "Pushed.",
        timestamp: new Date(now.getTime() + 1_000).toISOString(),
      }],
    });

    const updated = await client.waitFor("conversation.title_updated", { timeoutMs: 10_000 });
    expect(updated.payload).toMatchObject({
      kind: "conversation.title_updated",
      runId,
      source: "agent_thread_index",
      title: "Sync and push everything",
    });
    expect(client.events.filterByEvent("conversation.title_sources_missing")).toHaveLength(0);
  });

  it("ignores the thread index while it still holds the prompt Codex seeded it with", async () => {
    const userMessage = "commit, push, pull, sync everything";
    const sessionId = randomUUID();
    const cwd = mkdtempSync(join(tmpdir(), "omni-codex-cwd-"));
    const { runId, now } = await seedTitledDirectWorker({ userMessage, sessionId, cwd });
    const workerId = `${runId}-worker-1`;
    seedCodexThreadIndex({ cwd, sessionId, title: userMessage, firstUserMessage: userMessage });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Pushed.",
      sessionId,
      outputEntries: [{
        id: "assistant-reply",
        type: "message",
        text: "Pushed.",
        timestamp: new Date(now.getTime() + 1_000).toISOString(),
      }],
    });

    const missing = await client.waitFor("conversation.title_sources_missing", { timeoutMs: 10_000 });
    expect(missing.payload).toMatchObject({ kind: "conversation.title_sources_missing", runId });
    expect(client.events.filterByEvent("conversation.title_updated")).toHaveLength(0);
    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe(buildInitialConversationTitle(userMessage));
  });
});
