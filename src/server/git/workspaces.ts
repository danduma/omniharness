import fs from "fs";
import path from "path";
import { GitWorkspaceSnapshot, GitWorkspaceTarget } from "@/lib/git-workspace";
import { GitCommandError, runGit } from "@/server/git/command";
import { buildGitWorkspaceSnapshot, discoverRepositoryIdentity } from "@/server/git/status";

export class GitWorkspaceError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "GitWorkspaceError";
    this.code = code;
    this.details = details;
  }
}

export interface StaleGuard {
  expectedHeadSha: string | null;
  expectedStatusFingerprint: string;
}

export interface CreateBranchWorktreeInput extends StaleGuard {
  projectPath: string;
  newBranchName: string;
  checkoutPath: string;
  startPoint?: string;
  worktreeParent?: string;
}

export interface CheckoutExistingBranchInput extends StaleGuard {
  projectPath: string;
  branchName: string;
  allowDirty?: boolean;
}

export interface RemoveWorktreeInput extends StaleGuard {
  projectPath: string;
  checkoutPath: string;
  pruneOnly?: boolean;
}

export interface GitWorkspaceOperationResult {
  target: GitWorkspaceTarget;
  snapshot: GitWorkspaceSnapshot;
}

export async function getGitWorkspaceSnapshot(projectPath: string) {
  return buildGitWorkspaceSnapshot(projectPath);
}

export async function checkoutExistingBranch(input: CheckoutExistingBranchInput): Promise<GitWorkspaceOperationResult> {
  const before = await assertFreshSnapshot(input.projectPath, input);
  if (!input.allowDirty && before.dirtyFileCount > 0) {
    throw new GitWorkspaceError("dirty_checkout", "Dirty checkouts cannot switch branches without explicit approval.", {
      dirtyFileCount: before.dirtyFileCount,
      conflictedFileCount: before.conflictedFileCount,
    });
  }
  if (before.conflictedFileCount > 0) {
    throw new GitWorkspaceError("conflicted_checkout", "Conflicted checkouts cannot switch branches.", {
      conflictedFileCount: before.conflictedFileCount,
    });
  }
  await assertValidBranchName(input.projectPath, input.branchName);
  const branch = before.branches.find((candidate) => !candidate.isRemote && candidate.name === input.branchName);
  if (!branch) {
    throw new GitWorkspaceError("branch_not_found", "Branch does not exist.", { branchName: input.branchName });
  }
  if (branch.checkedOutPath && path.resolve(branch.checkedOutPath) !== path.resolve(before.repoRoot)) {
    throw new GitWorkspaceError("branch_checked_out_elsewhere", "Branch is already checked out in another worktree.", {
      branchName: input.branchName,
      checkoutPath: branch.checkedOutPath,
    });
  }
  await runGit({
    cwd: before.repoRoot,
    args: ["checkout", input.branchName],
  });
  const snapshot = await getGitWorkspaceSnapshot(before.repoRoot);
  return {
    target: snapshotToTarget(snapshot, "current_checkout"),
    snapshot,
  };
}

export async function createBranchWorktree(input: CreateBranchWorktreeInput): Promise<GitWorkspaceOperationResult> {
  const before = await assertFreshSnapshot(input.projectPath, input);
  if (before.conflictedFileCount > 0) {
    throw new GitWorkspaceError("conflicted_checkout", "Conflicted checkouts cannot create worktrees.", {
      conflictedFileCount: before.conflictedFileCount,
    });
  }
  await assertValidBranchName(before.repoRoot, input.newBranchName);
  if (before.branches.some((branch) => !branch.isRemote && branch.name === input.newBranchName)) {
    throw new GitWorkspaceError("branch_already_exists", "Branch already exists.", {
      branchName: input.newBranchName,
    });
  }

  const checkoutPath = validateWorktreePath({
    repoRoot: before.repoRoot,
    checkoutPath: input.checkoutPath,
    worktreeParent: input.worktreeParent,
  });
  await assertFreshSnapshot(before.repoRoot, input);
  assertPathStillAvailable(checkoutPath);

  const args = ["worktree", "add", "-b", input.newBranchName, checkoutPath];
  if (input.startPoint) {
    args.push(input.startPoint);
  }
  try {
    await runGit({ cwd: before.repoRoot, args });
  } catch (error) {
    throw translateWorktreeError(error, input.newBranchName);
  }
  const snapshot = await getGitWorkspaceSnapshot(before.repoRoot);
  const created = snapshot.worktrees.find((worktree) => path.resolve(worktree.checkoutPath) === checkoutPath);
  return {
    target: {
      kind: "worktree",
      repoRoot: snapshot.repoRoot,
      gitCommonDir: snapshot.gitCommonDir,
      checkoutPath,
      branchName: created?.branchName ?? input.newBranchName,
      worktreeId: checkoutPath,
    },
    snapshot,
  };
}

export async function removeWorktree(input: RemoveWorktreeInput): Promise<{ snapshot: GitWorkspaceSnapshot }> {
  const before = await assertFreshSnapshot(input.projectPath, input);
  const checkoutPath = path.resolve(input.checkoutPath);
  const worktree = before.worktrees.find((candidate) => path.resolve(candidate.checkoutPath) === checkoutPath);
  if (!worktree) {
    throw new GitWorkspaceError("worktree_not_found", "Worktree was not found.", { checkoutPath });
  }
  if (path.resolve(before.repoRoot) === checkoutPath) {
    throw new GitWorkspaceError("cannot_remove_current_checkout", "The current checkout cannot be removed as a worktree.", {
      checkoutPath,
    });
  }
  if (input.pruneOnly || worktree.isPrunable || !fs.existsSync(checkoutPath)) {
    await runGit({ cwd: before.repoRoot, args: ["worktree", "prune"] });
    return { snapshot: await getGitWorkspaceSnapshot(before.repoRoot) };
  }
  const worktreeSnapshot = await getGitWorkspaceSnapshot(checkoutPath);
  if (worktreeSnapshot.dirtyFileCount > 0 || worktreeSnapshot.conflictedFileCount > 0) {
    throw new GitWorkspaceError("dirty_worktree", "Dirty worktrees cannot be removed.", {
      checkoutPath,
      dirtyFileCount: worktreeSnapshot.dirtyFileCount,
      conflictedFileCount: worktreeSnapshot.conflictedFileCount,
    });
  }
  await runGit({ cwd: before.repoRoot, args: ["worktree", "remove", checkoutPath] });
  return { snapshot: await getGitWorkspaceSnapshot(before.repoRoot) };
}

export async function createWorktreeForExistingBranch(input: CreateBranchWorktreeInput & { branchName: string }) {
  const before = await assertFreshSnapshot(input.projectPath, input);
  await assertValidBranchName(before.repoRoot, input.branchName);
  const branch = before.branches.find((candidate) => !candidate.isRemote && candidate.name === input.branchName);
  if (!branch) {
    throw new GitWorkspaceError("branch_not_found", "Branch does not exist.", { branchName: input.branchName });
  }
  if (branch.checkedOutPath) {
    throw new GitWorkspaceError("branch_checked_out_elsewhere", "Branch is already checked out in another worktree.", {
      branchName: input.branchName,
      checkoutPath: branch.checkedOutPath,
    });
  }
  const checkoutPath = validateWorktreePath({
    repoRoot: before.repoRoot,
    checkoutPath: input.checkoutPath,
    worktreeParent: input.worktreeParent,
  });
  assertPathStillAvailable(checkoutPath);
  try {
    await runGit({ cwd: before.repoRoot, args: ["worktree", "add", checkoutPath, input.branchName] });
  } catch (error) {
    throw translateWorktreeError(error, input.branchName);
  }
  const snapshot = await getGitWorkspaceSnapshot(before.repoRoot);
  return {
    target: {
      kind: "worktree",
      repoRoot: snapshot.repoRoot,
      gitCommonDir: snapshot.gitCommonDir,
      checkoutPath,
      branchName: input.branchName,
      worktreeId: checkoutPath,
    },
    snapshot,
  } satisfies GitWorkspaceOperationResult;
}

async function assertFreshSnapshot(projectPath: string, guard: StaleGuard) {
  const snapshot = await getGitWorkspaceSnapshot(projectPath);
  if (snapshot.headSha !== guard.expectedHeadSha) {
    throw new GitWorkspaceError("stale_head", "Repository HEAD changed after confirmation.", {
      expectedHeadSha: guard.expectedHeadSha,
      actualHeadSha: snapshot.headSha,
    });
  }
  if (snapshot.statusFingerprint !== guard.expectedStatusFingerprint) {
    throw new GitWorkspaceError("stale_status", "Repository status changed after confirmation.", {
      expectedStatusFingerprint: guard.expectedStatusFingerprint,
      actualStatusFingerprint: snapshot.statusFingerprint,
    });
  }
  return snapshot;
}

async function assertValidBranchName(repoRoot: string, branchName: string) {
  if (!branchName || branchName.trim() !== branchName) {
    throw new GitWorkspaceError("invalid_branch_name", "Branch name is invalid.", { branchName });
  }
  const result = await runGit({
    cwd: repoRoot,
    args: ["check-ref-format", "--branch", branchName],
    allowExitCodes: [0, 1],
  });
  if (result.exitCode !== 0) {
    throw new GitWorkspaceError("invalid_branch_name", "Branch name is invalid.", {
      branchName,
      stderr: result.stderr,
    });
  }
}

function validateWorktreePath(input: {
  repoRoot: string;
  checkoutPath: string;
  worktreeParent?: string;
}) {
  const parent = path.resolve(input.worktreeParent ?? path.dirname(input.repoRoot));
  const checkoutPath = path.resolve(input.checkoutPath);
  const relative = path.relative(parent, checkoutPath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new GitWorkspaceError("worktree_path_outside_parent", "Worktree path must stay inside the configured parent.", {
      checkoutPath,
      worktreeParent: parent,
    });
  }
  let parentStat: fs.Stats;
  try {
    fs.realpathSync.native(parent);
    parentStat = fs.statSync(parent);
  } catch {
    throw new GitWorkspaceError("worktree_parent_missing", "Worktree parent does not exist.", { worktreeParent: parent });
  }
  if (!parentStat.isDirectory()) {
    throw new GitWorkspaceError("worktree_parent_invalid", "Worktree parent must be a directory.", { worktreeParent: parent });
  }
  const realParent = fs.realpathSync.native(parent);
  const existingAncestor = nearestExistingAncestor(checkoutPath);
  const realAncestor = fs.realpathSync.native(existingAncestor);
  const ancestorRelative = path.relative(realParent, realAncestor);
  if (ancestorRelative.startsWith("..") || path.isAbsolute(ancestorRelative)) {
    throw new GitWorkspaceError("worktree_path_outside_parent", "Worktree path must not escape through symlinks.", {
      checkoutPath,
      worktreeParent: realParent,
    });
  }
  return checkoutPath;
}

function nearestExistingAncestor(candidatePath: string) {
  let current = candidatePath;
  while (!fs.existsSync(current)) {
    const next = path.dirname(current);
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
}

function assertPathStillAvailable(checkoutPath: string) {
  if (!fs.existsSync(checkoutPath)) {
    return;
  }
  const stat = fs.statSync(checkoutPath);
  if (!stat.isDirectory()) {
    throw new GitWorkspaceError("worktree_path_exists", "Worktree path already exists and is not a directory.", { checkoutPath });
  }
  const entries = fs.readdirSync(checkoutPath);
  if (entries.length > 0) {
    throw new GitWorkspaceError("worktree_path_not_empty", "Worktree path already exists and is not empty.", { checkoutPath });
  }
}

function snapshotToTarget(snapshot: GitWorkspaceSnapshot, kind: "current_checkout" | "worktree"): GitWorkspaceTarget {
  return {
    kind,
    repoRoot: snapshot.repoRoot,
    gitCommonDir: snapshot.gitCommonDir,
    checkoutPath: snapshot.checkoutPath,
    branchName: snapshot.branchName,
    worktreeId: kind === "worktree" ? snapshot.checkoutPath : null,
  };
}

function translateWorktreeError(error: unknown, branchName: string) {
  if (error instanceof GitCommandError && /already checked out/i.test(error.stderr)) {
    return new GitWorkspaceError("branch_checked_out_elsewhere", "Branch is already checked out in another worktree.", {
      branchName,
      stderr: error.stderr,
    });
  }
  return error;
}

export async function validateWorkspaceTarget(target: GitWorkspaceTarget) {
  const identity = await discoverRepositoryIdentity(target.checkoutPath);
  if (identity.gitCommonDir !== target.gitCommonDir) {
    throw new GitWorkspaceError("workspace_identity_mismatch", "Workspace target belongs to a different repository.", {
      expectedGitCommonDir: target.gitCommonDir,
      actualGitCommonDir: identity.gitCommonDir,
    });
  }
  return getGitWorkspaceSnapshot(target.checkoutPath);
}
