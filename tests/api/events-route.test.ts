import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, supervisorInterventions, workerCounters, workers } from "@/server/db/schema";

const { mockEnsureSupervisorRuntimeStarted } = vi.hoisted(() => ({
  mockEnsureSupervisorRuntimeStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: mockEnsureSupervisorRuntimeStarted,
}));

import { GET } from "@/app/api/events/route";

function decodeFirstEvent(chunk: Uint8Array) {
  const text = new TextDecoder().decode(chunk);
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`No SSE data line found in ${text}`);
  }
  return JSON.parse(dataLine.slice("data: ".length));
}

async function readWithTimeout(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out waiting ${timeoutMs}ms for SSE update`)), timeoutMs);
  });

  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

describe("GET /api/events", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    mockEnsureSupervisorRuntimeStarted.mockClear();
    await db.delete(supervisorInterventions);
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("keeps unselected live snapshots free of run-scoped transcript history", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/mobile-budget-unselected.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Mobile payload budget",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: JSON.stringify([{ id: "entry-1", type: "message", text: "x".repeat(50_000), timestamp: now.toISOString() }]),
      currentText: "Live text",
      lastText: "Last text",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "worker",
      kind: "worker_output",
      content: "message body that belongs to the selected conversation only",
      workerId,
      createdAt: now,
    });
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId,
      planItemId: null,
      eventType: "worker_output_changed",
      details: JSON.stringify({ summary: "Worker output changed", raw: "x".repeat(100_000) }),
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest("http://localhost/api/events?snapshot=1"));
    const payload = await response.json();

    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Mobile payload budget");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("working");
    expect(payload.messages).toEqual([]);
    expect(payload.agents).toEqual([]);
    expect(payload.executionEvents).toEqual([]);
    expect(payload.supervisorInterventions).toEqual([]);
  });

  it("bounds selected-run live snapshots to recent compact terminal and event data", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();
    const outputEntries = Array.from({ length: 80 }, (_, index) => ({
      id: `entry-${index}`,
      type: "message",
      text: `${index}: ${"x".repeat(8_000)}`,
      timestamp: new Date(now.getTime() + index).toISOString(),
    }));

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/mobile-budget-selected.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Selected mobile payload budget",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "x".repeat(20_000),
      outputEntriesJson: JSON.stringify(outputEntries),
      currentText: "x".repeat(20_000),
      lastText: "x".repeat(20_000),
      createdAt: now,
      updatedAt: now,
    });

    for (let index = 0; index < 30; index += 1) {
      await db.insert(executionEvents).values({
        id: randomUUID(),
        runId,
        workerId,
        planItemId: null,
        eventType: "worker_prompted",
        details: JSON.stringify({
          summary: `Event ${index}`,
          raw: "x".repeat(10_000),
        }),
        createdAt: new Date(now.getTime() + index * 1000),
      });
    }

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    const text = await response.text();
    const payload = JSON.parse(text);

    expect(Buffer.byteLength(text)).toBeLessThan(150_000);
    expect(payload.agents[0].outputEntries).toHaveLength(24);
    expect(payload.agents[0].outputEntries[0].id).toBe("entry-56");
    expect(payload.agents[0].outputEntries.every((entry: { text: string }) => entry.text.length < 2_100)).toBe(true);
    expect(payload.agents[0].currentText.length).toBeLessThan(4_100);
    expect(payload.executionEvents).toHaveLength(30);
    expect(payload.executionEvents[0].details).toContain("Event 29");
    expect(payload.executionEvents[0].details).not.toContain("xxxxx");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("streams persisted conversation state even when bridge agent polling is unresponsive", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/live-stream.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Start this conversation",
      createdAt: now,
    });

    global.fetch = vi.fn(() => new Promise<Response>(() => {}));

    const controller = new AbortController();
    const response = await GET(new NextRequest(`http://localhost/api/events?runId=${runId}`, {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await readWithTimeout(reader, 600);
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("New conversation");
    expect(payload.messages.find((message: { runId: string }) => message.runId === runId)?.content).toBe("Start this conversation");
  });

  it("returns a JSON live snapshot for polling fallback", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/live-snapshot.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Snapshot conversation",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Start snapshot conversation",
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    expect(response.headers.get("content-type")).toContain("application/json");

    const payload = await response.json();
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Snapshot conversation");
    expect(payload.messages.find((message: { runId: string }) => message.runId === runId)?.content).toBe("Start snapshot conversation");
  });

  it("does not surface transient bridge agent-list failures as frontend errors", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/transient-bridge-list.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Transient bridge list failure",
      createdAt: now,
      updatedAt: now,
    });

    const networkError = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause: networkError }));

    const response = await GET(new NextRequest("http://localhost/api/events?snapshot=1"));
    const payload = await response.json();

    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Transient bridge list failure");
    expect(payload.frontendErrors).toEqual([]);
  });

  it("does not surface timed-out bridge agent-list requests as frontend errors", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/bridge-list-timeout.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Bridge list timeout",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockRejectedValue(new Error("Agent runtime list request timed out after 5000ms."));

    const response = await GET(new NextRequest("http://localhost/api/events?snapshot=1"));
    const payload = await response.json();

    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Bridge list timeout");
    expect(payload.frontendErrors).toEqual([]);
  });

  it("streams run and worker state after conversation session sync", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
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
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "cancelled",
        currentText: "",
        lastText: "Stopped",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ]), { status: 200 }));

    const controller = new AbortController();
    const response = await GET(new NextRequest(`http://localhost/api/events?runId=${runId}`, {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("done");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("cancelled");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(persistedRun?.status).toBe("done");
  });

  it("streams supervisor interventions with the live conversation payload", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/interventions.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(supervisorInterventions).values({
      id: randomUUID(),
      runId,
      workerId,
      interventionType: "continue",
      prompt: "Please continue from the stopping point.",
      summary: "Sent follow-up to worker",
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const controller = new AbortController();
    const response = await GET(new NextRequest(`http://localhost/api/events?runId=${runId}`, {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    expect(payload.supervisorInterventions).toEqual([
      expect.objectContaining({
        runId,
        workerId,
        interventionType: "continue",
        prompt: "Please continue from the stopping point.",
      }),
    ]);
  });

  it("does not rewrite a cancelled direct conversation during session sync", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-cancelled.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "cancelled",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "cancelled",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "working",
        currentText: "late bridge output",
        lastText: "late bridge output",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ]), { status: 200 }));

    const controller = new AbortController();
    const response = await GET(new NextRequest("http://localhost/api/events", {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("cancelled");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("cancelled");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(persistedRun?.status).toBe("cancelled");
    expect(persistedWorker?.status).toBe("cancelled");
    expect(persistedWorker?.currentText).toBe("");
  });

  it("marks a direct conversation done when the worker ends its turn while idle", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-idle.md",
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
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "idle",
        currentText: "",
        lastText: "Fixed and verified.",
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: "Fixed and verified.",
            timestamp: now.toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
      },
    ]), { status: 200 }));

    const controller = new AbortController();
    const response = await GET(new NextRequest("http://localhost/api/events", {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("done");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("idle");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(persistedRun?.status).toBe("done");
  });

  it("marks a direct conversation done when a persisted idle worker has output but no live bridge agent", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-persisted-idle.md",
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
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: JSON.stringify([
        {
          id: "entry-1",
          type: "message",
          text: "Done and waiting for the next prompt.",
          timestamp: now.toISOString(),
        },
      ]),
      currentText: "",
      lastText: "Done and waiting for the next prompt.",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const controller = new AbortController();
    const response = await GET(new NextRequest("http://localhost/api/events", {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("done");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("idle");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(persistedRun?.status).toBe("done");
  });

  it("marks a direct conversation failed when a missing idle worker has no output", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-empty.md",
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
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      bridgeSessionId: null,
      bridgeSessionMode: null,
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const controller = new AbortController();
    const response = await GET(new NextRequest("http://localhost/api/events", {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel();

    const payload = decodeFirstEvent(value!);
    const diagnostic = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("failed");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("error");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(persistedRun?.status).toBe("failed");
    expect(persistedRun?.lastError).toBe(diagnostic);
    expect(persistedWorker?.status).toBe("error");
    expect(persistedWorker?.outputLog).toBe(diagnostic);
    expect(storedMessages.some((message) => message.kind === "error" && message.content.includes(diagnostic))).toBe(true);
  });
});
