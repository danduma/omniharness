import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";

const { mockGetAgent } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  getAgent: mockGetAgent,
}));

import { GET } from "@/app/api/agents/[name]/route";

describe("GET /api/agents/[name]", () => {
  beforeEach(() => {
    mockGetAgent.mockReset();
  });

  it("returns a persisted fallback snapshot when the bridge temporarily loses the worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `worker-${randomUUID()}`;

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Recovered conversation",
      status: "running",
      preferredWorkerModel: "openai/gpt-5.4",
      preferredWorkerEffort: "high",
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "worker output",
      bridgeSessionId: "session-123",
      bridgeSessionMode: "full-access",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockRejectedValue(new Error("Get agent failed: 404 not_found"));

    const response = await GET(new NextRequest(`http://localhost/api/agents/${workerId}`), {
      params: Promise.resolve({ name: workerId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      name: workerId,
      type: "codex",
      state: "starting",
      requestedModel: "openai/gpt-5.4",
      requestedEffort: "high",
      sessionId: "session-123",
      sessionMode: "full-access",
      outputLog: "worker output",
      displayText: "worker output",
      bridgeMissing: true,
      bridgeLastError: "Get agent failed: 404 not_found",
      lastError: null,
    }));
  });
});
