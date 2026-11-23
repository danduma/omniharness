/**
 * Live, full-stack check of in-turn steering: the real conversation routes,
 * the real bridge client over HTTP, the real agent runtime, the real
 * claude-agent-acp adapter, and a real Claude model. Opt-in, because it spends
 * real model usage:
 *
 *   OMNIHARNESS_LIVE_CLAUDE_STEER=1 pnpm vitest run -c vitest.live.config.ts tests/e2e/live/claude-in-turn-steer-control-plane.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";

const { runtimePort } = vi.hoisted(() => {
  const port = 41_000 + Math.floor(Math.random() * 8_000);
  process.env.OMNIHARNESS_BRIDGE_URL = `http://127.0.0.1:${port}`;
  return { runtimePort: port };
});

vi.mock("@/server/git/auto-commit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/git/auto-commit")>();
  return {
    ...actual,
    autoCommitMilestone: vi.fn(() => ({ status: "skipped", reason: "disabled" })),
    captureGitBaseline: vi.fn(() => null),
  };
});

import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";
import {
  conversationMessagesRouteModule,
  conversationsRouteModule,
  eventsRouteModule,
  queuedMessageInterruptNextRoute,
} from "@/../tests/helpers/runtime-routes";
import { createAgentRuntimeServer } from "@/server/agent-runtime/http";
import { __getRingForTests, __resetNamedEventsForTests } from "@/server/events/named-events";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { syncConversationSessionsFromBridge } from "@/server/conversations/sync";
import { startLifecycleHarness, type LifecycleServer } from "../../lifecycle/harness/server";
import { LifecycleClient } from "../../lifecycle/harness/client";
import { Chaos, NO_CHAOS } from "../../lifecycle/harness/chaos";

let server: LifecycleServer;
let client: LifecycleClient;
let runtime: Server | null = null;
const LIVE = process.env.OMNIHARNESS_LIVE_CLAUDE_STEER === "1";
const describeLive = LIVE ? describe : describe.skip;
const CANCELLATION_TALK = /\b(cancel(l)?ed|interrupted|rejected|declined|you stopped|stopped me|didn'?t want)\b/i;

async function startRuntime() {
  runtime = createAgentRuntimeServer({
    env: {
      ...process.env,
      OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "60000",
      OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
      OMNIHARNESS_MEMORY_TRACE: "0",
    } as Record<string, string>,
  });
  await new Promise<void>((resolve, reject) => {
    runtime!.once("error", reject);
    runtime!.listen(runtimePort, "127.0.0.1", () => resolve());
  });
}

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 8_000, label = "lifecycle state") {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function createDirectConversation(command: string) {
  const response = await client.fetch("/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "direct",
      command,
      preferredWorkerType: "claude",
      allowedWorkerTypes: ["claude"],
    }),
  });
  expect(response.status).toBe(200);
  const { runId } = await response.json() as { runId: string };
  return runId;
}

async function waitForRunToSettle(runId: string) {
  await waitUntil(async () => {
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    return Boolean(run && ["done", "awaiting_user", "failed"].includes(run.status));
  }, 180_000, `run ${runId} to settle`);
}

function namedEventKinds(runId?: string) {
  return __getRingForTests()
    .map((entry) => entry.event as { kind: string; runId?: string; code?: string })
    .filter((event) => !runId || !event.runId || event.runId === runId);
}

async function diagnostics(runId: string) {
  const [run, queued, events, entries] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, runId)).get(),
    db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)),
    db.select().from(executionEvents).where(eq(executionEvents.runId, runId)),
    readWorkerOutputEntries(runId, `${runId}-worker-1`).catch(() => []),
  ]);
  return JSON.stringify({
    run: run ? { status: run.status, lastError: run.lastError } : null,
    queued: queued.map((row) => ({ status: row.status, lastError: row.lastError })),
    eventTypes: events.map((event) => event.eventType),
    entries: entries.map((entry) => ({ type: entry.type, text: entry.text?.slice(0, 80) })),
    errors: namedEventKinds(runId).filter((event) => event.kind === "error.surfaced"),
  }, null, 2);
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(queuedConversationMessages);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRouteModule },
      { pattern: "/api/conversations", module: conversationsRouteModule },
      { pattern: "/api/conversations/:id/messages", module: conversationMessagesRouteModule },
      {
        pattern: "/api/conversations/:id/queued-messages/interrupt-next",
        module: { POST: queuedMessageInterruptNextRoute },
      },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(97, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  if (runtime) {
    // Stop every agent the runtime spawned, then the runtime itself.
    await fetch(`http://127.0.0.1:${runtimePort}/agents`).then(async (response) => {
      const agents = await response.json() as Array<{ name: string }> | { agents?: Array<{ name: string }> };
      const list = Array.isArray(agents) ? agents : agents.agents ?? [];
      await Promise.all(list.map((agent) => fetch(`http://127.0.0.1:${runtimePort}/agents/${agent.name}`, { method: "DELETE" })));
    }).catch(() => undefined);
    runtime.closeAllConnections?.();
    await new Promise<void>((resolve) => runtime!.close(() => resolve()));
    runtime = null;
  }
});

describeLive("live Claude, full stack: steering a running direct turn", () => {
  it("delivers a steer during a Bash call into the running turn and Claude acts on it", async () => {
    await startRuntime();
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const runId = await createDirectConversation(
      "Use the Bash tool to run exactly this command: sleep 20 && echo FIRST_DONE\n"
      + "Wait for it to finish, then reply with one short sentence saying what it printed.",
    );
    const workerId = `${runId}-worker-1`;
    await waitUntil(async () => {
      const response = await fetch(`http://127.0.0.1:${runtimePort}/agents/${workerId}`).catch(() => null);
      if (!response?.ok) return false;
      const agent = await response.json() as { outputEntries?: Array<{ type: string }> };
      return (agent.outputEntries ?? []).some((entry) => entry.type === "tool_call");
    }, 120_000, "Claude to start the Bash tool call");
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    const steerResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "One more thing: in your final reply, also include the word PINEAPPLE.", busyAction: "steer" }),
    });
    const steerBody = await steerResponse.json() as { interruption?: { status: string } };
    expect(steerResponse.status, JSON.stringify(steerBody)).toBe(200);
    expect(steerBody.interruption?.status, await diagnostics(runId)).toBe("injected");

    // Claude may answer inside the turn or, if the backgrounded command is
    // still running, continue in a turn of its own when it finishes. Either
    // way the transcript must end up with the steer's effect.
    // This harness has no runtime watchdog, so drive its bridge sweep (every
    // 15s in production), which is what persists a turn Claude starts itself.
    let lastSweep = 0;
    await waitUntil(async () => {
      if (Date.now() - lastSweep > 3_000) {
        lastSweep = Date.now();
        await syncConversationSessionsFromBridge();
      }
      const entries = await readWorkerOutputEntries(runId, workerId);
      return entries.some((entry) => entry.type === "message" && /PINEAPPLE/.test(entry.text ?? ""));
    }, 180_000, "Claude's reply to the steer in the transcript").catch(async (error) => {
      throw new Error(`${(error as Error).message}\n${await diagnostics(runId)}`);
    });
    await waitForRunToSettle(runId);

    const entries = await readWorkerOutputEntries(runId, workerId);
    const visible = entries.filter((entry) => entry.type === "user_input" || entry.type === "message");
    console.log("[live full-stack steer] transcript:\n" + visible.map((entry) => `${entry.type}: ${(entry.text ?? "").slice(0, 200)}`).join("\n"));
    const steerIndex = visible.findIndex((entry) => entry.type === "user_input" && (entry.text ?? "").includes("PINEAPPLE"));
    const replyIndex = visible.findIndex((entry) => entry.type === "message" && /PINEAPPLE/.test(entry.text ?? ""));
    expect(steerIndex).toBeGreaterThan(-1);
    expect(replyIndex).toBeGreaterThan(steerIndex);
    for (const entry of visible.slice(steerIndex + 1)) {
      if (entry.type === "message") expect(entry.text ?? "").not.toMatch(CANCELLATION_TALK);
    }

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status, await diagnostics(runId)).toBe("done");
    expect(run?.lastError).toBeNull();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    const eventTypes = events.map((event) => event.eventType);
    expect(eventTypes).toContain("queued_message_interrupt_injected");
    expect(eventTypes).not.toContain("queued_message_turn_cancelled");
    expect(eventTypes).not.toContain("run_failed");
    const cancels = __getRingForTests()
      .map((entry) => entry.event as { kind: string; workerId?: string; method?: string })
      .filter((event) => event.workerId === workerId && event.method === "session/cancel");
    expect(cancels).toEqual([]);
    expect(namedEventKinds(runId).filter((event) => event.kind === "error.surfaced"), await diagnostics(runId)).toEqual([]);
  }, 300_000);
});
