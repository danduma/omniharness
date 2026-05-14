import { execFileSync } from "child_process";
import fs from "fs";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getGitWorkspaceSnapshot } from "@/server/git/workspaces";
import { db } from "@/server/db";
import { executionEvents, messages, plans, recoveryIncidents, runs, workerCounters, workers } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import { getProjectGitWorkspaceConfig } from "@/server/projects/config";

const GIT_ROUTE_TEST_TIMEOUT_MS = 30_000;

const {
  mockAskAgent,
  mockCancelAgent,
  mockGetAgent,
  mockSpawnAgent,
  mockStartSupervisorRun,
} = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Forked run started.",
    state: "working",
  }),
  mockCancelAgent: vi.fn().mockResolvedValue(undefined),
  mockGetAgent: vi.fn().mockResolvedValue({
    name: "fork-worker",
    type: "codex",
    state: "working",
    cwd: "/workspace/app",
    sessionId: "session-fork",
    sessionMode: "full-access",
    renderedOutput: "",
    currentText: "",
    lastText: "Forked run started.",
    outputEntries: [{
      id: "entry-fork",
      type: "message",
      text: "Forked run started.",
      timestamp: new Date(0).toISOString(),
    }],
    stderrBuffer: [],
    stopReason: null,
  }),
  mockSpawnAgent: vi.fn().mockResolvedValue({
    name: "fork-worker",
    type: "codex",
    state: "idle",
    cwd: "/workspace/app",
    sessionId: "session-fork",
    sessionMode: "full-access",
    lastText: "",
    currentText: "",
    stderrBuffer: [],
    stopReason: null,
  }),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { POST } from "@/app/api/git/route";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createRepo(name: string) {
  const repo = fs.realpathSync.native(await mkdtemp(path.join(tmpdir(), `omni-api-git-${name}-`)));
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "OmniHarness Test"]);
  git(repo, ["config", "user.email", "omni@example.test"]);
  await writeFile(path.join(repo, "README.md"), "# Test\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "initial"]);
  git(repo, ["branch", "next"]);
  return repo;
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/git", {
    method: "POST",
    headers: {
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/git", () => {
  beforeEach(async () => {
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(recoveryIncidents);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("returns a git workspace status snapshot", async () => {
    const repo = await createRepo("status");
    const response = await POST(request({
      operation: "status",
      projectPath: repo,
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.snapshot.repoRoot).toBe(repo);
    expect(payload.snapshot.branches.map((branch: { name: string }) => branch.name)).toContain("next");
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("rejects stale create-worktree mutations with structured git workspace errors", async () => {
    const repo = await createRepo("stale");
    const before = await getGitWorkspaceSnapshot(repo);
    await writeFile(path.join(repo, "dirty.txt"), "dirty\n", "utf8");

    const response = await POST(request({
      operation: "prepare_session_worktree",
      projectPath: repo,
      newBranchName: "feature/api-stale",
      checkoutPath: path.join(path.dirname(repo), `${path.basename(repo)}-feature`),
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.source).toBe("Git workspace");
    expect(payload.error.action).toBe("Prepare session worktree");
    expect(payload.error.details).toContain("code: stale_status");
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("persists selected workspace targets in project config after validation", async () => {
    const repo = await createRepo("select");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const target = {
      kind: "current_checkout",
      repoRoot: snapshot.repoRoot,
      gitCommonDir: snapshot.gitCommonDir,
      checkoutPath: snapshot.checkoutPath,
      branchName: snapshot.branchName,
      worktreeId: null,
    };

    const response = await POST(request({
      operation: "select",
      projectPath: repo,
      target,
    }));

    expect(response.status).toBe(200);
    expect(getProjectGitWorkspaceConfig(repo).defaultTarget).toEqual(target);
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("blocks dirty checkout mutations through the real API without changing HEAD", async () => {
    const repo = await createRepo("dirty-checkout");
    const before = await getGitWorkspaceSnapshot(repo);
    await writeFile(path.join(repo, "dirty.txt"), "dirty\n", "utf8");
    const dirty = await getGitWorkspaceSnapshot(repo);

    const response = await POST(request({
      operation: "checkout_existing_branch",
      projectPath: repo,
      branchName: "next",
      expectedHeadSha: dirty.headSha,
      expectedStatusFingerprint: dirty.statusFingerprint,
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.details).toContain("code: dirty_checkout");
    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(before.branchName);
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("returns an actionable branch-already-checked-out error without creating a worktree", async () => {
    const repo = await createRepo("checked-out-elsewhere");
    const worktreePath = path.join(path.dirname(repo), `${path.basename(repo)}-next`);
    git(repo, ["worktree", "add", worktreePath, "next"]);
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const duplicatePath = path.join(path.dirname(repo), `${path.basename(repo)}-next-duplicate`);

    const response = await POST(request({
      operation: "create_worktree_existing_branch",
      projectPath: repo,
      branchName: "next",
      checkoutPath: duplicatePath,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.details).toContain("code: branch_checked_out_elsewhere");
    expect(fs.existsSync(duplicatePath)).toBe(false);
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("rejects invalid branch names before creating a worktree path", async () => {
    const repo = await createRepo("invalid-branch");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-bad-branch`);

    const response = await POST(request({
      operation: "prepare_session_worktree",
      projectPath: repo,
      newBranchName: " invalid branch ",
      checkoutPath,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.details).toContain("code: invalid_branch_name");
    expect(fs.existsSync(checkoutPath)).toBe(false);
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("rejects non-empty worktree destinations without modifying branch state", async () => {
    const repo = await createRepo("non-empty-path");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-occupied`);
    fs.mkdirSync(checkoutPath);
    fs.writeFileSync(path.join(checkoutPath, "keep.txt"), "occupied\n", "utf8");

    const response = await POST(request({
      operation: "prepare_session_worktree",
      projectPath: repo,
      newBranchName: "feature/non-empty",
      checkoutPath,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.details).toContain("code: worktree_path_not_empty");
    expect(git(repo, ["branch", "--list", "feature/non-empty"])).toBe("");
    expect(fs.readFileSync(path.join(checkoutPath, "keep.txt"), "utf8")).toBe("occupied\n");
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("rejects worktree paths that escape the configured parent", async () => {
    const repo = await createRepo("outside-parent");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(path.dirname(repo)), `${path.basename(repo)}-outside`);

    const response = await POST(request({
      operation: "prepare_session_worktree",
      projectPath: repo,
      newBranchName: "feature/outside-parent",
      checkoutPath,
      worktreeParent: path.dirname(repo),
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.details).toContain("code: worktree_path_outside_parent");
    expect(fs.existsSync(checkoutPath)).toBe(false);
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("refuses to remove dirty worktrees and leaves files intact", async () => {
    const repo = await createRepo("dirty-remove");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-dirty`);
    git(repo, ["worktree", "add", "-b", "feature/dirty-remove", checkoutPath]);
    await writeFile(path.join(checkoutPath, "dirty.txt"), "dirty\n", "utf8");
    const fresh = await getGitWorkspaceSnapshot(repo);

    const response = await POST(request({
      operation: "remove_worktree",
      projectPath: repo,
      checkoutPath,
      expectedHeadSha: fresh.headSha,
      expectedStatusFingerprint: fresh.statusFingerprint,
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.details).toContain("code: dirty_worktree");
    expect(fs.existsSync(path.join(checkoutPath, "dirty.txt"))).toBe(true);
    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(snapshot.branchName);
  }, GIT_ROUTE_TEST_TIMEOUT_MS);

  it("forks a run into a new branch-backed worktree through the git API", async () => {
    const repo = await createRepo("fork-run-worktree");
    const snapshot = await getGitWorkspaceSnapshot(repo);
    const planId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const planPath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const absolutePlanPath = getAppDataPath(planPath);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-fork`);

    fs.mkdirSync(path.dirname(absolutePlanPath), { recursive: true });
    fs.writeFileSync(absolutePlanPath, "# Source\n", "utf8");
    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Source",
      projectPath: repo,
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "medium",
      allowedWorkerTypes: JSON.stringify(["codex"]),
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "source prompt",
      createdAt: new Date("2026-05-12T12:00:00Z"),
    });

    const response = await POST(request({
      operation: "fork_run_worktree",
      runId,
      targetMessageId: userMessageId,
      contentOverride: "forked API prompt",
      newBranchName: "feature/api-fork",
      checkoutPath,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    const forkedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, payload.runId));
    const runSnapshot = JSON.parse(String(forkedRun?.gitWorkspaceJson ?? "{}"));

    expect(payload.runId).not.toBe(runId);
    expect(payload.target.checkoutPath).toBe(checkoutPath);
    expect(payload.runLaunchSnapshot.target.checkoutPath).toBe(checkoutPath);
    expect(payload.snapshot.worktrees.some((worktree: { checkoutPath: string }) => worktree.checkoutPath === checkoutPath)).toBe(true);
    expect(forkedRun?.parentRunId).toBe(runId);
    expect(forkedRun?.forkedFromMessageId).toBe(userMessageId);
    expect(forkedRun?.projectPath).toBe(checkoutPath);
    expect(runSnapshot.target.checkoutPath).toBe(checkoutPath);
    expect(events.some((event) => event.eventType === "git_workspace_forked")).toBe(true);
    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(snapshot.branchName);
    expect(git(checkoutPath, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("feature/api-fork");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({ cwd: checkoutPath }));
  }, GIT_ROUTE_TEST_TIMEOUT_MS);
});
