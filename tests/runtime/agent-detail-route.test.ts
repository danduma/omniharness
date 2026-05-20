import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";

const { mockGetAgent, mockGetAgentOutput } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
  mockGetAgentOutput: vi.fn(),
}));

vi.mock("@/server/bridge-client", async () => {
  const actual = await vi.importActual<typeof import("@/server/bridge-client")>("@/server/bridge-client");
  return {
    ...actual,
    getAgent: mockGetAgent,
    getAgentOutput: mockGetAgentOutput,
  };
});

import { handleAgentDetailRequest } from "@/runtime/http/routes/agent-detail";

describe("portable GET /api/agents/:name", () => {
  beforeEach(() => {
    mockGetAgent.mockReset();
    mockGetAgentOutput.mockReset();
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
      status: "cancelled",
      cwd: process.cwd(),
      outputLog: "worker output",
      outputEntriesJson: JSON.stringify([
        {
          id: "message-1",
          type: "message",
          text: "Finished the task.",
          timestamp: new Date(0).toISOString(),
        },
      ]),
      currentText: "",
      lastText: "Finished the task.",
      bridgeSessionId: "session-123",
      bridgeSessionMode: "full-access",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockRejectedValue(new Error("Get agent failed: 404 not_found"));

    const response = await handleAgentDetailRequest(
      new Request(`http://localhost/api/agents/${workerId}`),
      { surface: "test", params: { name: workerId } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      name: workerId,
      type: "codex",
      state: "cancelled",
      outputEntries: [
        expect.objectContaining({
          id: "message-1",
          seq: 1,
          text: "Finished the task.",
        }),
      ],
      bridgeMissing: true,
      bridgeLastError: "Get agent failed: 404 not_found",
    }));
  });

  it("mounts worker details in the shared runtime registry", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `worker-${randomUUID()}`;

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/registry-worker-detail.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Registry worker detail",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: process.cwd(),
      state: "working",
      outputEntries: [],
      currentText: "",
      lastText: "",
      renderedOutput: "",
      stderrBuffer: [],
      stopReason: null,
    });

    const response = await createOmniRuntimeHttpRegistry().handle(
      new Request(`http://localhost/api/agents/${encodeURIComponent(workerId)}`),
      { surface: "test" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      name: workerId,
      state: "working",
    }));
  });
});
