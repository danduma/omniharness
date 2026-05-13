import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  formatDetachedLabel,
  GitBranchSummary,
  GitRepositoryIdentity,
  GitWorkspaceSnapshot,
  GitWorkspaceWarning,
  GitWorktreeSummary,
} from "@/lib/git-workspace";
import { runGit } from "@/server/git/command";

interface ParsedStatus {
  headSha: string | null;
  branchName: string | null;
  isDetached: boolean;
  aheadCount: number | null;
  behindCount: number | null;
  dirtyFileCount: number;
  conflictedFileCount: number;
  fingerprint: string;
  raw: string;
}

interface ParsedWorktree {
  checkoutPath: string;
  headSha: string | null;
  branchName: string | null;
  isBare: boolean;
  isDetached: boolean;
  isPrunable: boolean;
}

export async function discoverRepositoryIdentity(projectPath: string): Promise<GitRepositoryIdentity> {
  const repoRoot = (await runGit({
    cwd: projectPath,
    args: ["rev-parse", "--show-toplevel"],
  })).stdout.trim();
  const gitCommonDir = (await runGit({
    cwd: repoRoot,
    args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  })).stdout.trim();
  return {
    repoRoot,
    gitCommonDir,
  };
}

export async function buildGitWorkspaceSnapshot(projectPath: string): Promise<GitWorkspaceSnapshot> {
  const identity = await discoverRepositoryIdentity(projectPath);
  const status = await readStatus(identity.repoRoot);
  const isBare = (await runGit({
    cwd: identity.repoRoot,
    args: ["rev-parse", "--is-bare-repository"],
  })).stdout.trim() === "true";
  const rawWorktrees = await readWorktrees(identity.repoRoot);
  const worktrees = await Promise.all(rawWorktrees.map(async (worktree) => {
    let worktreeStatus: ParsedStatus | null = null;
    if (!worktree.isBare && fs.existsSync(worktree.checkoutPath)) {
      worktreeStatus = await readStatus(worktree.checkoutPath);
    }
    return {
      checkoutPath: worktree.checkoutPath,
      headSha: worktree.headSha,
      branchName: worktree.branchName,
      detachedLabel: worktree.isDetached ? formatDetachedLabel(worktree.headSha) : null,
      isCurrent: path.resolve(worktree.checkoutPath) === path.resolve(identity.repoRoot),
      isDetached: worktree.isDetached,
      isBare: worktree.isBare,
      isPrunable: worktree.isPrunable,
      dirtyFileCount: worktreeStatus?.dirtyFileCount ?? 0,
      conflictedFileCount: worktreeStatus?.conflictedFileCount ?? 0,
    } satisfies GitWorktreeSummary;
  }));
  const branches = await readBranches(identity.repoRoot, status.branchName, worktrees);
  const warnings = await readWarnings(identity.repoRoot);

  return {
    repoRoot: identity.repoRoot,
    gitCommonDir: identity.gitCommonDir,
    checkoutPath: identity.repoRoot,
    headSha: status.headSha,
    branchName: status.branchName,
    detachedLabel: status.isDetached ? formatDetachedLabel(status.headSha) : null,
    isDetached: status.isDetached,
    isBare,
    dirtyFileCount: status.dirtyFileCount,
    conflictedFileCount: status.conflictedFileCount,
    aheadCount: status.aheadCount,
    behindCount: status.behindCount,
    statusFingerprint: status.fingerprint,
    worktrees,
    branches,
    warnings,
    refreshedAt: new Date().toISOString(),
  };
}

async function readStatus(cwd: string): Promise<ParsedStatus> {
  const raw = (await runGit({
    cwd,
    args: ["status", "--porcelain=v2", "--branch"],
  })).stdout;
  let headSha: string | null = null;
  let branchName: string | null = null;
  let aheadCount: number | null = null;
  let behindCount: number | null = null;
  let dirtyFileCount = 0;
  let conflictedFileCount = 0;

  for (const line of raw.split("\n")) {
    if (!line) {
      continue;
    }
    if (line.startsWith("# branch.oid ")) {
      const value = line.slice("# branch.oid ".length).trim();
      headSha = value === "(initial)" ? null : value;
      continue;
    }
    if (line.startsWith("# branch.head ")) {
      const value = line.slice("# branch.head ".length).trim();
      branchName = value === "(detached)" ? null : value;
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+)\s+-(\d+)/);
      if (match) {
        aheadCount = Number(match[1]);
        behindCount = Number(match[2]);
      }
      continue;
    }
    if (line.startsWith("u ")) {
      conflictedFileCount += 1;
      dirtyFileCount += 1;
      continue;
    }
    if (line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("? ")) {
      dirtyFileCount += 1;
    }
  }

  const fingerprint = crypto.createHash("sha256").update(raw).digest("hex");
  return {
    headSha,
    branchName,
    isDetached: branchName === null,
    aheadCount,
    behindCount,
    dirtyFileCount,
    conflictedFileCount,
    fingerprint,
    raw,
  };
}

async function readBranches(
  repoRoot: string,
  currentBranch: string | null,
  worktrees: GitWorktreeSummary[],
): Promise<GitBranchSummary[]> {
  const checkedOutByBranch = new Map<string, string>();
  for (const worktree of worktrees) {
    if (worktree.branchName) {
      checkedOutByBranch.set(worktree.branchName, worktree.checkoutPath);
    }
  }
  const raw = (await runGit({
    cwd: repoRoot,
    args: [
      "for-each-ref",
      "--format=%(refname)|%(refname:short)|%(objectname)|%(upstream:short)",
      "refs/heads",
      "refs/remotes",
    ],
  })).stdout.trim();
  if (!raw) {
    return [];
  }
  return raw.split("\n").map((line) => {
    const [fullName = "", name = "", headSha = "", upstreamName = ""] = line.split("|");
    const isRemote = fullName.startsWith("refs/remotes/");
    return {
      name,
      fullName,
      headSha: headSha || null,
      isCurrent: !isRemote && name === currentBranch,
      isRemote,
      upstreamName: upstreamName || null,
      checkedOutPath: checkedOutByBranch.get(name) ?? null,
    };
  });
}

async function readWorktrees(repoRoot: string): Promise<ParsedWorktree[]> {
  const raw = (await runGit({
    cwd: repoRoot,
    args: ["worktree", "list", "--porcelain"],
  })).stdout;
  const worktrees: ParsedWorktree[] = [];
  let current: Partial<ParsedWorktree> | null = null;

  function flush() {
    if (current?.checkoutPath) {
      worktrees.push({
        checkoutPath: current.checkoutPath,
        headSha: current.headSha ?? null,
        branchName: current.branchName ?? null,
        isBare: current.isBare ?? false,
        isDetached: current.isDetached ?? !current.branchName,
        isPrunable: current.isPrunable ?? false,
      });
    }
    current = null;
  }

  for (const line of raw.split("\n")) {
    if (!line) {
      flush();
      continue;
    }
    const [key, ...rest] = line.split(" ");
    const value = rest.join(" ");
    if (key === "worktree") {
      flush();
      current = { checkoutPath: value };
    } else if (current && key === "HEAD") {
      current.headSha = value;
    } else if (current && key === "branch") {
      current.branchName = value.replace(/^refs\/heads\//, "");
      current.isDetached = false;
    } else if (current && key === "bare") {
      current.isBare = true;
    } else if (current && key === "detached") {
      current.isDetached = true;
    } else if (current && key === "prunable") {
      current.isPrunable = true;
    }
  }
  flush();
  return worktrees;
}

async function readWarnings(repoRoot: string): Promise<GitWorkspaceWarning[]> {
  const warnings: GitWorkspaceWarning[] = [];
  const superproject = await runGit({
    cwd: repoRoot,
    args: ["rev-parse", "--show-superproject-working-tree"],
    allowExitCodes: [0, 128],
  });
  if (superproject.stdout.trim()) {
    warnings.push({
      code: "submodule_repository",
      message: "Repository is a submodule.",
      details: { superproject: superproject.stdout.trim() },
    });
  }

  const sparse = await runGit({
    cwd: repoRoot,
    args: ["config", "--bool", "core.sparseCheckout"],
    allowExitCodes: [0, 1],
  });
  if (sparse.stdout.trim() === "true") {
    warnings.push({
      code: "sparse_checkout",
      message: "Sparse checkout is enabled.",
    });
  }

  const lfs = await runGit({
    cwd: repoRoot,
    args: ["config", "--get", "filter.lfs.process"],
    allowExitCodes: [0, 1],
  });
  if (lfs.stdout.trim()) {
    warnings.push({
      code: "git_lfs",
      message: "Git LFS filters are configured.",
    });
  }

  return warnings;
}
