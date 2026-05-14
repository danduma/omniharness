import { randomUUID } from "crypto";
import fs from "fs";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitWorkspaceSnapshot, GitWorkspaceTarget } from "@/lib/git-workspace";
import { db } from "@/server/db";
import { executionEvents, messages, plans, recoveryIncidents, runs, workerCounters, workers } from "@/server/db/schema";
import { getProjectGitWorkspaceConfig } from "@/server/projects/config";

const {
  mockCreateAdHocPlan,
  mockCreateBranchWorktree,
  mockSpawnAgent,
  mockAskAgent,
  mockGetAgent,
  mockCancelAgent,
  mockStartSupervisorRun,
} = vi.hoisted(() => ({
  mockCreateAdHocPlan: vi.fn(),
  mockCreateBranchWorktree: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockCancelAgent: vi.fn().mockResolvedValue(undefined),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/runs/ad-hoc-plan", () => ({
  createAdHocPlan: mockCreateAdHocPlan,
  rewriteAdHocPlan: vi.fn(),
}));

vi.mock("@/server/git/workspaces", () => ({
  createBranchWorktree: mockCreateBranchWorktree,
  GitWorkspaceError: class GitWorkspaceError extends Error {
    readonly code: string;
    readonly details: Record<string, unknown>;

    constructor(code: string, message: string, details: Record<string, unknown> = {}) {
      super(message);
      this.name = "GitWorkspaceError";
      this.code = code;
      this.details = details;
    }
  },
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  cancelAgent: mockCancelAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { recoverRun } from "@/server/runs/recovery";

async function createProjectPath(name: string) {
  return fs.realpathSync.native(await mkdtemp(path.join(tmpdir(), `omni-fork-orphan-${name}-`)));
}

function buildTarget(projectPath: string, checkoutPath: string): GitWorkspaceTarget {
  return {
    kind: "worktree",
    repoRoot: projectPath,
    gitCommonDir: path.join(projectPath, ".git"),
    checkoutPath,
    branchName: "feature/fork-orphan",
    worktreeId: checkoutPath,
  };
}

function buildSnapshot(projectPath: string, checkoutPath: string): GitWorkspaceSnapshot {
  return {
    repoRoot: projectPath,
    gitCommonDir: path.join(projectPath, ".git"),
    checkoutPath: projectPath,
    headSha: "abc123",
    branchName: "main",
    detachedLabel: null,
    isDetached: false,
    isBare: false,
    dirtyFileCount: 0,
    conflictedFileCount: 0,
    aheadCount: 0,
    behindCount: 0,
    statusFingerprint: "clean",
    warnings: [],
    refreshedAt: new Date(0).toISOString(),
    branches: [],
    worktrees: [{
      checkoutPath,
      headSha: "abc123",
      branchName: "feature/fork-orphan",
      detachedLabel: null,
      isCurrent: false,
      isDetached: false,
      isBare: false,
      isPrunable: false,
      dirtyFileCount: 0,
      conflictedFileCount: 0,
    }],
  };
}

describe("run fork workspace orphan recovery", () => {
  beforeEach(async () => {
    mockCreateAdHocPlan.mockReset();
    mockCreateBranchWorktree.mockReset();
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    mockCancelAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(recoveryIncidents);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("persists pending orphan worktree details when fork creation fails after git succeeds", async () => {
    const projectPath = await createProjectPath("run");
    const checkoutPath = path.join(path.dirname(projectPath), `${path.basename(projectPath)}-feature`);
    const planId = randomUUID();
    const runId = randomUUID();
    const targetMessageId = randomUUID();
    const target = buildTarget(projectPath, checkoutPath);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/source.md",
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Source",
      projectPath,
      preferredWorkerType: "codex",
      allowedWorkerTypes: JSON.stringify(["codex"]),
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(messages).values({
      id: targetMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "source prompt",
      createdAt: new Date("2026-05-12T12:00:00Z"),
    });
    mockCreateBranchWorktree.mockResolvedValueOnce({
      target,
      snapshot: buildSnapshot(projectPath, checkoutPath),
    });
    mockCreateAdHocPlan.mockImplementationOnce(() => {
      throw new Error("fork plan write failed");
    });

    await expect(recoverRun({
      runId,
      action: "fork",
      targetMessageId,
      content: "forked prompt",
      gitWorkspaceLaunch: {
        mode: "new_worktree",
        projectPath,
        newBranchName: "feature/fork-orphan",
        checkoutPath,
        expectedHeadSha: "abc123",
        expectedStatusFingerprint: "clean",
      },
    })).rejects.toMatchObject({ code: "pending_orphan_worktree" });

    expect(mockCreateBranchWorktree).toHaveBeenCalled();
    const config = getProjectGitWorkspaceConfig(projectPath) as {
      pendingOrphanWorktrees?: Array<Record<string, unknown>>;
    };
    expect(config.pendingOrphanWorktrees).toHaveLength(1);
    expect(config.pendingOrphanWorktrees?.[0]).toMatchObject({
      operation: "fork_run_worktree",
      sourceRunId: runId,
      targetMessageId,
      checkoutPath,
      branchName: "feature/fork-orphan",
      errorMessage: "fork plan write failed",
    });
  });
});
