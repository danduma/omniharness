import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";

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

import { GET } from "@/app/api/agents/[name]/route";

describe("GET /api/agents/[name]", () => {
  beforeEach(() => {
    mockGetAgent.mockReset();
    mockGetAgentOutput.mockReset();
  });

  it("hydrates archived worker output when full history is requested", async () => {
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
      title: "Archived conversation",
      status: "running",
      preferredWorkerModel: "gpt-5.5",
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
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      bridgeSessionId: "session-123",
      bridgeSessionMode: "full-access",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: process.cwd(),
      state: "working",
      outputEntries: [
        {
          id: "output-archive-marker",
          type: "message",
          text: "40 older raw worker activity records are only in archived history, not in the current terminal output.",
          timestamp: "2026-05-06T15:30:00.000Z",
        },
        {
          id: "live-tail",
          type: "message",
          text: "Current live tail",
          timestamp: "2026-05-06T15:50:00.000Z",
        },
      ],
      currentText: "",
      lastText: "",
      renderedOutput: "",
      stderrBuffer: [],
      stopReason: null,
    });
    mockGetAgentOutput.mockResolvedValue({
      name: workerId,
      cursor: 0,
      nextCursor: null,
      totalEntries: 2,
      entries: [
        {
          id: "archive-between-prompt-1",
          type: "message",
          text: "Output that happened ",
          timestamp: "2026-05-06T15:40:00.000Z",
        },
        {
          id: "archive-between-prompt-2",
          type: "message",
          text: "between supervisor prompts.",
          timestamp: "2026-05-06T15:40:00.100Z",
        },
        {
          id: "archive-later-turn",
          type: "message",
          text: "Later output belongs after the next supervisor prompt.",
          timestamp: "2026-05-06T15:45:00.000Z",
        },
        {
          id: "live-tail",
          type: "message",
          text: "Current live tail",
          timestamp: "2026-05-06T15:50:00.000Z",
        },
      ],
    });

    const response = await GET(new NextRequest(`http://localhost/api/agents/${workerId}?history=full`), {
      params: Promise.resolve({ name: workerId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      name: workerId,
      outputEntries: [
        expect.objectContaining({
          id: "archive-between-prompt-1",
          text: "Output that happened between supervisor prompts.",
        }),
        expect.objectContaining({ id: "archive-later-turn" }),
        expect.objectContaining({ id: "live-tail" }),
      ],
    }));
    expect(mockGetAgentOutput).toHaveBeenCalledWith(workerId, { limit: 20_000 });
  });

  it("keeps archived tool output compact when full history is requested", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `worker-${randomUUID()}`;
    const verboseOutput = [
      "```sh",
      ...Array.from({ length: 20_000 }, (_, index) => `./src/file-${index}.ts:${index}: ${"x".repeat(80)}`),
      "```",
    ].join("\n");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/compact-archive.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Compact archived tool output",
      status: "running",
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
    mockGetAgentOutput.mockResolvedValue({
      name: workerId,
      cursor: 0,
      nextCursor: null,
      totalEntries: 1,
      entries: [
        {
          id: "verbose-tool-update",
          type: "tool_call_update",
          text: `Tool call call_verbose updated: ${verboseOutput}`,
          toolCallId: "call_verbose",
          status: "updated",
          timestamp: "2026-05-06T15:40:00.000Z",
          raw: {
            rawOutput: {
              formatted_output: verboseOutput,
            },
          },
        },
      ],
    });

    const response = await GET(new NextRequest(`http://localhost/api/agents/${workerId}?history=full`), {
      params: Promise.resolve({ name: workerId }),
    });
    const payload = await response.json();
    const [entry] = payload.outputEntries;

    expect(response.status).toBe(200);
    expect(entry.text.length).toBeLessThanOrEqual(2_100);
    expect(entry.text).toContain("Truncated");
    expect(entry.raw.rawOutput.formatted_output.length).toBeLessThanOrEqual(8_100);
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

    const response = await GET(new NextRequest(`http://localhost/api/agents/${workerId}`), {
      params: Promise.resolve({ name: workerId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      name: workerId,
      type: "codex",
      state: "cancelled",
      requestedModel: "openai/gpt-5.4",
      requestedEffort: "high",
      sessionId: "session-123",
      sessionMode: "full-access",
      outputEntries: [
        {
          id: "message-1",
          seq: 1,
          type: "message",
          text: "Finished the task.",
          timestamp: new Date(0).toISOString(),
        },
      ],
      currentText: "",
      lastText: "Finished the task.",
      outputLog: "worker output",
      displayText: "worker output",
      bridgeMissing: true,
      bridgeLastError: "Get agent failed: 404 not_found",
      lastError: null,
    }));
  });
});
