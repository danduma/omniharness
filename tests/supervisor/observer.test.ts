import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, workerCounters, workers } from "@/server/db/schema";

const { mockGetAgent } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  getAgent: mockGetAgent,
  approvePermission: vi.fn(),
  spawnAgent: vi.fn(),
}));

import { deriveWorkerEvents, pollRunWorkers } from "@/server/supervisor/observer";
import { approvePermission as mockApprovePermission } from "@/server/bridge-client";
import { spawnAgent as mockSpawnAgent } from "@/server/bridge-client";

describe("deriveWorkerEvents", () => {
  beforeEach(async () => {
    mockGetAgent.mockReset();
    vi.mocked(mockApprovePermission).mockReset();
    vi.mocked(mockSpawnAgent).mockReset();
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("records output changes without waking the supervisor immediately", () => {
    const { nextState, events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "running tests",
        lastText: "editing files",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: undefined,
      now: 1_000,
    });

    expect(nextState.idleNotified).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({
        type: "worker_output_changed",
        shouldWakeSupervisor: false,
        updatesActivity: true,
      }),
    ]);
  });

  it("wakes the supervisor when a worker has been idle for thirty seconds", () => {
    const { events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "same output",
        lastText: "same output",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "same output",
          lastText: "same output",
          pendingPermissions: [],
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 0,
        lastMeaningfulActivityAt: 0,
        progressSignature: JSON.stringify({
          state: "working",
          currentText: "same output",
          lastText: "same output",
          pendingPermissions: [],
          stopReason: null,
        }),
        idleNotified: false,
        stuckNotified: false,
      },
      now: 30_000,
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "worker_idle",
        shouldWakeSupervisor: true,
        updatesActivity: false,
      }),
    ]);
  });

  it("wakes the supervisor immediately when a permission request appears", () => {
    const permission = {
      requestId: 12,
      requestedAt: new Date(0).toISOString(),
      options: [
        { optionId: "allow-always", kind: "allow_always", name: "Always Allow" },
      ],
    };

    const { events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "waiting for approval",
        lastText: "waiting for approval",
        pendingPermissions: [permission],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "waiting for approval",
          lastText: "waiting for approval",
          pendingPermissions: [],
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 0,
        lastMeaningfulActivityAt: 0,
        progressSignature: JSON.stringify({
          state: "working",
          currentText: "waiting for approval",
          lastText: "waiting for approval",
          pendingPermissions: [],
          stopReason: null,
        }),
        idleNotified: false,
        stuckNotified: false,
      },
      now: 1_000,
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "worker_permission_requested",
        shouldWakeSupervisor: true,
        updatesActivity: false,
      }),
    ]));
  });

  it("marks a worker stuck after prolonged churn without meaningful progress", () => {
    const { nextState, events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "Let me assess the current implementation details.",
        lastText: "Let me assess the current implementation details..",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "Let me assess the current implementation details",
          lastText: "Let me assess the current implementation details.",
          pendingPermissions: [],
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 85_000,
        lastMeaningfulActivityAt: 0,
        progressSignature: JSON.stringify({
          state: "working",
          currentText: "Let me assess the current implementation details.",
          lastText: "Let me assess the current implementation details..",
          pendingPermissions: [],
          stopReason: null,
        }),
        idleNotified: true,
        stuckNotified: false,
      },
      now: 90_000,
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "worker_stuck",
        shouldWakeSupervisor: true,
        updatesActivity: false,
      }),
    ]));
    expect(nextState.lastMeaningfulActivityAt).toBe(0);
    expect(nextState.stuckNotified).toBe(true);
  });

  it("does not reset activity for noisy snapshot churn with the same normalized progress text", () => {
    const { nextState, events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "Running tests\n\nand reading files",
        lastText: "Running tests and reading files",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "Running tests and reading files",
          lastText: "Running tests and reading files",
          pendingPermissions: [],
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 5_000,
        lastMeaningfulActivityAt: 5_000,
        progressSignature: JSON.stringify({
          state: "working",
          currentText: "Running tests and reading files",
          lastText: "Running tests and reading files",
          pendingPermissions: [],
          stopReason: null,
        }),
        idleNotified: false,
        stuckNotified: false,
      },
      now: 10_000,
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "worker_output_changed",
        updatesActivity: false,
      }),
    ]));
    expect(nextState.lastMeaningfulActivityAt).toBe(5_000);
  });

  it("fails the run when bridge status polling errors", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();

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
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockRejectedValue(new Error("OmniHarness agent runtime is not running at http://127.0.0.1:7800"));

    await pollRunWorkers(runId, vi.fn());

    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("agent runtime is not running");
    expect(runMessages.some((message) => message.content.includes("agent runtime is not running"))).toBe(true);
  });

  it("does not poll workers for a cancelled run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const wakeSupervisor = vi.fn();

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
      status: "cancelled",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockResolvedValue({
      state: "working",
      currentText: "should not be observed",
      lastText: "should not be observed",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });

    await pollRunWorkers(runId, wakeSupervisor);

    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(wakeSupervisor).not.toHaveBeenCalled();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.status).toBe("working");
  });

  it("fails the run when worker stderr reports a fatal bridge pipe error", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();

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
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockResolvedValue({
      state: "working",
      currentText: "sending update",
      lastText: "sending update",
      pendingPermissions: [],
      stderrBuffer: [
        "[bridge] ACP write error: Error: write EPIPE",
      ],
      stopReason: null,
    });

    await pollRunWorkers(runId, vi.fn());

    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("write EPIPE");
    expect(runMessages.some((message) => message.content.includes("write EPIPE"))).toBe(true);
  });

  it("fails the run with a visible error when the worker snapshot is malformed", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();

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
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockResolvedValue({
      state: "working",
      currentText: "sending update",
      lastText: "sending update",
      pendingPermissions: [],
      stopReason: null,
    });

    await pollRunWorkers(runId, vi.fn());

    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("Invalid worker snapshot");
    expect(failedRun?.lastError).toContain("stderrBuffer was missing or not an array");
    expect(runMessages.some((message) => message.content.includes("stderrBuffer was missing or not an array"))).toBe(true);
  });

  it("persists a stuck status and wakes the supervisor when a worker stops making meaningful progress", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const wakeSupervisor = vi.fn();

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
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    mockGetAgent.mockResolvedValue({
      state: "working",
      currentText: "same output",
      lastText: "same output",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });

    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(90_000);

    await pollRunWorkers(runId, wakeSupervisor);
    await pollRunWorkers(runId, wakeSupervisor);

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(persistedWorker?.status).toBe("stuck");
    expect(workerEvents.some((event) => event.eventType === "worker_stuck")).toBe(true);
    expect(wakeSupervisor).toHaveBeenCalledWith(runId, 0);
  });

  it("auto-approves safe pending permission requests using the strongest allow option", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const wakeSupervisor = vi.fn();

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
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    mockGetAgent.mockResolvedValue({
      state: "idle",
      currentText: "waiting for approval",
      lastText: "waiting for approval",
      pendingPermissions: [
        {
          requestId: 1,
          requestedAt: new Date(0).toISOString(),
          options: [
            { optionId: "allow_always", kind: "allow_always", name: "Always Allow" },
            { optionId: "allow", kind: "allow", name: "Allow" },
            { optionId: "reject", kind: "reject", name: "Reject" },
          ],
        },
      ],
      outputEntries: [
        {
          id: "permission-1",
          type: "permission",
          text: "Permission requested: allow_always Always Allow, allow Allow, reject Reject",
          timestamp: new Date(0).toISOString(),
          raw: {
            requestId: 1,
            toolCall: {
              kind: "execute",
              title: 'cat /Users/masterman/NLP/wikinuxt/package.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get(\'jest\', {}), indent=2))"',
              rawInput: {
                command:
                  'cat /Users/masterman/NLP/wikinuxt/package.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get(\'jest\', {}), indent=2))"',
                description: "Extract jest config from package.json",
              },
            },
          },
        },
      ],
      stderrBuffer: [],
      stopReason: null,
    });

    await pollRunWorkers(runId, wakeSupervisor);

    expect(mockApprovePermission).toHaveBeenCalledWith(workerId, "allow_always");

    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));
    expect(workerEvents.some((event) => event.eventType === "worker_permission_auto_approved")).toBe(true);
  });

  it("respawns a missing worker from its saved session instead of failing the run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const wakeSupervisor = vi.fn();

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
      status: "running",
      preferredWorkerModel: "openai/gpt-5.4",
      preferredWorkerEffort: "high",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      bridgeSessionId: "session-123",
      bridgeSessionMode: "full-access",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    mockGetAgent.mockRejectedValue(new Error("Get agent failed: 404 not_found"));
    vi.mocked(mockSpawnAgent).mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-123",
      sessionMode: "full-access",
      currentText: "",
      lastText: "",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });

    await pollRunWorkers(runId, wakeSupervisor);

    expect(mockSpawnAgent).toHaveBeenCalledWith({
      type: "claude",
      cwd: process.cwd(),
      name: workerId,
      mode: "full-access",
      model: "openai/gpt-5.4",
      effort: "high",
      resumeSessionId: "session-123",
    });

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(persistedWorker?.status).toBe("idle");
    expect(workerEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
  });

  it("marks a worker cancelled when its saved bridge session is gone instead of failing the run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const wakeSupervisor = vi.fn();

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
      bridgeSessionId: "session-gone",
      bridgeSessionMode: "full-access",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    mockGetAgent.mockRejectedValue(new Error("Get agent failed: 404 not_found"));
    vi.mocked(mockSpawnAgent).mockRejectedValue(new Error("Spawn agent failed: not_found"));

    await pollRunWorkers(runId, wakeSupervisor);

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedWorker?.status).toBe("cancelled");
    expect(persistedWorker?.bridgeSessionId).toBeNull();
    expect(workerEvents.some((event) => event.eventType === "worker_session_missing")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_resume_failed")).toBe(false);
    expect(wakeSupervisor).toHaveBeenCalledWith(runId, 0);
  });

  it("persists structured terminal snapshots for later inspection", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();

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
      state: "working",
      currentText: "Wrapping up verification",
      lastText: "Ran the focused test suite",
      pendingPermissions: [],
      outputEntries: [
        {
          id: "tool-1",
          type: "tool_call",
          text: "pnpm test tests/api/agent-route.test.ts",
          timestamp: new Date(0).toISOString(),
          toolCallId: "tool-1",
          toolKind: "execute",
          status: "completed",
        },
      ],
      stderrBuffer: [],
      stopReason: null,
    });

    await pollRunWorkers(runId, vi.fn());

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(persistedWorker?.currentText).toBe("Wrapping up verification");
    expect(persistedWorker?.lastText).toBe("Ran the focused test suite");
    await expect(Promise.resolve(JSON.parse(persistedWorker?.outputEntriesJson ?? "[]"))).resolves.toEqual([
      expect.objectContaining({
        id: "tool-1",
        type: "tool_call",
        status: "completed",
      }),
    ]);
  });
});
