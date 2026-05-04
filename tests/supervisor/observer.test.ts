import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, workerCounters, workers } from "@/server/db/schema";

const { mockCancelAgent, mockGetAgent } = vi.hoisted(() => ({
  mockCancelAgent: vi.fn(),
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  getAgent: mockGetAgent,
  cancelAgent: mockCancelAgent,
  approvePermission: vi.fn(),
  spawnAgent: vi.fn(),
}));

import { deriveWorkerEvents, pollRunWorkers } from "@/server/supervisor/observer";
import { approvePermission as mockApprovePermission } from "@/server/bridge-client";
import { spawnAgent as mockSpawnAgent } from "@/server/bridge-client";
import { deriveWorkerTerminalProcesses } from "@/lib/worker-terminal-processes";

describe("deriveWorkerEvents", () => {
  beforeEach(async () => {
    mockGetAgent.mockReset();
    mockCancelAgent.mockReset();
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

  it("does not emit stopped again when a worker remains stopped", () => {
    const stoppedSnapshot = {
      state: "stopped",
      currentText: "done",
      lastText: "done",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: "completed",
    };
    const { events } = deriveWorkerEvents({
      workerId: "run-1-worker-3",
      snapshot: stoppedSnapshot,
      previous: {
        fingerprint: JSON.stringify({
          state: "stopped",
          currentText: "done",
          lastText: "done",
          pendingPermissions: [],
          stopReason: "completed",
          stderrTail: [],
        }),
        lastChangedAt: 1_000,
        lastMeaningfulActivityAt: 1_000,
        progressSignature: JSON.stringify({
          state: "stopped",
          currentText: "done",
          lastText: "done",
          pendingPermissions: [],
          stopReason: "completed",
        }),
        idleNotified: false,
        stuckNotified: false,
      },
      now: 6_000,
    });

    expect(events.some((event) => event.type === "worker_stopped")).toBe(false);
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

  it("fails the run before polling when a worker was launched outside the run project", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const projectPath = "/tmp/omniharness-project";
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
      projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: ".",
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await pollRunWorkers(runId, wakeSupervisor);

    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const mismatchEvent = workerEvents.find((event) => event.eventType === "worker_environment_mismatch");

    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockCancelAgent).toHaveBeenCalledWith(workerId);
    expect(wakeSupervisor).not.toHaveBeenCalled();
    expect(persistedWorker?.status).toBe("error");
    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("Worker launched outside run project directory");
    expect(failedRun?.lastError).toContain(workerId);
    expect(runMessages.some((message) => message.content.includes("Worker launched outside run project directory"))).toBe(true);
    expect(mismatchEvent).toBeTruthy();
    expect(mismatchEvent?.details).toContain(projectPath);
    expect(mismatchEvent?.details).toContain("\"workerCwd\":\".\"");
  });

  it("keeps the run active when bridge status polling hits a retryable transport reset", async () => {
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockRejectedValue(Object.assign(
      new Error("Get agent failed: fetch failed"),
      { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) },
    ));

    await pollRunWorkers(runId, vi.fn());

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(runMessages.some((message) => message.kind === "error")).toBe(false);
    expect(workerEvents.some((event) => event.eventType === "worker_poll_failed")).toBe(true);
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

  it("does not poll a worker row that is still waiting for bridge spawn", async () => {
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
      status: "starting",
      cwd: process.cwd(),
      outputLog: "",
      bridgeSessionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockRejectedValue(new Error("Get agent failed: not_found"));

    await pollRunWorkers(runId, wakeSupervisor);

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(wakeSupervisor).not.toHaveBeenCalled();
    expect(persistedWorker?.status).toBe("starting");
    expect(workerEvents).toEqual([]);
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

  it("does not persist duplicate stuck events from overlapping observer polls", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const wakeSupervisor = vi.fn();
    const snapshot = {
      state: "working",
      currentText: "same output",
      lastText: "same output",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    };

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

    mockGetAgent.mockResolvedValue(snapshot);
    vi.spyOn(Date, "now").mockReturnValue(0);
    await pollRunWorkers(runId, wakeSupervisor);

    let releaseSnapshot!: () => void;
    const snapshotGate = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    mockGetAgent.mockImplementation(async () => {
      await snapshotGate;
      return snapshot;
    });
    vi.spyOn(Date, "now").mockReturnValue(90_000);

    const firstPoll = pollRunWorkers(runId, wakeSupervisor);
    const secondPoll = pollRunWorkers(runId, wakeSupervisor);
    await Promise.resolve();
    releaseSnapshot();
    await Promise.all([firstPoll, secondPoll]);

    const stuckEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));
    expect(stuckEvents.filter((event) => event.eventType === "worker_stuck")).toHaveLength(1);
    expect(wakeSupervisor).toHaveBeenCalledTimes(1);
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

  it("reattaches to an existing agent when duplicate saved-session resume races", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
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
      bridgeSessionId: "session-race",
      bridgeSessionMode: "full-access",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    mockGetAgent
      .mockRejectedValueOnce(new Error("Get agent failed: 404 not_found"))
      .mockResolvedValueOnce({
        name: workerId,
        type: "codex",
        cwd: process.cwd(),
        state: "idle",
        sessionId: "session-race",
        sessionMode: "full-access",
        currentText: "",
        lastText: "",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      });
    vi.mocked(mockSpawnAgent).mockRejectedValue(new Error(`Spawn failed: Agent already exists: ${workerId}`));

    await pollRunWorkers(runId, wakeSupervisor);

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(persistedWorker?.status).toBe("idle");
    expect(workerEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_resume_failed")).toBe(false);
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

  it("does not persist duplicate missing-session events from overlapping observer polls", async () => {
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

    let releasePoll!: () => void;
    const pollGate = new Promise<void>((resolve) => {
      releasePoll = resolve;
    });
    mockGetAgent.mockImplementation(async () => {
      await pollGate;
      throw new Error("Get agent failed: 404 not_found");
    });
    vi.mocked(mockSpawnAgent).mockRejectedValue(new Error("Spawn agent failed: not_found"));
    vi.spyOn(Date, "now").mockReturnValue(100_000);

    const firstPoll = pollRunWorkers(runId, wakeSupervisor);
    const secondPoll = pollRunWorkers(runId, wakeSupervisor);
    await Promise.resolve();
    releasePoll();
    await Promise.all([firstPoll, secondPoll]);

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));

    expect(persistedWorker?.status).toBe("cancelled");
    expect(workerEvents.filter((event) => event.eventType === "worker_session_missing")).toHaveLength(1);
    expect(wakeSupervisor).toHaveBeenCalledTimes(1);
  });

  it("treats ACP session-not-found resume failures as missing saved sessions", async () => {
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
    vi.mocked(mockSpawnAgent).mockRejectedValue(
      new Error('Spawn failed: failed to start codex agent via codex-acp: {"code":-32602,"message":"Invalid params","data":"session not found"}'),
    );

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
          status: "in_progress",
          raw: {
            kind: "execute",
            rawInput: {
              command: "pnpm test tests/api/agent-route.test.ts",
            },
          },
        },
        {
          id: "tool-1-update",
          type: "tool_call_update",
          text: "Tool call tool-1 completed",
          timestamp: new Date(1).toISOString(),
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            rawOutput: {
              formatted_output: "PASS tests/api/agent-route.test.ts\n",
            },
          },
        },
      ],
      stderrBuffer: [],
      stopReason: null,
    });

    await pollRunWorkers(runId, vi.fn());

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(persistedWorker?.currentText).toBe("Wrapping up verification");
    expect(persistedWorker?.lastText).toBe("Ran the focused test suite");
    const persistedOutputEntries = JSON.parse(persistedWorker?.outputEntriesJson ?? "[]");
    expect(persistedOutputEntries).toEqual([
      expect.objectContaining({
        id: "tool-1",
        type: "tool_call",
        status: "in_progress",
        raw: expect.objectContaining({
          rawInput: { command: "pnpm test tests/api/agent-route.test.ts" },
        }),
      }),
      expect.objectContaining({
        id: "tool-1-update",
        type: "tool_call_update",
        status: "completed",
      }),
    ]);
    expect(deriveWorkerTerminalProcesses(persistedOutputEntries)[0]).toMatchObject({
      command: "pnpm test tests/api/agent-route.test.ts",
      status: "completed",
      outputTail: "PASS tests/api/agent-route.test.ts",
    });
  });
});
