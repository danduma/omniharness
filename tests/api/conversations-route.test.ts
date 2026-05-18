import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { executionEvents, messages, plans, runs, settings, workerCounters, workers } from "@/server/db/schema";
import { AUTO_COMMIT_PROJECT_PROMPT } from "@/lib/conversation-visuals";
import { getAppRoot } from "@/server/app-root";
import type { GitWorkspaceSnapshot, GitWorkspaceTarget } from "@/lib/git-workspace";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

const {
  mockStartSupervisorRun,
  mockQueueConversationTitleGeneration,
  mockEnsureSupervisorRuntimeStarted,
  mockSpawnAgent,
  mockAskAgent,
  mockGetAgent,
  mockNotifyEventStreamSubscribers,
  mockValidateWorkspaceTarget,
  mockCreateBranchWorktree,
} = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
  mockQueueConversationTitleGeneration: vi.fn().mockResolvedValue(undefined),
  mockEnsureSupervisorRuntimeStarted: vi.fn().mockResolvedValue(undefined),
  mockNotifyEventStreamSubscribers: vi.fn(),
  mockValidateWorkspaceTarget: vi.fn(),
  mockCreateBranchWorktree: vi.fn(),
  mockSpawnAgent: vi.fn().mockResolvedValue({
    name: "worker-1",
    type: "codex",
    state: "idle",
    cwd: "/workspace/app",
    lastText: "",
    currentText: "",
    stderrBuffer: [],
    stopReason: null,
  }),
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Acknowledged.",
    state: "working",
  }),
  mockGetAgent: vi.fn().mockResolvedValue({
    name: "worker-1",
    type: "codex",
    state: "working",
    cwd: "/workspace/app",
    lastText: "Acknowledged.",
    currentText: "",
    renderedOutput: "",
    outputEntries: [
      {
        id: "entry-1",
        type: "message",
        text: "Acknowledged.",
        timestamp: new Date(0).toISOString(),
      },
    ],
    stderrBuffer: [],
    stopReason: null,
  }),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

vi.mock("@/server/conversation-title", () => ({
  queueConversationTitleGeneration: mockQueueConversationTitleGeneration,
}));

vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: mockEnsureSupervisorRuntimeStarted,
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: mockNotifyEventStreamSubscribers,
}));

vi.mock("@/server/git/workspaces", () => ({
  validateWorkspaceTarget: mockValidateWorkspaceTarget,
  createBranchWorktree: mockCreateBranchWorktree,
  GitWorkspaceError: class GitWorkspaceError extends Error {
    code: string;
    details: Record<string, unknown>;

    constructor(code: string, message: string, details: Record<string, unknown> = {}) {
      super(message);
      this.name = "GitWorkspaceError";
      this.code = code;
      this.details = details;
    }
  },
}));

import { POST } from "@/app/api/conversations/route";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(read: () => T | Promise<T>, predicate: (value: T) => boolean, timeoutMs = 1_000) {
  const startedAt = Date.now();
  let latest = await read();

  while (!predicate(latest)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for expected state. Last value: ${JSON.stringify(latest)}`);
    }

    await delay(10);
    latest = await read();
  }

  return latest;
}

function buildWorkspaceSnapshot(overrides: Partial<GitWorkspaceSnapshot> = {}): GitWorkspaceSnapshot {
  const branchName = overrides.branchName === undefined ? "feature/test" : overrides.branchName;
  return {
    repoRoot: "/workspace/app",
    gitCommonDir: "/workspace/app/.git",
    checkoutPath: "/workspace/app-feature",
    headSha: "abc1234567890",
    branchName,
    detachedLabel: null,
    isDetached: branchName === null,
    isBare: false,
    dirtyFileCount: 0,
    conflictedFileCount: 0,
    aheadCount: 0,
    behindCount: 0,
    statusFingerprint: "fingerprint",
    worktrees: [],
    branches: [],
    warnings: [],
    refreshedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function buildWorkspaceTarget(overrides: Partial<GitWorkspaceTarget> = {}): GitWorkspaceTarget {
  return {
    kind: "worktree",
    repoRoot: "/workspace/app",
    gitCommonDir: "/workspace/app/.git",
    checkoutPath: "/workspace/app-feature",
    branchName: "feature/test",
    worktreeId: "/workspace/app-feature",
    ...overrides,
  };
}

describe("POST /api/conversations", () => {
  beforeEach(async () => {
    mockStartSupervisorRun.mockClear();
    mockQueueConversationTitleGeneration.mockClear();
    mockEnsureSupervisorRuntimeStarted.mockClear();
    mockSpawnAgent.mockClear();
    mockAskAgent.mockClear();
    mockGetAgent.mockClear();
    mockNotifyEventStreamSubscribers.mockClear();
    mockValidateWorkspaceTarget.mockReset();
    mockCreateBranchWorktree.mockReset();
    __resetOutputStoreCachesForTests();

    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
  });

  it("writes the direct initial prompt before bridge activity emitted during askAgent", async () => {
    const command = "Investigate why the CLI is hiding a new model.";
    mockAskAgent.mockImplementationOnce(async (workerId: string) => {
      const runId = workerId.replace(/-worker-\d+$/, "");
      await writeWorkerOutputEntries(runId, workerId, [
        {
          id: "bridge-during-initial-ask",
          type: "message",
          text: "Checking the CLI model catalog.",
          timestamp: new Date(0).toISOString(),
        },
      ]);
      return {
        response: "Checking the CLI model catalog.",
        state: "idle",
      };
    });
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-1",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      lastText: "Checking the CLI model catalog.",
      currentText: "",
      renderedOutput: "",
      outputEntries: [
        {
          id: "bridge-during-initial-ask",
          type: "message",
          text: "Checking the CLI model catalog.",
          timestamp: new Date(0).toISOString(),
        },
      ],
      stderrBuffer: [],
      stopReason: null,
    });

    const response = await POST(new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command,
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    const workerId = `${payload.runId}-worker-1`;
    const entries = await waitFor(
      () => readWorkerOutputEntries(payload.runId, workerId),
      (items) => items.some((entry) => entry.type === "user_input")
        && items.some((entry) => entry.id === "bridge-during-initial-ask"),
    );

    const userIndex = entries.findIndex((entry) => entry.type === "user_input");
    const bridgeIndex = entries.findIndex((entry) => entry.id === "bridge-during-initial-ask");
    expect(userIndex).toBeGreaterThan(-1);
    expect(bridgeIndex).toBeGreaterThan(-1);
    expect(userIndex).toBe(0);
    expect(userIndex).toBeLessThan(bridgeIndex);
    expect(entries[userIndex]?.text).toBe(command);
  });

  it("pins a new direct conversation to a selected git workspace target", async () => {
    const target = buildWorkspaceTarget();
    const snapshot = buildWorkspaceSnapshot({ warnings: [{ code: "git_lfs", message: "Git LFS filters are configured." }] });
    mockValidateWorkspaceTarget.mockResolvedValueOnce(snapshot);
    mockSpawnAgent.mockImplementationOnce((args: { cwd: string; type: string; name: string }) => Promise.resolve({
      name: args.name,
      type: args.type,
      state: "idle",
      cwd: args.cwd,
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    }));
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-1",
      type: "codex",
      state: "working",
      cwd: target.checkoutPath,
      lastText: "Acknowledged.",
      currentText: "",
      renderedOutput: "",
      outputEntries: [{ id: "entry-1", type: "message", text: "Acknowledged.", timestamp: new Date(0).toISOString() }],
      stderrBuffer: [],
      stopReason: null,
    });

    const response = await POST(new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Run in selected workspace",
        projectPath: "/workspace/app",
        gitWorkspaceTarget: target,
        preferredWorkerType: "codex",
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const createdWorker = await db.select().from(workers).where(eq(workers.runId, payload.runId)).get();
    const workspaceSnapshot = JSON.parse(createdRun?.gitWorkspaceJson ?? "{}");

    expect(mockValidateWorkspaceTarget).toHaveBeenCalledWith(target);
    expect(createdRun?.projectPath).toBe(target.checkoutPath);
    expect(payload.run.projectPath).toBe(target.checkoutPath);
    expect(createdWorker?.cwd).toBe(target.checkoutPath);
    expect(workspaceSnapshot.target).toEqual(target);
    expect(workspaceSnapshot.worktrees).toBeUndefined();
    expect(workspaceSnapshot.branches).toBeUndefined();
    expect(workspaceSnapshot.warnings).toEqual(snapshot.warnings);
  });

  it("creates a branch-backed worktree at submit time and pins the run there", async () => {
    const target = buildWorkspaceTarget({
      checkoutPath: "/workspace/app-new-feature",
      branchName: "feature/new-run",
      worktreeId: "/workspace/app-new-feature",
    });
    const snapshot = buildWorkspaceSnapshot({
      checkoutPath: "/workspace/app",
      branchName: "main",
      headSha: "def1234567890",
      statusFingerprint: "new-fingerprint",
    });
    mockCreateBranchWorktree.mockResolvedValueOnce({
      target,
      snapshot: buildWorkspaceSnapshot({
        checkoutPath: "/workspace/app",
        branchName: "main",
        worktrees: [{
          checkoutPath: target.checkoutPath,
          headSha: "def1234567890",
          branchName: target.branchName,
          detachedLabel: null,
          isCurrent: false,
          isDetached: false,
          isBare: false,
          isPrunable: false,
          dirtyFileCount: 0,
          conflictedFileCount: 0,
        }],
      }),
    });

    const response = await POST(new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "implementation",
        command: "Start isolated implementation",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        allowedWorkerTypes: ["codex"],
        gitWorkspaceLaunch: {
          mode: "new_worktree",
          projectPath: "/workspace/app",
          newBranchName: "feature/new-run",
          checkoutPath: target.checkoutPath,
          expectedHeadSha: snapshot.headSha,
          expectedStatusFingerprint: snapshot.statusFingerprint,
        },
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, payload.runId));
    const workspaceSnapshot = JSON.parse(createdRun?.gitWorkspaceJson ?? "{}");

    expect(mockCreateBranchWorktree).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: "/workspace/app",
      newBranchName: "feature/new-run",
      checkoutPath: target.checkoutPath,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }));
    expect(createdRun?.projectPath).toBe(target.checkoutPath);
    expect(payload.run.projectPath).toBe(target.checkoutPath);
    expect(workspaceSnapshot.target).toEqual(target);
    expect(workspaceSnapshot.worktrees).toBeUndefined();
    expect(workspaceSnapshot.branches).toBeUndefined();
    expect(events.some((event) => event.eventType === "git_workspace_selected")).toBe(true);
  });

  it("starts an implementation conversation and wakes the supervisor", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "implementation",
        command: "Implement docs/superpowers/plans/foo.md",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        allowedWorkerTypes: ["codex"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const run = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(payload.runId).toMatch(/^[0-9a-f]{12}$/);
    expect(run?.mode).toBe("implementation");
    expect(payload.plan).toEqual(expect.objectContaining({
      id: payload.planId,
      path: expect.any(String),
    }));
    expect(payload.run).toEqual(expect.objectContaining({
      id: payload.runId,
      planId: payload.planId,
      mode: "implementation",
      title: "Implement docs/superpowers/plans/foo.md",
    }));
    expect(payload.message).toEqual(expect.objectContaining({
      runId: payload.runId,
      role: "user",
      kind: "checkpoint",
      content: "Implement docs/superpowers/plans/foo.md",
    }));
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(1);
  });

  it("persists and returns a new implementation conversation before supervisor startup completes", async () => {
    mockEnsureSupervisorRuntimeStarted.mockImplementationOnce(() => new Promise(() => {}));
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "implementation",
        command: "Start immediately",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        allowedWorkerTypes: ["codex"],
      }),
    });

    const response = await Promise.race([
      POST(request),
      delay(100).then(() => "timeout" as const),
    ]);

    expect(response).not.toBe("timeout");
    if (response === "timeout") return;

    expect(response.status).toBe(200);
    const payload = await response.json();
    const run = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const message = await db.select().from(messages).where(eq(messages.runId, payload.runId)).get();

    expect(run).toEqual(expect.objectContaining({
      id: payload.runId,
      mode: "implementation",
      projectPath: "/workspace/app",
      title: "Start immediately",
    }));
    expect(message).toEqual(expect.objectContaining({
      role: "user",
      kind: "checkpoint",
      content: "Start immediately",
    }));
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
  });

  it("uses the first prompt line as the temporary conversation title", async () => {
    const command = [
      "Fix the composer send button when attachments are present",
      "",
      "The generated title can replace this later.",
    ].join("\n");
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "implementation",
        command,
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        allowedWorkerTypes: ["codex"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const run = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(payload.run.title).toBe("Fix the composer send button when attachments are present");
    expect(run?.title).toBe("Fix the composer send button when attachments are present");
    expect(mockQueueConversationTitleGeneration).toHaveBeenCalledWith({ runId: payload.runId, command });
  });

  it("stores the app root as the project path when no project is selected", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "implementation",
        command: "Check where this session is running",
        preferredWorkerType: "codex",
        allowedWorkerTypes: ["codex"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const run = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(run?.projectPath).toBe(getAppRoot());
    expect(payload.run.projectPath).toBe(getAppRoot());
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
  });

  it("starts a planning conversation with one direct worker and no supervisor", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "planning",
        command: "Help me write a plan for the conversation modes work",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.4",
        preferredWorkerEffort: "high",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));

    expect(createdRun?.mode).toBe("planning");
    expect(createdRun?.projectPath).toBe("/workspace/app");
    expect(createdWorkers).toHaveLength(1);
    expect(createdWorkers[0]?.cwd).toBe("/workspace/app");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "codex",
      cwd: "/workspace/app",
      model: "gpt-5.4",
      effort: "high",
    }));
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("returns a planning conversation before the first planner turn completes", async () => {
    const resolveAskRef: Array<(value: { response: string; state: string }) => void> = [];
    mockAskAgent.mockImplementationOnce(() => new Promise<{ response: string; state: string }>((resolve) => {
      resolveAskRef[0] = resolve;
    }));
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-1",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      lastText: "Let's shape the plan.",
      currentText: "",
      renderedOutput: "",
      outputEntries: [
        {
          id: "entry-plan",
          type: "message",
          text: "Let's shape the plan.",
          timestamp: new Date(0).toISOString(),
        },
      ],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "planning",
        command: "Help me write a plan for the conversation modes work",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const responsePromise = POST(request);
    let payload!: { runId: string };

    try {
      await expect(Promise.race([
        responsePromise.then(() => "resolved"),
        delay(50).then(() => "pending"),
      ])).resolves.toBe("resolved");

      payload = await (await responsePromise).json();
      const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
      const initialMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

      expect(["starting", "working"]).toContain(createdRun?.status);
      expect(initialMessages.filter((message) => message.role === "worker")).toHaveLength(0);
    } finally {
      resolveAskRef[0]?.({ response: "Let's shape the plan.", state: "idle" });
      await responsePromise.catch(() => null);
    }

    const completedRun = await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "awaiting_user",
    );
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(completedRun?.status).toBe("awaiting_user");
    // Worker response now lives in the unified worker stream (per-worker
    // JSONL), not the `messages` table.
    expect(storedMessages.some((message) => message.role === "worker" && message.content === "Let's shape the plan.")).toBe(false);
  });

  it("does not mark a new planning conversation failed when the first planner turn is already busy", async () => {
    mockAskAgent.mockRejectedValueOnce(new Error("Ask failed: Agent is busy: planner-worker"));

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "planning",
        command: "Help me write a plan for the conversation modes work",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "working",
    );

    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(createdRun?.status).toBe("working");
    expect(createdRun?.lastError).toBeNull();
    expect(createdRun?.failedAt).toBeNull();
    expect(createdWorkers[0]?.status).toBe("working");
    expect(storedMessages.filter((message) => message.kind === "error")).toHaveLength(0);
  });

  it("starts a direct conversation with one direct worker and no supervisor", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Open a direct Codex session in this repo",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.4",
        preferredWorkerEffort: "medium",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(createdRun?.mode).toBe("direct");
    expect(mockSpawnAgent).toHaveBeenCalledTimes(1);
    await waitFor(() => mockAskAgent.mock.calls.length, (count) => count > 0);
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("passes runtime credential settings into direct worker spawns", async () => {
    await db.insert(settings).values([
      {
        key: "OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE",
        value: "/Users/masterman/.local/bin/baton",
        updatedAt: new Date(),
      },
      {
        key: "OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_CLAUDE",
        value: "[\"credential-profile\"]",
        updatedAt: new Date(),
      },
    ]);

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Open a direct Claude session in this repo",
        projectPath: "/workspace/app",
        preferredWorkerType: "claude",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    await waitFor(() => mockSpawnAgent.mock.calls.length, (count) => count > 0);

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "claude",
      cwd: "/workspace/app",
      env: expect.objectContaining({
        OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE: "/Users/masterman/.local/bin/baton",
        OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_CLAUDE: "[\"credential-profile\"]",
      }),
    }));
    await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "done",
    );
  });

  it("returns a direct conversation before worker spawn completes", async () => {
    const resolveSpawnRef: Array<(value: {
      name: string;
      type: string;
      state: string;
      cwd: string;
      lastText: string;
      currentText: string;
      stderrBuffer: never[];
      stopReason: null;
    }) => void> = [];
    mockSpawnAgent.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSpawnRef[0] = resolve;
    }));

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: AUTO_COMMIT_PROJECT_PROMPT,
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const responsePromise = POST(request);

    let payload!: { runId: string };
    try {
      await expect(Promise.race([
        responsePromise.then(() => "resolved"),
        delay(50).then(() => "pending"),
      ])).resolves.toBe("resolved");

      payload = await (await responsePromise).json();
      const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));

      expect(createdWorkers).toHaveLength(1);
      expect(createdWorkers[0]?.status).toBe("starting");
      expect(mockAskAgent).not.toHaveBeenCalled();
    } finally {
      resolveSpawnRef[0]?.({
        name: "worker-1",
        type: "codex",
        state: "idle",
        cwd: "/workspace/app",
        lastText: "",
        currentText: "",
        stderrBuffer: [],
        stopReason: null,
      });
      await responsePromise.catch(() => null);
    }

    await waitFor(
      () => Promise.resolve(mockAskAgent.mock.calls),
      (calls) => calls.length > 0,
    );
  });

  it("returns a direct conversation without waiting for supervisor runtime startup", async () => {
    const resolveStartupRef: Array<() => void> = [];
    mockEnsureSupervisorRuntimeStarted.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveStartupRef[0] = resolve;
    }));

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: AUTO_COMMIT_PROJECT_PROMPT,
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const responsePromise = POST(request);

    try {
      await expect(Promise.race([
        responsePromise.then(() => "resolved"),
        delay(50).then(() => "pending"),
      ])).resolves.toBe("resolved");

      const response = await responsePromise;
      expect(response.status).toBe(200);
      expect(mockEnsureSupervisorRuntimeStarted).not.toHaveBeenCalled();
    } finally {
      resolveStartupRef[0]?.();
      await responsePromise.catch(() => null);
    }
  });

  it("keeps project auto-commit conversations titled Commit", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: AUTO_COMMIT_PROJECT_PROMPT,
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(payload.run.title).toBe("Commit");
    expect(createdRun?.title).toBe("Commit");
    expect(mockQueueConversationTitleGeneration).not.toHaveBeenCalled();
  });

  it("returns a direct conversation before the first worker turn completes", async () => {
    const resolveAskRef: Array<(value: { response: string; state: string }) => void> = [];
    mockAskAgent.mockImplementationOnce(() => new Promise<{ response: string; state: string }>((resolve) => {
      resolveAskRef[0] = resolve;
    }));
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-1",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      lastText: "Ready for the next prompt.",
      currentText: "",
      renderedOutput: "",
      outputEntries: [
        {
          id: "entry-ready",
          type: "message",
          text: "Ready for the next prompt.",
          timestamp: new Date(0).toISOString(),
        },
      ],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Open a direct Codex session in this repo",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const responsePromise = POST(request);

    let payload!: { runId: string };
    try {
      await expect(Promise.race([
        responsePromise.then(() => "resolved"),
        delay(50).then(() => "pending"),
      ])).resolves.toBe("resolved");

      payload = await (await responsePromise).json();
      const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
      const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));
      const initialMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

      expect(createdRun?.status).toBe("running");
      expect(createdWorkers).toHaveLength(1);
      expect(initialMessages.filter((message) => message.role === "worker")).toHaveLength(0);
    } finally {
      resolveAskRef[0]?.({ response: "Ready for the next prompt.", state: "idle" });
      await responsePromise.catch(() => null);
    }

    const completedRun = await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "done",
    );
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(completedRun?.status).toBe("done");
    // Worker response now lives in the unified worker stream.
    expect(storedMessages.some((message) => message.role === "worker" && message.content === "Ready for the next prompt.")).toBe(false);
  });

  it("marks a direct conversation awaiting user input when the initial worker turn asks a blocking question", async () => {
    const workerQuestion = [
      "Before merging, I need to flag something: the working tree has uncommitted changes.",
      "",
      "Should I:",
      "",
      "1. Commit them first, then merge into master?",
      "2. Stash them, merge, then restore?",
      "3. Just merge what's committed?",
      "",
      "Which approach do you want?",
    ].join("\n");
    mockAskAgent.mockResolvedValueOnce({
      response: workerQuestion,
      state: "idle",
    });
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-1",
      type: "claude",
      state: "idle",
      cwd: "/workspace/app",
      lastText: workerQuestion,
      currentText: "",
      renderedOutput: "",
      outputEntries: [
        {
          id: "entry-question",
          type: "message",
          text: workerQuestion,
          timestamp: new Date(0).toISOString(),
        },
      ],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const response = await POST(new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "join this branch into master and then delete it",
        projectPath: "/workspace/app",
        preferredWorkerType: "claude",
      }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    const completedRun = await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "awaiting_user",
    );
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));

    expect(completedRun?.status).toBe("awaiting_user");
    expect(createdWorkers[0]?.status).toBe("idle");
  });

  it("persists direct worker session metadata before the first worker turn completes", async () => {
    const resolveAskRef: Array<(value: { response: string; state: string }) => void> = [];
    mockSpawnAgent.mockResolvedValueOnce({
      name: "worker-session",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-before-ask",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockImplementationOnce(() => new Promise<{ response: string; state: string }>((resolve) => {
      resolveAskRef[0] = resolve;
    }));
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-session",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-before-ask",
      sessionMode: "full-access",
      lastText: "Ready.",
      currentText: "",
      renderedOutput: "",
      outputEntries: [
        {
          id: "entry-ready",
          type: "message",
          text: "Ready.",
          timestamp: new Date(0).toISOString(),
        },
      ],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Open a direct Codex session in this repo",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const payload = await response.json();

    const createdWorker = await waitFor(
      () => db.select().from(workers).where(eq(workers.runId, payload.runId)).get(),
      (worker) => worker?.status === "working",
    );

    try {
      expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
        name: createdWorker?.id,
        mode: "full-access",
      }));
      expect(createdWorker?.bridgeSessionId).toBe("session-before-ask");
      expect(createdWorker?.bridgeSessionMode).toBe("full-access");
    } finally {
      resolveAskRef[0]?.({ response: "Ready.", state: "idle" });
    }

    await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "done",
    );
  });

  it("does not mark a new direct conversation failed when the first worker turn is already busy", async () => {
    mockAskAgent.mockRejectedValueOnce(new Error("Ask failed: Agent is busy: direct-worker"));

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Open a direct Codex session in this repo",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    await waitFor(
      () => db.select().from(workers).where(eq(workers.runId, payload.runId)),
      (createdWorkers) => createdWorkers[0]?.status === "working",
    );

    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(createdRun?.status).toBe("running");
    expect(createdRun?.lastError).toBeNull();
    expect(createdRun?.failedAt).toBeNull();
    expect(createdWorkers[0]?.status).toBe("working");
    expect(storedMessages.filter((message) => message.kind === "error")).toHaveLength(0);
  });

  it("records a visible failure when a direct worker returns no output", async () => {
    mockSpawnAgent.mockResolvedValueOnce({
      name: "worker-empty",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-empty",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      renderedOutput: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: "end_turn",
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "",
      state: "idle",
    });
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-empty",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-empty",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      renderedOutput: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Run the app",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await waitFor(
      () => db.select().from(runs).where(eq(runs.id, payload.runId)).get(),
      (run) => run?.status === "failed",
    );
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(createdRun?.status).toBe("failed");
    expect(createdRun?.lastError).toContain("stopped without producing output");
    expect(createdWorkers[0]?.status).toBe("error");
    expect(createdWorkers[0]?.bridgeSessionId).toBe("session-empty");
    expect(createdWorkers[0]?.outputLog).toContain("stopped without producing output");
    expect(storedMessages.some((message) => message.kind === "error" && message.content.includes("stopped without producing output"))).toBe(true);
  });
  it("starts an attachment-only direct conversation with persisted attachment metadata", async () => {
    const attachment = {
      id: "attachment-1",
      kind: "image",
      name: "screen.png",
      mimeType: "image/png",
      size: 123,
      storagePath: "attachments/upload-1/attachment-1-screen.png",
    };

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        attachments: [attachment],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.message.attachments).toEqual([attachment]);

    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));
    expect(JSON.parse(storedMessages[0]?.attachmentsJson || "[]")).toEqual([attachment]);

    await waitFor(
      () => Promise.resolve(mockAskAgent.mock.calls),
      (calls) => calls.length > 0,
    );
    expect(mockAskAgent.mock.calls[0]?.[1]).toContain("Attached files available to inspect:");
    expect(mockAskAgent.mock.calls[0]?.[1]).toContain("path: attachments/upload-1/attachment-1-screen.png");
  });

});
