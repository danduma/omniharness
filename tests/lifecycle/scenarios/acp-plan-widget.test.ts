import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents, workers } from "@/server/db/schema";
import { createAgentRuntimeServer } from "@/server/agent-runtime/http";
import { acpPlanStream } from "@/server/agent-runtime/acp/plan-stream";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import {
  eventsRouteModule,
  workerEntriesRoute,
} from "@/../tests/helpers/runtime-routes";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { startSubprocessHarness } from "../harness/subprocess";
import type { WorkerPlanReadResponse } from "@/shared/acp-plan";
import {
  AcpPlanManager,
  selectAcpPlanSurfaceOwner,
} from "@/interface/home/AcpPlanManager";

const fakePlanAgent = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';
let turns = 0;
const sessionId = process.env.FAKE_SESSION_ID || 'session-1';
const initialLabel = process.env.FAKE_INITIAL_LABEL || 'Inspect source';

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function plan(id, entries) {
  write({
    jsonrpc: '2.0',
    method: 'session/update',
    params: { sessionId: id, update: { sessionUpdate: 'plan', entries } },
  });
}

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    } else if (message.method === 'session/new') {
      if (process.env.FAKE_SKIP_STARTUP_PLAN !== '1') {
        plan(sessionId, [{ content: initialLabel, priority: 'high', status: 'in_progress' }]);
      }
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId } });
    } else if (message.method === 'session/resume') {
      if (process.env.FAKE_FAIL_RESUME === '1') {
        write({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'resume unavailable' } });
      } else {
        plan(sessionId, [{ content: initialLabel, priority: 'high', status: 'in_progress' }]);
        write({ jsonrpc: '2.0', id: message.id, result: {} });
      }
    } else if (message.method === 'session/load') {
      plan(sessionId, [{ content: initialLabel, priority: 'high', status: 'in_progress' }]);
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    } else if (message.method === 'session/prompt') {
      turns += 1;
      if (process.env.FAKE_STALE_SESSION_ID) {
        plan(process.env.FAKE_STALE_SESSION_ID, [
          { content: 'Stale plan', priority: 'low', status: 'pending' },
        ]);
      }
      if (turns === 1) {
        plan(sessionId, [
          { content: 'Verify behavior', priority: 'medium', status: 'in_progress' },
          { content: initialLabel, priority: 'high', status: 'completed' },
        ]);
      } else if (turns === 2) {
        plan(sessionId, []);
      } else if (turns === 3) {
        plan(sessionId, [
          { content: initialLabel, priority: 'high', status: 'in_progress' },
        ]);
      } else if (turns === 4) {
        plan(sessionId, [
          { content: 'Alternate step', priority: 'low', status: 'pending' },
        ]);
      } else {
        plan(sessionId, [
          { content: initialLabel, priority: 'high', status: 'in_progress' },
        ]);
      }
      write({ jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } });
    }
  }
});
`;

let harness: LifecycleServer;
let client: LifecycleClient;
let runtimeServer: Server | null = null;
let runtimeBaseUrl = "";
const activeAgentNames = new Set<string>();

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Agent runtime did not bind");
  return `http://127.0.0.1:${address.port}`;
}

async function seedWorker(runId: string, workerId: string) {
  const now = new Date();
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "custom",
    status: "working",
    cwd: harness.omniRoot,
    title: "Plan worker",
    initialPrompt: "",
    createdAt: now,
    updatedAt: now,
  });
}

async function spawnAgent(args: {
  workerId: string;
  executable: string;
  sessionId: string;
  initialLabel: string;
  skipStartupPlan?: boolean;
  staleSessionId?: string;
  resumeSessionId?: string;
  forceLoad?: boolean;
}) {
  const response = await fetch(`${runtimeBaseUrl}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "custom",
      command: args.executable,
      cwd: harness.omniRoot,
      name: args.workerId,
      ...(args.resumeSessionId ? { resumeSessionId: args.resumeSessionId } : {}),
      env: {
        FAKE_SESSION_ID: args.sessionId,
        FAKE_INITIAL_LABEL: args.initialLabel,
        ...(args.skipStartupPlan ? { FAKE_SKIP_STARTUP_PLAN: "1" } : {}),
        ...(args.staleSessionId ? { FAKE_STALE_SESSION_ID: args.staleSessionId } : {}),
        ...(args.forceLoad ? { FAKE_FAIL_RESUME: "1" } : {}),
      },
    }),
  });
  if (response.status !== 201) {
    throw new Error(`Fake ACP plan agent failed to spawn (${response.status}): ${await response.text()}`);
  }
  activeAgentNames.add(args.workerId);
}

async function stopAgent(workerId: string) {
  if (!activeAgentNames.has(workerId)) return;
  await fetch(`${runtimeBaseUrl}/agents/${encodeURIComponent(workerId)}`, { method: "DELETE" });
  activeAgentNames.delete(workerId);
}

async function askAgent(workerId: string) {
  const response = await fetch(`${runtimeBaseUrl}/agents/${encodeURIComponent(workerId)}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "continue" }),
  });
  expect(response.status).toBe(200);
}

async function readPlan(runId: string, workerId: string) {
  const { res, body } = await client.getJson<WorkerPlanReadResponse>(
    `/api/workers/${encodeURIComponent(workerId)}/entries?view=plan&runId=${encodeURIComponent(runId)}`,
  );
  expect(res.status).toBe(200);
  return body;
}

async function waitForPlan(
  runId: string,
  workerId: string,
  predicate: (plan: WorkerPlanReadResponse["plan"]) => boolean,
) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const current = await readPlan(runId, workerId);
    if (predicate(current.plan)) return current;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for plan state for ${workerId}`);
}

async function seedRestartHarnessMetadata(
  root: string,
  runId: string,
  workerIds: readonly string[],
) {
  const restartDb = createClient({ url: `file:${join(root, "sqlite.db")}` });
  const now = Date.now();
  const planId = `${runId}-restart-plan`;
  try {
    await restartDb.execute({
      sql: "INSERT OR IGNORE INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: [planId, `/tmp/${planId}.md`, "pending", now, now],
    });
    await restartDb.execute({
      sql: "INSERT OR IGNORE INTO runs (id, plan_id, mode, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [runId, planId, "direct", "ACP restart lifecycle", "ready", now, now],
    });
    for (const workerId of workerIds) {
      await restartDb.execute({
        sql: "INSERT OR IGNORE INTO workers (id, run_id, type, status, cwd, title, initial_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [workerId, runId, "custom", "working", root, "Plan worker", "", now, now],
      });
    }
  } finally {
    restartDb.close();
  }
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(recoveryIncidents);
  await clearLifecycleSchema();
  harness = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRouteModule },
      { pattern: "/api/workers/:workerId/entries", module: { GET: workerEntriesRoute } },
    ],
  });
  client = new LifecycleClient({ baseUrl: harness.baseUrl, chaos: new Chaos(91, NO_CHAOS) });
  runtimeServer = createAgentRuntimeServer({
    env: {
      ...process.env,
      OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      OMNIHARNESS_WORKER_POOL_SIZE: "0",
      OMNIHARNESS_MIN_DISK_FREE_MB: "1024",
    },
  });
  runtimeBaseUrl = await listen(runtimeServer);
});

afterEach(async () => {
  for (const workerId of [...activeAgentNames]) await stopAgent(workerId);
  await client.close();
  if (runtimeServer) {
    await new Promise<void>((resolve, reject) => runtimeServer!.close((error) => error ? reject(error) : resolve()));
  }
  runtimeServer = null;
  await harness.stop();
  await clearLifecycleSchema();
});

describe("ACP plan widget lifecycle", () => {
  it("derives live replacement, reconnect, reset, restart, stale fencing, and worker isolation from the unified stream", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const secondWorkerId = `${runId}-worker-2`;
    await seedWorker(runId, workerId);
    await seedWorker(runId, secondWorkerId);
    const executable = join(harness.omniRoot, "fake-plan-agent.cjs");
    writeFileSync(executable, fakePlanAgent, "utf8");
    chmodSync(executable, 0o755);

    const bootstrap = await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId, resumeFrom: bootstrap.lastEventId });
    const planManager = new AcpPlanManager();
    planManager.configure(({ runId: requestedRunId, workerId: requestedWorkerId }) => {
      if (!requestedRunId) throw new Error("Plan manager lifecycle read requires a run id");
      return readPlan(requestedRunId, requestedWorkerId);
    });
    planManager.setScope(runId, [workerId], true);
    await vi.waitFor(() => expect(planManager.getState().status).toBe("ready"));

    await spawnAgent({ workerId, executable, sessionId: "session-1", initialLabel: "Inspect source" });
    const boundaryEvent = await client.waitFor("worker.plan_boundary_started", {
      predicate: (frame) => (frame.payload as { workerId?: string }).workerId === workerId,
      timeoutMs: 10_000,
    });
    expect(Object.keys(boundaryEvent.payload as Record<string, unknown>).sort()).toEqual([
      "kind",
      "runId",
      "seq",
      "workerId",
    ]);
    const initialEvent = await client.waitFor("worker.plan_updated", {
      predicate: (frame) => (frame.payload as { workerId?: string }).workerId === workerId,
      timeoutMs: 10_000,
    });
    expect(Object.keys(initialEvent.payload as Record<string, unknown>).sort()).toEqual([
      "kind",
      "runId",
      "seq",
      "workerId",
    ]);
    planManager.onWakeUp({
      runId: String(initialEvent.payload?.runId),
      workerId: String(initialEvent.payload?.workerId),
      seq: Number(initialEvent.payload?.seq),
    });
    await vi.waitFor(() => {
      expect(planManager.getState().scope?.plansByWorkerId[workerId]?.items[0]?.content).toBe("Inspect source");
    });
    expect(selectAcpPlanSurfaceOwner({
      runId,
      workerIds: [workerId],
      primaryWorkerId: workerId,
      eligibleConversationMode: true,
      workerIsTerminal: false,
      planState: planManager.getState(),
    })).toMatchObject({
      ready: true,
      ownsWidget: true,
      suppressAcceptedPlanRows: true,
      plan: { items: [{ content: "Inspect source" }] },
    });
    const initial = await readPlan(runId, workerId);
    expect(initial.plan).toMatchObject({
      acpSessionId: "session-1",
      visible: true,
      items: [{ content: "Inspect source", status: "in_progress" }],
    });

    client.dropSse();
    await askAgent(workerId);
    const replacement = await waitForPlan(
      runId,
      workerId,
      (plan) => plan?.items[0]?.content === "Verify behavior",
    );
    expect(replacement.plan?.items.map((item) => [item.content, item.status])).toEqual([
      ["Verify behavior", "in_progress"],
      ["Inspect source", "completed"],
    ]);
    await client.subscribe({ runId });
    await client.waitFor("worker.plan_updated", {
      predicate: (frame) => Number((frame.payload as { seq?: number }).seq) > Number((initialEvent.payload as { seq?: number }).seq),
      timeoutMs: 10_000,
    });

    acpPlanStream.clear(runId, workerId);
    expect((await readPlan(runId, workerId)).plan?.items[0]?.content).toBe("Verify behavior");

    await stopAgent(workerId);
    await spawnAgent({
      workerId,
      executable,
      sessionId: "session-1",
      initialLabel: "Same session resume",
      resumeSessionId: "session-1",
    });
    const reattached = await readPlan(runId, workerId);
    expect(reattached.plan?.planBoundarySeq).toBe(initial.plan?.planBoundarySeq);
    expect(reattached.plan?.items[0]?.content).toBe("Same session resume");

    await stopAgent(workerId);
    await spawnAgent({
      workerId,
      executable,
      sessionId: "session-1",
      initialLabel: "Same session load",
      resumeSessionId: "session-1",
      forceLoad: true,
    });
    const loaded = await readPlan(runId, workerId);
    expect(loaded.plan?.planBoundarySeq).toBe(initial.plan?.planBoundarySeq);
    expect(loaded.plan?.items[0]?.content).toBe("Same session load");

    await stopAgent(workerId);
    await spawnAgent({
      workerId,
      executable,
      sessionId: "session-2",
      initialLabel: "Session two",
      skipStartupPlan: true,
      staleSessionId: "session-1",
    });
    const reset = await readPlan(runId, workerId);
    expect(reset.plan).toMatchObject({ acpSessionId: "session-2", visible: false, items: [] });
    expect(reset.plan?.planBoundarySeq).toBeGreaterThan(initial.plan?.planBoundarySeq ?? 0);

    await askAgent(workerId);
    const sessionTwo = await waitForPlan(
      runId,
      workerId,
      (plan) => plan?.acpSessionId === "session-2" && plan.items.length === 2,
    );
    expect(sessionTwo.plan?.items.map((item) => item.content)).toEqual(["Verify behavior", "Session two"]);
    const rejected = await client.waitFor("worker.plan_rejected", {
      predicate: (frame) => (frame.payload as { reason?: string }).reason === "stale_session",
      timeoutMs: 10_000,
    });
    expect(rejected.payload).toMatchObject({ workerId, reason: "stale_session", sessionId: "session-1" });

    await askAgent(workerId);
    const emptyPlan = await waitForPlan(
      runId,
      workerId,
      (plan) => plan?.acpSessionId === "session-2" && plan.visible && plan.items.length === 0,
    );
    expect(emptyPlan.plan).toMatchObject({ visible: true, items: [], lastAcceptedEntryId: expect.any(String) });

    await askAgent(workerId);
    const recurrentPlan = await waitForPlan(
      runId,
      workerId,
      (plan) => plan?.acpSessionId === "session-2" && plan.items[0]?.content === "Session two",
    );
    expect(recurrentPlan.plan).toMatchObject({
      visible: true,
      items: [{ content: "Session two", status: "in_progress" }],
    });
    expect(recurrentPlan.plan?.lastEntrySeq).toBeGreaterThan(emptyPlan.plan?.lastEntrySeq ?? 0);

    await askAgent(workerId);
    const alternatePlan = await waitForPlan(
      runId,
      workerId,
      (plan) => plan?.items[0]?.content === "Alternate step",
    );
    await askAgent(workerId);
    const exactRecurrence = await waitForPlan(
      runId,
      workerId,
      (plan) => (
        plan?.items.length === 1
        && plan.items[0]?.content === "Session two"
        && plan.lastEntrySeq > (alternatePlan.plan?.lastEntrySeq ?? 0)
      ),
    );
    expect(exactRecurrence.plan?.items).toEqual(recurrentPlan.plan?.items);
    expect(exactRecurrence.plan?.lastAcceptedEntryId).not.toBe(recurrentPlan.plan?.lastAcceptedEntryId);

    await spawnAgent({
      workerId: secondWorkerId,
      executable,
      sessionId: "session-worker-2",
      initialLabel: "Independent worker",
    });
    expect((await readPlan(runId, secondWorkerId)).plan?.items[0]?.content).toBe("Independent worker");
    expect((await readPlan(runId, workerId)).plan?.acpSessionId).toBe("session-2");

    // Restart a fresh server process against the exact unified stream written
    // through the real ACP callback above. This proves restart recovery is not
    // relying on this test process's plan binding or reducer cache.
    await stopAgent(workerId);
    await stopAgent(secondWorkerId);
    const persistedBeforeRestart = await readPlan(runId, secondWorkerId);
    const restartServer = await startSubprocessHarness({
      omniRoot: harness.omniRoot,
      preserveRoot: true,
    });
    const restartClient = new LifecycleClient({
      baseUrl: () => restartServer.baseUrl,
      chaos: new Chaos(92, NO_CHAOS),
    });
    try {
      // The in-process lifecycle harness imports its shared test DB before it
      // assigns OMNIHARNESS_ROOT. Seed only the child process's run catalog so
      // its cold path can resolve the already-real worker stream in this root.
      await seedRestartHarnessMetadata(
        harness.omniRoot,
        runId,
        [workerId, secondWorkerId],
      );
      const beforeResponse = await restartClient.getJson<WorkerPlanReadResponse>(
        `/api/workers/${encodeURIComponent(secondWorkerId)}/entries?view=plan&runId=${encodeURIComponent(runId)}`,
      );
      expect(beforeResponse.res.status).toBe(200);
      expect(beforeResponse.body).toEqual(persistedBeforeRestart);

      const restartBootstrap = await restartClient.bootstrapSnapshot(runId);
      await restartClient.subscribe({ runId, resumeFrom: restartBootstrap.lastEventId });
      const staleCursor = restartClient.resumeIdNow();
      restartClient.dropSse();
      await restartServer.restart();
      await restartClient.subscribe({ runId, resumeFrom: staleCursor ?? "pre-restart:9999" });
      await restartClient.waitFor("stream.resync_required", {
        predicate: (frame) => frame.payload?.reason === "epoch_mismatch",
        timeoutMs: 10_000,
      });
      const resnapshot = await restartClient.fetch(
        `/api/events?snapshot=1&persisted=1&runId=${encodeURIComponent(runId)}`,
      );
      expect(resnapshot.status).toBe(200);
      const afterResponse = await restartClient.getJson<WorkerPlanReadResponse>(
        `/api/workers/${encodeURIComponent(secondWorkerId)}/entries?view=plan&runId=${encodeURIComponent(runId)}`,
      );
      expect(afterResponse.res.status).toBe(200);
      expect(afterResponse.body).toEqual(persistedBeforeRestart);
      expect(afterResponse.body.plan?.items[0]?.content).toBe("Independent worker");
    } finally {
      await restartClient.close();
      await restartServer.stop();
    }
  }, 60_000);
});
