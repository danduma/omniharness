import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactStreams, conversationHandoffs, executionEvents, messages, plans, queuedConversationMessages, recoveryIncidents, runs, supervisorScheduledWakes, workerCounters, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import {
  conversationsRouteModule,
  eventsRouteModule,
  handoffCancelRouteModule,
  handoffLaunchRouteModule,
  handoffRouteModule,
  runHandoffsRouteModule,
} from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const cancelledAgents = new Set<string>();

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn(async (args: { name: string; type: string; cwd: string }) => ({ name: args.name, type: args.type, cwd: args.cwd, state: "idle", currentText: "", lastText: "", sessionId: `${args.name}-session`, sessionMode: null, pendingPermissions: [], outputEntries: [], stderrBuffer: [], stopReason: null })),
  askAgent: vi.fn(async (_name, prompt, _attachments, options) => {
    await options?.onAccepted?.();
    if (prompt.startsWith("Summarize the persisted handoff evidence")) {
      return {
        response: "```omniharness-handoff\nTASK: Implement the feature\nPROGRESS: Existing conversation captured\nNEXT_STEPS: Continue implementation\nBLOCKERS: none\nOPEN_QUESTIONS: none\nRELEVANT_FILES: none\n```",
        state: "idle",
        stopReason: "end_turn",
      };
    }
    return { response: "continued", state: "idle", stopReason: "end_turn" };
  }),
  getAgent: vi.fn(async (name: string) => {
    if (cancelledAgents.has(name)) throw Object.assign(new Error("agent missing"), { status: 404 });
    return { name, type: name.includes("claude") ? "claude" : "codex", cwd: process.cwd(), state: "idle", currentText: "", lastText: "continued", sessionId: `${name}-session`, sessionMode: null, pendingPermissions: [], outputEntries: [], stderrBuffer: [], stopReason: null };
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
    { pattern: "/api/handoffs/:id", module: handoffRouteModule },
    { pattern: "/api/handoffs/:id/launch", module: handoffLaunchRouteModule },
    { pattern: "/api/handoffs/:id/cancel", module: handoffCancelRouteModule },
  ] });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(47, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle — cross-CLI handoff fork", () => {
  it("stops the source, persists a compact seed, and completes into a distinct target run", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});
    const createdResponse = await client.fetch("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "direct", command: "Implement the feature", preferredWorkerType: "codex", projectPath: process.cwd() }) });
    expect(createdResponse.status).toBe(200);
    const created = await createdResponse.json() as { runId: string };
    const sourceWorker = await db.select().from(workers).where(eq(workers.runId, created.runId)).get();
    expect(sourceWorker?.type).toBe("codex");

    const prepareResponse = await client.fetch(`/api/runs/${created.runId}/handoffs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceWorkerId: sourceWorker!.id, forkedFromMessageId: null, reason: "manual_session", target: { workerType: "claude", model: null, effort: null, accountId: null } }) });
    expect(prepareResponse.status).toBe(201);
    const prepared = await prepareResponse.json() as { handoff: { id: string; revision: number; status: string } };
    expect(prepared.handoff.status).toBe("ready");
    await client.waitFor("handoff.summary_completed", { predicate: (frame) => (frame.payload as { handoffId?: string } | null)?.handoffId === prepared.handoff.id, timeoutMs: 10_000 });

    const launchResponse = await client.fetch(`/api/handoffs/${prepared.handoff.id}/launch?runId=${created.runId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: prepared.handoff.revision, operationId: "lifecycle-launch" }) });
    const launched = await launchResponse.json() as { handoff: { targetRunId: string; status: string }; error?: unknown };
    expect(launchResponse.status, JSON.stringify(launched)).toBe(200);
    expect(launched.handoff.status).toBe("completed");
    expect(launched.handoff.targetRunId).not.toBe(created.runId);

    const source = await db.select().from(runs).where(eq(runs.id, created.runId)).get();
    const target = await db.select().from(runs).where(eq(runs.id, launched.handoff.targetRunId)).get();
    const targetWorker = await db.select().from(workers).where(eq(workers.runId, launched.handoff.targetRunId)).get();
    const sourceWorkers = await db.select().from(workers).where(eq(workers.runId, created.runId));
    expect(source).toMatchObject({ status: "cancelled", activeHandoffId: null });
    expect(target).toMatchObject({ parentRunId: created.runId, originHandoffId: prepared.handoff.id });
    expect(sourceWorkers.map((worker) => worker.type)).toEqual(["codex"]);
    expect(targetWorker?.type).toBe("claude");
    const entries = await readWorkerOutputEntries(launched.handoff.targetRunId, targetWorker!.id);
    expect(entries.filter((entry) => entry.type === "user_input")).toHaveLength(1);
    const targetSeed = entries.find((entry) => entry.type === "user_input")?.text ?? "";
    expect(targetSeed).toContain("# Continuation brief");
    expect(targetSeed).not.toContain('"contentHash"');
    await client.waitFor("handoff.completed", { predicate: (frame) => (frame.payload as { targetRunId?: string } | null)?.targetRunId === launched.handoff.targetRunId, timeoutMs: 10_000 });
  });
});
