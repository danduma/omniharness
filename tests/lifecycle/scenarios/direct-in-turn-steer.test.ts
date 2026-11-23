/**
 * Steering a running direct Claude turn, end to end with nothing mocked on
 * the steer path: the real conversation routes, the real bridge client over
 * HTTP, the real agent runtime server, and an ACP adapter subprocess that
 * implements claude-agent-acp's `_session/steering` contract.
 *
 * User report: every steer made Claude say the user had cancelled its
 * command, because steer was cancel-and-replace and the provider recorded an
 * interruption. A steer must now reach the running turn without any cancel,
 * and when the in-turn path is unavailable the old path must still deliver.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { rmSync } from "node:fs";
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
import { createFakeSteeringAcp, type FakeSteeringAcp, type FakeSteeringAcpOptions } from "@/../tests/helpers/fake-steering-acp";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

let server: LifecycleServer;
let client: LifecycleClient;
let runtime: Server | null = null;
let fake: FakeSteeringAcp | null = null;

async function startRuntime(options: FakeSteeringAcpOptions) {
  fake = createFakeSteeringAcp(options);
  runtime = createAgentRuntimeServer({
    config: { agents: { claude: { command: fake.command, args: [] } } },
    env: {
      ...process.env,
      OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
      OMNIHARNESS_MEMORY_TRACE: "0",
      OMNIHARNESS_ABSORBED_PROMPT_QUIET_MS: "2000",
      OMNIHARNESS_STEER_TIMEOUT_MS: "500",
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

async function waitForTurnRunning(runId: string) {
  await waitUntil(
    () => fake!.methods().some((entry) => entry.method === "session/prompt"),
    8_000,
    `the first prompt for ${runId} to reach the adapter`,
  );
}

async function waitForRunToSettle(runId: string) {
  await waitUntil(async () => {
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    return Boolean(run && ["done", "awaiting_user", "failed"].includes(run.status));
  }, 10_000, `run ${runId} to settle`);
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
    adapterMethods: fake?.methods().map((entry) => entry.method),
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
  if (fake) {
    rmSync(fake.dir, { recursive: true, force: true });
    fake = null;
  }
});

describe("lifecycle — steering a running direct Claude turn", () => {
  it("delivers a composer steer into the running turn with no cancel and a clean transcript", async () => {
    await startRuntime({ turnDurationMs: 6_000 });
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const runId = await createDirectConversation("Refactor the parser module.");
    await waitForTurnRunning(runId);

    const steerResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Also keep the old API exported.", busyAction: "steer" }),
    });
    const steerBody = await steerResponse.json() as { interruption?: { status: string }; queuedMessage?: { id: string; status: string } };
    expect(steerResponse.status, JSON.stringify(steerBody)).toBe(200);
    expect(steerBody.interruption?.status, await diagnostics(runId)).toBe("injected");
    expect(steerBody.queuedMessage?.status).toBe("delivered");

    try {
      await waitForRunToSettle(runId);
    } catch (error) {
      throw new Error(`${(error as Error).message}\n${await diagnostics(runId)}`);
    }

    const methods = fake!.methods().map((entry) => entry.method);
    expect(methods, await diagnostics(runId)).not.toContain("session/cancel");
    expect(methods.filter((method) => method === "session/prompt")).toHaveLength(1);
    expect(methods.filter((method) => method === "_session/steering")).toHaveLength(1);
    const steerCall = fake!.methods().find((entry) => entry.method === "_session/steering")!;
    const steerText = (steerCall.params?.prompt as Array<{ type: string; text?: string }>)[0]?.text;
    expect(steerText).toBe("Also keep the old API exported.");

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status, await diagnostics(runId)).toBe("done");
    expect(run?.lastError).toBeNull();

    // Transcript order: initial prompt, pre-steer output, the steer, the reply.
    const entries = await readWorkerOutputEntries(runId, `${runId}-worker-1`);
    const visible = entries.filter((entry) => entry.type === "user_input" || entry.type === "message");
    const steerIndex = visible.findIndex((entry) => entry.type === "user_input" && entry.text === "Also keep the old API exported.");
    const replyIndex = visible.findIndex((entry) => entry.type === "message" && (entry.text ?? "").includes("Steer received: Also keep the old API exported."));
    const workingIndex = visible.findIndex((entry) => entry.type === "message" && (entry.text ?? "").includes("Working on"));
    expect(steerIndex, await diagnostics(runId)).toBeGreaterThan(-1);
    expect(workingIndex).toBeGreaterThan(-1);
    expect(replyIndex).toBeGreaterThan(steerIndex);
    expect(workingIndex).toBeLessThan(steerIndex);
    const initialIndex = visible.findIndex((entry) => entry.type === "user_input" && (entry.text ?? "").includes("Refactor the parser module."));
    expect(initialIndex, await diagnostics(runId)).toBeGreaterThan(-1);
    expect(initialIndex).toBeLessThan(workingIndex);
    expect(visible.filter((entry) => entry.type === "user_input" && entry.text === "Also keep the old API exported.")).toHaveLength(1);

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
    expect(queued.map((row) => row.status)).toEqual(["delivered"]);
    const userMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(userMessages.filter((row) => row.content === "Also keep the old API exported.")).toHaveLength(1);

    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    const eventTypes = events.map((event) => event.eventType);
    expect(eventTypes).toContain("queued_message_interrupt_injected");
    expect(eventTypes).not.toContain("run_failed");
    expect(eventTypes).not.toContain("queued_message_turn_cancelled");
    const surfaced = namedEventKinds(runId).filter((event) => event.kind === "error.surfaced");
    expect(surfaced, await diagnostics(runId)).toEqual([]);
  });

  it("delivers an Escape steer into the running turn, then accepts a normal follow-up", async () => {
    await startRuntime({ turnDurationMs: 6_000 });
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const runId = await createDirectConversation("Write the migration.");
    await waitForTurnRunning(runId);

    const steerResponse = await client.fetch(`/api/conversations/${runId}/queued-messages/interrupt-next`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Use a transaction." }),
    });
    expect(steerResponse.status).toBe(200);
    const steerBody = await steerResponse.json() as { interruption: { status: string } };
    expect(steerBody.interruption.status, await diagnostics(runId)).toBe("injected");
    await waitForRunToSettle(runId);

    const followUp = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Now add a test." }),
    });
    expect(followUp.status).toBe(200);
    await waitUntil(
      () => fake!.methods().filter((entry) => entry.method === "session/prompt").length === 2,
      8_000,
      "the follow-up prompt",
    );
    // Steer the follow-up too: the session must still steer after a steer.
    const secondSteer = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Name it test_migration.", busyAction: "steer" }),
    });
    const secondBody = await secondSteer.json() as { interruption?: { status: string } };
    expect(secondBody.interruption?.status, await diagnostics(runId)).toBe("injected");
    await waitUntil(async () => {
      const entries = await readWorkerOutputEntries(runId, `${runId}-worker-1`);
      return entries.some((entry) => entry.type === "message" && (entry.text ?? "").includes("Steer received: Name it test_migration."));
    }, 10_000, "the second steer's reply");
    await waitForRunToSettle(runId);

    expect(fake!.methods().map((entry) => entry.method)).not.toContain("session/cancel");
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status, await diagnostics(runId)).toBe("done");
    expect(namedEventKinds(runId).filter((event) => event.kind === "error.surfaced")).toEqual([]);
  });

  it("persists Claude's own follow-up turn when a steer backgrounds the running tool", async () => {
    await startRuntime({ turnDurationMs: 6_000, backgroundContinuationMs: 1_500 });
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const runId = await createDirectConversation("Run the slow build script.");
    const workerId = `${runId}-worker-1`;
    await waitForTurnRunning(runId);

    const steerResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Also report the exit code.", busyAction: "steer" }),
    });
    const steerBody = await steerResponse.json() as { interruption?: { status: string } };
    expect(steerBody.interruption?.status, await diagnostics(runId)).toBe("injected");

    // The prompted turn ends first, with Claude saying it will wait.
    await waitForRunToSettle(runId);

    // The runtime watchdog's bridge sweep is what picks up a turn the agent
    // starts on its own; drive it the way the 15s watchdog would.
    await waitUntil(async () => {
      await syncConversationSessionsFromBridge();
      const entries = await readWorkerOutputEntries(runId, workerId);
      return entries.some((entry) => entry.type === "message" && (entry.text ?? "").includes("Background command finished: FIRST_DONE. Steer received: Also report the exit code."));
    }, 10_000, "Claude's unprompted follow-up in the transcript").catch(async (error) => {
      throw new Error(`${(error as Error).message}\n${await diagnostics(runId)}`);
    });
    await waitUntil(async () => {
      await syncConversationSessionsFromBridge();
      const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
      return run?.status === "done";
    }, 10_000, "the run to read done after the follow-up");

    const entries = await readWorkerOutputEntries(runId, workerId);
    const visible = entries.filter((entry) => entry.type === "user_input" || entry.type === "message");
    const steerIndex = visible.findIndex((entry) => entry.type === "user_input" && entry.text === "Also report the exit code.");
    const waitingIndex = visible.findIndex((entry) => entry.type === "message" && (entry.text ?? "").includes("still running in the background"));
    const followUpIndex = visible.findIndex((entry) => entry.type === "message" && (entry.text ?? "").includes("Background command finished"));
    expect(steerIndex).toBeGreaterThan(-1);
    expect(waitingIndex).toBeGreaterThan(steerIndex);
    expect(followUpIndex).toBeGreaterThan(waitingIndex);

    // Once persisted, later sweeps leave the settled run alone: no new
    // transcript entries, execution events or status changes.
    const settledEntryCount = entries.length;
    const settledEventCount = (await db.select().from(executionEvents).where(eq(executionEvents.runId, runId))).length;
    await syncConversationSessionsFromBridge();
    await syncConversationSessionsFromBridge();
    expect((await readWorkerOutputEntries(runId, workerId)).length).toBe(settledEntryCount);
    expect((await db.select().from(executionEvents).where(eq(executionEvents.runId, runId))).length).toBe(settledEventCount);
    expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).toBe("done");

    // Nothing was cancelled, re-prompted or re-delivered.
    const methods = fake!.methods().map((entry) => entry.method);
    expect(methods).not.toContain("session/cancel");
    expect(methods.filter((method) => method === "session/prompt")).toHaveLength(1);
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.lastError).toBeNull();
    expect(namedEventKinds(runId).filter((event) => event.kind === "error.surfaced"), await diagnostics(runId)).toEqual([]);
  });

  it.each<[string, FakeSteeringAcpOptions]>([
    ["the adapter does not advertise steering", { steeringSupported: false }],
    ["the adapter rejects the steer", { steerBehavior: "error" }],
    ["the steer request hangs", { steerBehavior: "hang" }],
  ])("still delivers the steer by cancel-and-replace when %s", async (_label, options) => {
    await startRuntime({ turnDurationMs: 6_000, ...options });
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const runId = await createDirectConversation("Investigate the flaky test.");
    await waitForTurnRunning(runId);

    const steerResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Check the timezone handling first.", busyAction: "steer" }),
    });
    const steerBody = await steerResponse.json() as { interruption?: { status: string } };
    expect(steerResponse.status, JSON.stringify(steerBody)).toBe(200);
    expect(steerBody.interruption?.status, await diagnostics(runId)).toBe("delivering");

    // The replacement prompt carries the steer notice and the message.
    await waitUntil(
      () => fake!.methods().filter((entry) => entry.method === "session/prompt").length === 2,
      10_000,
      "the replacement prompt",
    ).catch(async (error) => {
      throw new Error(`${(error as Error).message}\n${await diagnostics(runId)}`);
    });
    const replacement = fake!.methods().filter((entry) => entry.method === "session/prompt")[1]!;
    const replacementText = (replacement.params?.prompt as Array<{ type: string; text?: string }>)[0]?.text ?? "";
    expect(replacementText.startsWith("OmniHarness steer notice:")).toBe(true);
    expect(replacementText).toContain("Check the timezone handling first.");
    expect(fake!.methods().map((entry) => entry.method)).toContain("session/cancel");

    // Let the replacement turn finish on its own (no steer arrives for it).
    await waitForRunToSettle(runId);
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status, await diagnostics(runId)).toBe("done");
    expect(run?.lastError).toBeNull();
    // The row is closed right after the reply is persisted, which can land a
    // moment after the run reads as done.
    await waitUntil(async () => {
      const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
      return queued.length === 1 && queued[0]?.status === "delivered";
    }, 5_000, "the queued steer row to be delivered").catch(async (error) => {
      throw new Error(`${(error as Error).message}\n${await diagnostics(runId)}`);
    });
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.map((event) => event.eventType)).toContain("queued_message_interrupt_inject_fallback");
    expect(events.map((event) => event.eventType)).not.toContain("run_failed");
  }, 30_000);
});
