import { execFileSync } from "child_process";
import fs from "fs";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  checkoutExistingBranch,
  createWorktreeForExistingBranch,
  createBranchWorktree,
  getGitWorkspaceSnapshot,
  removeWorktree,
} from "@/server/git/workspaces";

const GIT_WORKSPACE_TEST_TIMEOUT_MS = 30_000;

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createRepo(name: string) {
  const repo = await mkdtemp(path.join(tmpdir(), `omni-git-${name}-`));
  const realRepo = fs.realpathSync.native(repo);
  git(realRepo, ["init"]);
  git(realRepo, ["config", "user.name", "OmniHarness Test"]);
  git(realRepo, ["config", "user.email", "omni@example.test"]);
  await writeFile(path.join(realRepo, "README.md"), "# Test\n", "utf8");
  git(realRepo, ["add", "README.md"]);
  git(realRepo, ["commit", "-m", "initial"]);
  git(realRepo, ["branch", "next"]);
  return realRepo;
}

async function createConflictedRepo(name: string) {
  const repo = await createRepo(name);
  git(repo, ["checkout", "-b", "conflict-side"]);
  await writeFile(path.join(repo, "README.md"), "# Side\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "side"]);
  git(repo, ["checkout", "-"]);
  await writeFile(path.join(repo, "README.md"), "# Main\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "main"]);
  try {
    git(repo, ["merge", "conflict-side"]);
  } catch {
    // Expected: the repository is now in an unmerged conflicted state.
  }
  return repo;
}

describe("git workspace service", () => {
  it("builds snapshots with branch, dirty, detached, and worktree state", async () => {
    const repo = await createRepo("snapshot");
    const clean = await getGitWorkspaceSnapshot(repo);
    const headSha = git(repo, ["rev-parse", "HEAD"]);

    expect(clean.repoRoot).toBe(repo);
    expect(clean.checkoutPath).toBe(repo);
    expect(clean.branchName).toMatch(/^(main|master)$/);
    expect(clean.headSha).toBe(headSha);
    expect(clean.dirtyFileCount).toBe(0);
    expect(clean.conflictedFileCount).toBe(0);
    expect(clean.branches.map((branch) => branch.name)).toContain("next");

    const worktreePath = path.join(path.dirname(repo), `${path.basename(repo)}-next`);
    git(repo, ["worktree", "add", worktreePath, "next"]);
    const withWorktree = await getGitWorkspaceSnapshot(repo);
    expect(withWorktree.worktrees.some((worktree) => worktree.checkoutPath === worktreePath)).toBe(true);

    await writeFile(path.join(repo, "dirty.txt"), "dirty\n", "utf8");
    const dirty = await getGitWorkspaceSnapshot(repo);
    expect(dirty.dirtyFileCount).toBe(1);

    git(repo, ["checkout", "--detach", "HEAD"]);
    const detached = await getGitWorkspaceSnapshot(repo);
    expect(detached.isDetached).toBe(true);
    expect(detached.detachedLabel).toBe(`detached@${headSha.slice(0, 7)}`);
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);

  it("creates a branch-backed worktree without changing the current checkout", async () => {
    const repo = await createRepo("create-worktree");
    const before = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-feature`);

    const result = await createBranchWorktree({
      projectPath: repo,
      newBranchName: "feature/safe-workspace",
      checkoutPath,
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    });

    expect(result.target.checkoutPath).toBe(checkoutPath);
    expect(result.target.branchName).toBe("feature/safe-workspace");
    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(before.branchName);
    expect(git(checkoutPath, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("feature/safe-workspace");
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);

  it("rejects stale confirmations before creating a worktree", async () => {
    const repo = await createRepo("stale-create");
    const before = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-feature`);
    await writeFile(path.join(repo, "late-dirty.txt"), "late dirty\n", "utf8");

    await expect(createBranchWorktree({
      projectPath: repo,
      newBranchName: "feature/stale",
      checkoutPath,
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    })).rejects.toMatchObject({ code: "stale_status" });

    expect(fs.existsSync(checkoutPath)).toBe(false);
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);

  it("blocks dirty branch checkout and preserves HEAD", async () => {
    const repo = await createRepo("dirty-checkout");
    const before = await getGitWorkspaceSnapshot(repo);
    await writeFile(path.join(repo, "dirty.txt"), "dirty\n", "utf8");
    const dirty = await getGitWorkspaceSnapshot(repo);

    await expect(checkoutExistingBranch({
      projectPath: repo,
      branchName: "next",
      expectedHeadSha: dirty.headSha,
      expectedStatusFingerprint: dirty.statusFingerprint,
    })).rejects.toMatchObject({ code: "dirty_checkout" });

    expect(git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(before.branchName);
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);

  it("detects conflicted checkouts and blocks existing-branch worktree creation", async () => {
    const repo = await createConflictedRepo("conflicted-create-existing");
    const conflicted = await getGitWorkspaceSnapshot(repo);
    const checkoutPath = path.join(path.dirname(repo), `${path.basename(repo)}-next`);

    expect(conflicted.conflictedFileCount).toBeGreaterThan(0);

    await expect(createWorktreeForExistingBranch({
      projectPath: repo,
      branchName: "next",
      newBranchName: "next",
      checkoutPath,
      expectedHeadSha: conflicted.headSha,
      expectedStatusFingerprint: conflicted.statusFingerprint,
    })).rejects.toMatchObject({ code: "conflicted_checkout" });

    expect(fs.existsSync(checkoutPath)).toBe(false);
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);

  it("refuses to remove dirty worktrees", async () => {
    const repo = await createRepo("dirty-remove");
    const worktreePath = path.join(path.dirname(repo), `${path.basename(repo)}-next`);
    git(repo, ["worktree", "add", worktreePath, "next"]);
    await writeFile(path.join(worktreePath, "dirty.txt"), "dirty\n", "utf8");
    const before = await getGitWorkspaceSnapshot(repo);

    await expect(removeWorktree({
      projectPath: repo,
      checkoutPath: worktreePath,
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    })).rejects.toMatchObject({ code: "dirty_worktree" });

    expect(fs.existsSync(worktreePath)).toBe(true);
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);

  it("rejects unsafe worktree paths and existing non-empty directories", async () => {
    const repo = await createRepo("path-validation");
    const before = await getGitWorkspaceSnapshot(repo);
    const parent = path.join(path.dirname(repo), "allowed-parent");
    const nonEmpty = path.join(parent, "non-empty");
    fs.mkdirSync(nonEmpty, { recursive: true });
    fs.writeFileSync(path.join(nonEmpty, "file.txt"), "exists\n", "utf8");

    await expect(createBranchWorktree({
      projectPath: repo,
      newBranchName: "feature/escape",
      checkoutPath: path.join(parent, "..", "escaped"),
      worktreeParent: parent,
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    })).rejects.toMatchObject({ code: "worktree_path_outside_parent" });

    await expect(createBranchWorktree({
      projectPath: repo,
      newBranchName: "feature/non-empty",
      checkoutPath: nonEmpty,
      worktreeParent: parent,
      expectedHeadSha: before.headSha,
      expectedStatusFingerprint: before.statusFingerprint,
    })).rejects.toMatchObject({ code: "worktree_path_not_empty" });
  }, GIT_WORKSPACE_TEST_TIMEOUT_MS);
});
