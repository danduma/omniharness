import fs from "fs";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitWorkspaceSnapshot, GitWorkspaceTarget } from "@/lib/git-workspace";
import { db } from "@/server/db";
import { executionEvents, messages, plans, workerCounters, workers, runs } from "@/server/db/schema";
import { getProjectGitWorkspaceConfig } from "@/server/projects/config";

const {
  mockCreateAdHocPlan,
  mockCreateBranchWorktree,
  mockStartSupervisorRun,
  mockSpawnAgent,
  mockAskAgent,
  mockGetAgent,
} = vi.hoisted(() => ({
  mockCreateAdHocPlan: vi.fn(),
  mockCreateBranchWorktree: vi.fn(),
  mockStartSupervisorRun: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/runs/ad-hoc-plan", () => ({
  createAdHocPlan: mockCreateAdHocPlan,
  rewriteAdHocPlan: vi.fn(),
}));

vi.mock("@/server/git/workspaces", () => ({
  createBranchWorktree: mockCreateBranchWorktree,
  validateWorkspaceTarget: vi.fn(),
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

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  cancelAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: vi.fn(),
}));

import { createConversation } from "@/server/conversations/create";

async function createProjectPath(name: string) {
  return fs.realpathSync.native(await mkdtemp(path.join(tmpdir(), `omni-orphan-${name}-`)));
}

function buildTarget(projectPath: string, checkoutPath: string): GitWorkspaceTarget {
  return {
    kind: "worktree",
    repoRoot: projectPath,
    gitCommonDir: path.join(projectPath, ".git"),
    checkoutPath,
    branchName: "feature/orphan",
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
      branchName: "feature/orphan",
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

describe("conversation workspace orphan recovery", () => {
  beforeEach(async () => {
    mockCreateAdHocPlan.mockReset();
    mockCreateBranchWorktree.mockReset();
    mockStartSupervisorRun.mockClear();
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("persists pending orphan worktree details when conversation creation fails after git succeeds", async () => {
    const projectPath = await createProjectPath("conversation");
    const checkoutPath = path.join(path.dirname(projectPath), `${path.basename(projectPath)}-feature`);
    const target = buildTarget(projectPath, checkoutPath);
    mockCreateBranchWorktree.mockResolvedValueOnce({
      target,
      snapshot: buildSnapshot(projectPath, checkoutPath),
    });
    mockCreateAdHocPlan.mockImplementationOnce(() => {
      throw new Error("plan write failed");
    });

    await expect(createConversation({
      mode: "direct",
      command: "start isolated work",
      projectPath,
      preferredWorkerType: "codex",
      allowedWorkerTypes: ["codex"],
      gitWorkspaceLaunch: {
        mode: "new_worktree",
        projectPath,
        newBranchName: "feature/orphan",
        checkoutPath,
        expectedHeadSha: "abc123",
        expectedStatusFingerprint: "clean",
      },
    })).rejects.toMatchObject({ code: "pending_orphan_worktree" });

    const config = getProjectGitWorkspaceConfig(projectPath) as {
      pendingOrphanWorktrees?: Array<Record<string, unknown>>;
    };
    expect(config.pendingOrphanWorktrees).toHaveLength(1);
    expect(config.pendingOrphanWorktrees?.[0]).toMatchObject({
      operation: "conversation_launch",
      checkoutPath,
      branchName: "feature/orphan",
      errorMessage: "plan write failed",
    });
  });
});
