export type GitWorkspaceKind = "current_checkout" | "worktree";

export interface GitRepositoryIdentity {
  repoRoot: string;
  gitCommonDir: string;
}

export interface GitWorkspaceTarget {
  kind: GitWorkspaceKind;
  repoRoot: string;
  gitCommonDir: string;
  checkoutPath: string;
  branchName: string | null;
  worktreeId: string | null;
}

export interface GitWorkspaceWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface GitBranchSummary {
  name: string;
  fullName: string;
  headSha: string | null;
  isCurrent: boolean;
  isRemote: boolean;
  upstreamName: string | null;
  checkedOutPath: string | null;
}

export interface GitWorktreeSummary {
  checkoutPath: string;
  headSha: string | null;
  branchName: string | null;
  detachedLabel: string | null;
  isCurrent: boolean;
  isDetached: boolean;
  isBare: boolean;
  isPrunable: boolean;
  dirtyFileCount: number;
  conflictedFileCount: number;
}

export interface GitWorkspaceSnapshot {
  repoRoot: string;
  gitCommonDir: string;
  checkoutPath: string;
  headSha: string | null;
  branchName: string | null;
  detachedLabel: string | null;
  isDetached: boolean;
  isBare: boolean;
  dirtyFileCount: number;
  conflictedFileCount: number;
  aheadCount: number | null;
  behindCount: number | null;
  statusFingerprint: string;
  worktrees: GitWorktreeSummary[];
  branches: GitBranchSummary[];
  warnings: GitWorkspaceWarning[];
  refreshedAt: string;
}

export interface GitWorkspaceRunSnapshot {
  target: GitWorkspaceTarget;
  headSha: string | null;
  branchName: string | null;
  detachedLabel: string | null;
  dirtyFileCount: number;
  conflictedFileCount: number;
  aheadCount: number | null;
  behindCount: number | null;
  warnings: GitWorkspaceWarning[];
  selectedAt: string;
}

export interface PendingOrphanWorktreeRecovery {
  id: string;
  operation: "conversation_launch" | "fork_run_worktree";
  repoRoot: string;
  gitCommonDir: string;
  checkoutPath: string;
  branchName: string | null;
  worktreeId: string | null;
  sourceRunId?: string;
  targetMessageId?: string;
  errorMessage: string;
  createdAt: string;
}

export function formatDetachedLabel(headSha: string | null) {
  return headSha ? `detached@${headSha.slice(0, 7)}` : "detached";
}
