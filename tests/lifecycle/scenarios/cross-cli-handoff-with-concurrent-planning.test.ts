import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  artifactStreams,
  conversationHandoffs,
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  supervisorScheduledWakes,
  workerCounters,
  workers,
} from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import {
  conversationsRouteModule,
  eventsRouteModule,
  runHandoffsRouteModule,
} from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const cancelledAgents = new Set<string>();

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn(async (args: { name: string; type: string; cwd: string }) => ({
    name: args.name,
    type: args.type,
    cwd: args.cwd,
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: `${args.name}-session`,
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
  })),
  askAgent: vi.fn(async (_name, prompt, _attachments, options) => {
    await options?.onAccepted?.();
    if (prompt.startsWith("Summarize the persisted handoff evidence")) {
      return {
        response: "```omniharness-handoff\nTASK: Continue the task\nPROGRESS: Context captured\nNEXT_STEPS: Continue implementation\nBLOCKERS: none\nOPEN_QUESTIONS: none\nRELEVANT_FILES: none\n```",
        state: "idle",
        stopReason: "end_turn",
      };
    }
    return { response: "continued", state: "idle", stopReason: "end_turn" };
  }),
  getAgent: vi.fn(async (name: string) => {
    if (cancelledAgents.has(name)) throw Object.assign(new Error("agent missing"), { status: 404 });
    return {
      name,
      type: "codex",
      cwd: process.cwd(),
      state: "idle",
      currentText: "",
      lastText: "continued",
      sessionId: `${name}-session`,
      sessionMode: null,
      pendingPermissions: [],
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    };
  }),
  cancelAgent: vi.fn(async (name: string) => { cancelledAgents.add(name); }),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/supervisor/worker-availability", () => ({ isSpawnableWorkerType: () => ({ ok: true }) }));
vi.mock("@/server/quota/type-blocking", () => ({ isWorkerTypeQuotaBlocked: async () => false, clearResolvedQuotaIncidents: async () => undefined }));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  cancelledAgents.clear();
  __resetNamedEventsForTests();
  await db.delete(conversationHandoffs);
  await db.delete(supervisorScheduledWakes);
  await db.delete(recoveryIncidents);
  await db.delete(queuedConversationMessages);
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(artifactStreams);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
  server = await startLifecycleHarness({ routes: [
    { pattern: "/api/events", module: eventsRouteModule },
    { pattern: "/api/conversations", module: conversationsRouteModule },
    { pattern: "/api/runs/:id/handoffs", module: runHandoffsRouteModule },
  ] });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(97, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle — cross-CLI handoff with concurrent planning", () => {
  it("prepares a direct handoff without stopping a planning conversation in the same checkout", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});
    const sourceResponse = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "Implement the feature", preferredWorkerType: "codex", projectPath: process.cwd() }),
    });
    expect(sourceResponse.status).toBe(200);
    const source = await sourceResponse.json() as { runId: string };
    const sourceWorker = await db.select().from(workers).where(eq(workers.runId, source.runId)).get();
    const now = new Date();
    await db.insert(plans).values({ id: "concurrent-plan", path: "/tmp/concurrent-plan", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({
      id: "concurrent-planning-run",
      planId: "concurrent-plan",
      mode: "planning",
      sessionType: "omni",
      projectPath: process.cwd(),
      status: "working",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: "concurrent-planning-worker",
      runId: "concurrent-planning-run",
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      title: "planner",
      initialPrompt: "Plan another task",
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    const prepareResponse = await client.fetch(`/api/runs/${source.runId}/handoffs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceWorkerId: sourceWorker!.id,
        forkedFromMessageId: null,
        reason: "manual_session",
        target: { workerType: "claude", model: null, effort: null, accountId: null },
      }),
    });
    const prepared = await prepareResponse.json() as { handoff?: { id: string; status: string }; error?: unknown };

    expect(prepareResponse.status, JSON.stringify(prepared)).toBe(201);
    expect(prepared.handoff?.status).toBe("ready");
    expect(cancelledAgents).not.toContain("concurrent-planning-worker");
    expect(await db.select().from(runs).where(eq(runs.id, "concurrent-planning-run")).get()).toMatchObject({ status: "working" });
    await client.waitFor("handoff.packet_ready", {
      predicate: (frame) => (frame.payload as { handoffId?: string } | null)?.handoffId === prepared.handoff?.id,
      timeoutMs: 10_000,
    });
  });
});
