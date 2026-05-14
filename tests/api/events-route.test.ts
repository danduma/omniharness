import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, recoveryIncidents, runs, supervisorInterventions, workerCounters, workers } from "@/server/db/schema";
import { buildAgentOutputActivity } from "@/lib/agent-output";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

const { mockEnsureSupervisorRuntimeStarted, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockEnsureSupervisorRuntimeStarted: vi.fn().mockResolvedValue(undefined),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: mockEnsureSupervisorRuntimeStarted,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
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
    notifyEventStreamSubscribers();
    mockEnsureSupervisorRuntimeStarted.mockClear();
    mockStartSupervisorRun.mockClear();
    global.fetch = originalFetch;
    await db.delete(recoveryIncidents);
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

  it("omits archived conversations from event snapshots", async () => {
    const visiblePlanId = randomUUID();
    const archivedPlanId = randomUUID();
    const visibleRunId = randomUUID();
    const archivedRunId = randomUUID();
    const visibleWorkerId = randomUUID();
    const archivedWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values([
      {
        id: visiblePlanId,
        path: "vibes/ad-hoc/visible-conversation.md",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: archivedPlanId,
        path: "vibes/ad-hoc/archived-conversation.md",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(runs).values([
      {
        id: visibleRunId,
        planId: visiblePlanId,
        status: "done",
        title: "Visible conversation",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: archivedRunId,
        planId: archivedPlanId,
        status: "done",
        title: "Archived conversation",
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(workers).values([
      {
        id: visibleWorkerId,
        runId: visibleRunId,
        type: "codex",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: archivedWorkerId,
        runId: archivedRunId,
        type: "codex",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "archived output should not be scanned",
        outputEntriesJson: JSON.stringify([{ id: "archived-entry", type: "message", text: "x".repeat(50_000), timestamp: now.toISOString() }]),
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest("http://localhost/api/events?snapshot=1"));
    const payload = await response.json();

    expect(payload.runs.map((run: { id: string }) => run.id)).toContain(visibleRunId);
    expect(payload.runs.map((run: { id: string }) => run.id)).not.toContain(archivedRunId);
    expect(payload.workers.map((worker: { id: string }) => worker.id)).toContain(visibleWorkerId);
    expect(payload.workers.map((worker: { id: string }) => worker.id)).not.toContain(archivedWorkerId);
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
    expect(payload.agents[0].outputEntries).toHaveLength(31);
    expect(payload.agents[0].outputEntries[0].id).toBe("entry-0");
    expect(payload.agents[0].outputEntries[6].text).toContain("50 earlier output entries omitted");
    expect(payload.agents[0].outputEntries[7].id).toBe("entry-56");
    expect(payload.agents[0].outputEntries.at(-1).id).toBe("entry-79");
    expect(payload.agents[0].outputEntries.every((entry: { text: string }) => entry.text.length < 2_100)).toBe(true);
    expect(payload.agents[0].currentText.length).toBeLessThan(4_100);
    expect(payload.executionEvents.length).toBeGreaterThanOrEqual(30);
    const compactedEvent = payload.executionEvents.find((event: { details: string }) => event.details.includes("Event 29"));
    expect(compactedEvent?.details).toContain("Event 29");
    expect(compactedEvent?.details).not.toContain("xxxxx");
  });

  it("keeps selected-run snapshots from scanning unrelated heavy event history", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/events/route.ts"), "utf8");

    expect(source).not.toContain("db.select().from(executionEvents).orderBy(desc(executionEvents.createdAt))");
    expect(source).not.toContain("db.select().from(messages).orderBy(messages.createdAt)");
  });

  it("serves persisted snapshots from sqlite without waiting for supervisor startup or bridge fetches", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/instant-persisted-snapshot.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Instant persisted snapshot",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "Persisted worker output",
      outputEntriesJson: JSON.stringify([{
        id: "entry-persisted",
        type: "message",
        text: "Disk-backed worker entry",
        timestamp: now.toISOString(),
      }]),
      currentText: "",
      lastText: "Persisted last text",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockRejectedValue(new Error("bridge should not be called"));
    const ensureCallsBefore = mockEnsureSupervisorRuntimeStarted.mock.calls.length;

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${runId}`));
    const payload = await response.json();

    expect(mockEnsureSupervisorRuntimeStarted).toHaveBeenCalledTimes(ensureCallsBefore);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(payload.agents[0]).toEqual(expect.objectContaining({
      name: workerId,
      outputLog: "Persisted worker output",
      lastText: "Persisted last text",
      bridgeMissing: true,
    }));
    expect(payload.agents[0].outputEntries).toEqual([
      expect.objectContaining({ id: "entry-persisted", text: "Disk-backed worker entry" }),
    ]);
  });

  it("includes the parent planning transcript when viewing a promoted implementation run", async () => {
    const planningPlanId = randomUUID();
    const implementationPlanId = randomUUID();
    const planningRunId = randomUUID();
    const implementationRunId = randomUUID();
    const now = new Date("2026-05-11T05:52:18.000Z");

    await db.insert(plans).values([
      {
        id: planningPlanId,
        path: "vibes/ad-hoc/planning-session.md",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: implementationPlanId,
        path: "docs/superpowers/plans/intermediate-scene-assets.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(runs).values([
      {
        id: planningRunId,
        planId: planningPlanId,
        mode: "planning",
        status: "promoted",
        title: "Intermediate Asset Scene Search",
        createdAt: new Date(now.getTime() - 60_000),
        updatedAt: now,
      },
      {
        id: implementationRunId,
        planId: implementationPlanId,
        mode: "implementation",
        status: "running",
        title: "Intermediate Asset Scene Search",
        parentRunId: planningRunId,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(messages).values([
      {
        id: "planning-user-message",
        runId: planningRunId,
        role: "user",
        kind: "checkpoint",
        content: "Plan the intermediate scene assets section.",
        createdAt: new Date(now.getTime() - 50_000),
      },
      {
        id: "planning-worker-message",
        runId: planningRunId,
        role: "worker",
        kind: "planning",
        content: "Created the spec and implementation plan.",
        createdAt: new Date(now.getTime() - 40_000),
      },
      {
        id: "implementation-user-message",
        runId: implementationRunId,
        role: "user",
        kind: "checkpoint",
        content: "Plan the intermediate scene assets section.",
        createdAt: now,
      },
    ]);

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${implementationRunId}`));
    const payload = await response.json();

    expect(payload.messages.map((message: { id: string }) => message.id)).toEqual([
      "planning-user-message",
      "planning-worker-message",
      "implementation-user-message",
    ]);
  });

  it("streams a persisted sqlite update when runtime enrichment misses the grace window", async () => {
    vi.useFakeTimers();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/instant-sse-persisted-output.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Instant SSE persisted output",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "SSE disk output",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn(() => new Promise<Response>(() => {}));

    const controller = new AbortController();
    const response = await GET(new NextRequest(`http://localhost/api/events?runId=${runId}`, {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();
    const readPromise = readWithTimeout(reader, 1000);

    await vi.advanceTimersByTimeAsync(151);
    const result = await readPromise;
    controller.abort();
    reader.releaseLock();
    vi.useRealTimers();

    expect(result.done).toBe(false);
    const payload = decodeFirstEvent(result.value!);
    expect(payload.agents[0]).toEqual(expect.objectContaining({
      name: workerId,
      outputLog: "SSE disk output",
      bridgeMissing: true,
    }));
  });

  it("keeps completed terminal lifecycle entries in compact selected-run snapshots", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();
    const outputEntries = Array.from({ length: 90 }, (_, index) => ({
      id: `entry-${index}`,
      type: "message",
      text: `message ${index}`,
      timestamp: new Date(now.getTime() + index * 1000).toISOString(),
    }));

    outputEntries[18] = {
      id: "terminal-start",
      type: "tool_call",
      text: "flutter analyze",
      timestamp: new Date(now.getTime() + 18_000).toISOString(),
      toolCallId: "call-terminal",
      toolKind: "execute",
      status: "in_progress",
      raw: {
        kind: "execute",
        rawInput: {
          command: ["/bin/zsh", "-lc", "flutter analyze"],
        },
      },
    } as typeof outputEntries[number];
    outputEntries[47] = {
      id: "terminal-done",
      type: "tool_call_update",
      text: "Tool call call-terminal completed",
      timestamp: new Date(now.getTime() + 47_000).toISOString(),
      toolCallId: "call-terminal",
      status: "completed",
      raw: {
        status: "completed",
        rawOutput: {
          command: ["/bin/zsh", "-lc", "flutter analyze"],
          formatted_output: "No issues found!\n",
          exit_code: 0,
          status: "completed",
        },
      },
    } as typeof outputEntries[number];

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/terminal-lifecycle.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Terminal lifecycle",
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
      outputEntriesJson: JSON.stringify(outputEntries),
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    const payload = await response.json();
    const outputEntryIds = payload.agents[0].outputEntries.map((entry: { id: string }) => entry.id);

    expect(outputEntryIds).toContain("terminal-start");
    expect(outputEntryIds).toContain("terminal-done");
    expect(payload.agents[0].outputEntries.find((entry: { id: string }) => entry.id === "terminal-done")).toMatchObject({
      status: "completed",
      toolCallId: "call-terminal",
    });
    expect(payload.agents[0].outputEntries.find((entry: { id: string }) => entry.id.startsWith("output-entries-omitted:"))?.text).toContain("58 earlier output entries omitted");
  });

  it("keeps completed non-terminal tool updates in compact selected-run snapshots", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();
    const outputEntries = Array.from({ length: 90 }, (_, index) => ({
      id: `entry-${index}`,
      type: "message",
      text: `message ${index}`,
      timestamp: new Date(now.getTime() + index * 1000).toISOString(),
    }));

    outputEntries[18] = {
      id: "edit-start",
      type: "tool_call",
      text: "Edit /workspace/app/script/mobile/verify-android-native-libs.sh",
      timestamp: new Date(now.getTime() + 18_000).toISOString(),
      toolCallId: "call-edit",
      toolKind: "edit",
      status: "in_progress",
      raw: {
        kind: "edit",
        title: "Edit /workspace/app/script/mobile/verify-android-native-libs.sh",
      },
    } as typeof outputEntries[number];
    outputEntries[47] = {
      id: "edit-done",
      type: "tool_call_update",
      text: "Tool call call-edit completed",
      timestamp: new Date(now.getTime() + 47_000).toISOString(),
      toolCallId: "call-edit",
      status: "completed",
      raw: {
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "Success. Updated the file." } }],
      },
    } as typeof outputEntries[number];

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/edit-lifecycle.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Edit lifecycle",
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
      outputEntriesJson: JSON.stringify(outputEntries),
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    const payload = await response.json();
    const activities = buildAgentOutputActivity({
      outputEntries: payload.agents[0].outputEntries,
      currentText: "",
      lastText: "",
      displayText: "",
    });
    const editActivity = activities.find((activity) => activity.kind === "tool" && activity.id === "call-edit");

    expect(payload.agents[0].outputEntries.map((entry: { id: string }) => entry.id)).toContain("edit-done");
    expect(editActivity).toMatchObject({
      kind: "tool",
      label: "Edit",
      status: "completed",
      title: "verify-android-native-libs.sh",
    });
  });

  it("keeps compact raw tool payloads so selected-run terminal tool rows can expand", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();
    const outputEntries = [
      {
        id: "edit-start",
        type: "tool_call",
        text: "Edit /workspace/app/rust/xtask/Cargo.toml",
        timestamp: now.toISOString(),
        toolCallId: "call-edit",
        status: "in_progress",
        raw: {
          title: "Edit /workspace/app/rust/xtask/Cargo.toml",
          kind: "edit",
          rawInput: {
            changes: {
              "/workspace/app/rust/xtask/Cargo.toml": {
                type: "update",
                unified_diff: "@@ -1 +1\n-old\n+new\n",
              },
            },
          },
        },
      },
      {
        id: "edit-done",
        type: "tool_call_update",
        text: "Tool call call-edit completed",
        timestamp: new Date(now.getTime() + 1000).toISOString(),
        toolCallId: "call-edit",
        status: "completed",
        raw: {
          rawOutput: {
            stdout: "Success. Updated the following files:\nM rust/xtask/Cargo.toml\n",
            stderr: "",
            success: true,
            debugBlobA: "x".repeat(100_000),
            debugBlobB: "x".repeat(100_000),
            debugBlobC: "x".repeat(100_000),
            debugBlobD: "x".repeat(100_000),
            changes: {
              "/workspace/app/rust/xtask/Cargo.toml": {
                type: "update",
                unified_diff: "@@ -1 +1\n-old\n+new\n",
              },
            },
          },
        },
      },
    ];

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/raw-tool-payload.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Raw tool payload",
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
      outputEntriesJson: JSON.stringify(outputEntries),
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    const payload = await response.json();
    const editUpdate = payload.agents[0].outputEntries.find((entry: { id: string }) => entry.id === "edit-done");

    expect(editUpdate.raw.rawOutput.truncated).toBe(true);
    expect(editUpdate.raw.rawOutput.changes["/workspace/app/rust/xtask/Cargo.toml"].unified_diff).toContain("+new");

    const activities = buildAgentOutputActivity({
      outputEntries: payload.agents[0].outputEntries,
      currentText: "",
      lastText: "",
      displayText: "",
    });
    const editActivity = activities.find((activity) => activity.kind === "tool" && activity.id === "call-edit");
    expect(editActivity).toMatchObject({
      kind: "tool",
      label: "Edit",
      outputPane: expect.objectContaining({
        label: "DIFF",
        kind: "diff",
        text: expect.stringContaining("-old\n+new"),
      }),
    });
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

  it("keeps idle SSE refreshes as heartbeats without rebuilding runtime snapshots", async () => {
    vi.useFakeTimers();
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/cheap-idle-sse.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Cheap idle SSE",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn(() => new Promise<Response>(() => {}));

    const controller = new AbortController();
    const response = await GET(new NextRequest(`http://localhost/api/events?runId=${runId}`, {
      signal: controller.signal,
    }));
    const reader = response.body!.getReader();

    const firstRead = readWithTimeout(reader, 1000);
    await vi.advanceTimersByTimeAsync(151);
    const firstResult = await firstRead;
    expect(firstResult.done).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const heartbeatRead = reader.read();
    await vi.advanceTimersByTimeAsync(15_000);
    const heartbeatResult = await heartbeatRead;
    controller.abort();
    await reader.cancel();
    vi.useRealTimers();

    expect(new TextDecoder().decode(heartbeatResult.value!)).toBe(": heartbeat\n\n");
    expect(global.fetch).toHaveBeenCalledTimes(1);
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

  it("returns a persisted-only JSON snapshot without polling the agent runtime", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/persisted-live-snapshot.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Persisted snapshot conversation",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Recover from persisted state",
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response("runtime should not be called", { status: 530 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${runId}`));
    const payload = await response.json();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(payload.frontendErrors).toEqual([]);
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Persisted snapshot conversation");
    expect(payload.messages.find((message: { runId: string }) => message.runId === runId)?.content).toBe("Recover from persisted state");
  });

  it("reuses cached persisted snapshots until a live update notification arrives", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/cached-persisted-snapshot.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Cached title before notification",
      createdAt: now,
      updatedAt: now,
    });

    const firstResponse = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${runId}`));
    const firstPayload = await firstResponse.json();

    await db.update(runs).set({
      title: "Updated title after cache",
      updatedAt: new Date(now.getTime() + 1000),
    }).where(eq(runs.id, runId));

    const cachedResponse = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${runId}`));
    const cachedPayload = await cachedResponse.json();

    notifyEventStreamSubscribers();

    const invalidatedResponse = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&persisted=1&runId=${runId}`));
    const invalidatedPayload = await invalidatedResponse.json();

    expect(firstPayload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Cached title before notification");
    expect(cachedPayload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Cached title before notification");
    expect(invalidatedPayload.runs.find((run: { id: string }) => run.id === runId)?.title).toBe("Updated title after cache");
  });

  it("reuses cached runtime snapshots without repeated bridge polling", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/cached-runtime-snapshot.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Cached runtime snapshot",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    notifyEventStreamSubscribers();
    await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    expect(global.fetch).toHaveBeenCalledTimes(2);
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

  it("revives a running implementation worker row when the bridge still has an active worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/implementation.md",
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
      status: "cancelled",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      bridgeSessionId: "session-live",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "working",
        sessionId: "session-live",
        sessionMode: "full-access",
        currentText: "still doing real work",
        lastText: "still doing real work",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?runId=${runId}&snapshot=1`));
    const payload = await response.json();

    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("working");
    expect(payload.agents.find((agent: { name: string }) => agent.name === workerId)?.state).toBe("working");

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(persistedWorker?.status).toBe("working");
    expect(persistedWorker?.currentText).toBe("still doing real work");
  });

  it("scopes bridge session sync to the selected run when viewing one conversation", async () => {
    const selectedPlanId = randomUUID();
    const unrelatedPlanId = randomUUID();
    const selectedRunId = randomUUID();
    const unrelatedRunId = randomUUID();
    const selectedWorkerId = randomUUID();
    const unrelatedWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values([
      {
        id: selectedPlanId,
        path: "vibes/ad-hoc/selected-sync-scope.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: unrelatedPlanId,
        path: "vibes/ad-hoc/unrelated-sync-scope.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(runs).values([
      {
        id: selectedRunId,
        planId: selectedPlanId,
        mode: "implementation",
        status: "running",
        title: "Selected sync scope",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: unrelatedRunId,
        planId: unrelatedPlanId,
        mode: "implementation",
        status: "running",
        title: "Unrelated sync scope",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(workers).values([
      {
        id: selectedWorkerId,
        runId: selectedRunId,
        type: "codex",
        status: "cancelled",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: unrelatedWorkerId,
        runId: unrelatedRunId,
        type: "codex",
        status: "cancelled",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: selectedWorkerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "working",
        currentText: "selected live work",
        lastText: "selected live work",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
      {
        name: unrelatedWorkerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "working",
        currentText: "unrelated live work",
        lastText: "unrelated live work",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ]), { status: 200 }));

    await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${selectedRunId}`));

    const selectedWorker = await db.select().from(workers).where(eq(workers.id, selectedWorkerId)).get();
    const unrelatedWorker = await db.select().from(workers).where(eq(workers.id, unrelatedWorkerId)).get();

    expect(selectedWorker?.status).toBe("working");
    expect(selectedWorker?.currentText).toBe("selected live work");
    expect(unrelatedWorker?.status).toBe("cancelled");
    expect(unrelatedWorker?.currentText).toBe("");
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

  it("recovers a direct conversation when an old busy failure is followed by clean worker output", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-busy-recovered.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "failed",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "error",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working.",
      lastText: "Still working.",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "system",
      kind: "error",
      content: `Run failed: Ask failed: Agent is busy: ${workerId}`,
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "idle",
        currentText: "",
        lastText: "Done",
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: "Done",
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
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(persistedRun?.status).toBe("done");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedWorker?.status).toBe("idle");
    expect(persistedMessages.filter((message) => message.kind === "error")).toHaveLength(0);
  });

  it("recovers a planning conversation when an old busy failure is followed by a ready handoff", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "omni-events-planning-ready-"));
    const specPath = path.join(workspace, "docs/superpowers/specs/ready-spec.md");
    const planPath = path.join(workspace, "docs/superpowers/plans/ready-plan.md");

    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(specPath, "# Ready Spec\n");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Implement the thing\n");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/planning-busy-recovered.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      projectPath: workspace,
      status: "failed",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "error",
      cwd: workspace,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still planning.",
      lastText: "Still planning.",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "system",
      kind: "error",
      content: `Run failed: Ask failed: Agent is busy: ${workerId}`,
      createdAt: now,
    });

    const handoff = `<omniharness-plan-handoff>
spec_path: docs/superpowers/specs/ready-spec.md
plan_path: docs/superpowers/plans/ready-plan.md
ready: yes
summary: Plan is ready.
</omniharness-plan-handoff>`;

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: workspace,
        state: "idle",
        currentText: "",
        lastText: handoff,
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: handoff,
            timestamp: now.toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
        lastError: null,
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
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("ready");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("idle");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(persistedRun?.status).toBe("ready");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedRun?.failedAt).toBeNull();
    expect(persistedRun?.artifactPlanPath).toBe(planPath);
    expect(persistedRun?.specPath).toBe(specPath);
    expect(persistedMessages.filter((message) => message.kind === "error")).toHaveLength(0);
  });

  it("recovers an implementation conversation when an old transient supervisor failure is followed by a clean live worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    const errorMessage = "Supervisor model request failed: rate limit exceeded";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/implementation-poll-reset.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "failed",
      lastError: errorMessage,
      failedAt: now,
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
      currentText: "Running validation.",
      lastText: "Running validation.",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "system",
      kind: "error",
      content: `Run failed: ${errorMessage}`,
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "idle",
        currentText: "",
        lastText: "Implemented the feature and ran focused checks.",
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: "Implemented the feature and ran focused checks.",
            timestamp: now.toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
        lastError: null,
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
    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("running");
    expect(payload.workers.find((worker: { id: string }) => worker.id === workerId)?.status).toBe("idle");

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedRun?.failedAt).toBeNull();
    expect(persistedWorker?.status).toBe("idle");
    expect(persistedMessages.filter((message) => message.kind === "error")).toHaveLength(0);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("resumes a failed implementation conversation with a saved bridge session when the live worker must be reloaded", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    const errorMessage = "Get agent failed: fetch failed (caused by: getaddrinfo EAI_AGAIN api.openai.com)";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/implementation-session-reconnect.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "failed",
      lastError: errorMessage,
      failedAt: now,
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
      lastText: "Paused during provider reconnect.",
      bridgeSessionId: "session-reconnect",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "system",
      kind: "error",
      content: `Run failed: ${errorMessage}`,
      createdAt: now,
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    const payload = await response.json();

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(payload.runs.find((run: { id: string }) => run.id === runId)?.status).toBe("running");
    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedRun?.failedAt).toBeNull();
    expect(persistedWorker?.status).toBe("working");
    expect(persistedWorker?.bridgeSessionId).toBe("session-reconnect");
    expect(persistedMessages.filter((message) => message.kind === "error")).toHaveLength(0);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
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

  it("includes planning review records in snapshots", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const reviewRunId = randomUUID();
    const roundId = randomUUID();
    const findingId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/reviewable-plan.md",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      status: "ready",
      title: "Reviewable plan",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(planningReviewRuns).values({
      id: reviewRunId,
      runId,
      status: "completed",
      agentSelection: "auto",
      roundsRequested: 1,
      roundsCompleted: 1,
      startedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(planningReviewRounds).values({
      id: roundId,
      reviewRunId,
      runId,
      roundNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(planningReviewFindings).values({
      id: findingId,
      reviewRunId,
      roundId,
      runId,
      severity: "major",
      category: "testing",
      title: "Missing unit tests",
      details: "The plan should include unit tests for the new module.",
      recommendation: "Add unit tests to the plan.",
      createdAt: now,
    });

    const response = await GET(new NextRequest(`http://localhost/api/events?snapshot=1&runId=${runId}`));
    const payload = await response.json();

    expect(payload.reviewRuns).toHaveLength(1);
    expect(payload.reviewRuns[0].id).toBe(reviewRunId);
    expect(payload.reviewRounds).toHaveLength(1);
    expect(payload.reviewRounds[0].id).toBe(roundId);
    expect(payload.reviewFindings).toHaveLength(1);
    expect(payload.reviewFindings[0].id).toBe(findingId);
    expect(payload.reviewFindings[0].title).toBe("Missing unit tests");
  });
});
