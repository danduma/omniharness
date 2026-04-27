import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";

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

describe("GET /api/events", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    mockEnsureSupervisorRuntimeStarted.mockClear();
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
    const response = await GET(new NextRequest("http://localhost/api/events", {
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
