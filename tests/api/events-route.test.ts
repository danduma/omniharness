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
});
