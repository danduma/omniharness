import { randomUUID } from "crypto";
import { formatErrorMessage } from "@/server/error-format";
import { addProjectGitWorkspacePendingOrphan } from "@/server/projects/config";
import type { GitWorkspaceTarget, PendingOrphanWorktreeRecovery } from "@/lib/git-workspace";
import { GitWorkspaceError } from "@/server/git/workspaces";

export function persistPendingOrphanWorktree(args: {
  projectPath: string;
  operation: PendingOrphanWorktreeRecovery["operation"];
  target: GitWorkspaceTarget;
  error: unknown;
  sourceRunId?: string;
  targetMessageId?: string;
}) {
  const orphan: PendingOrphanWorktreeRecovery = {
    id: randomUUID(),
    operation: args.operation,
    repoRoot: args.target.repoRoot,
    gitCommonDir: args.target.gitCommonDir,
    checkoutPath: args.target.checkoutPath,
    branchName: args.target.branchName,
    worktreeId: args.target.worktreeId,
    sourceRunId: args.sourceRunId,
    targetMessageId: args.targetMessageId,
    errorMessage: formatErrorMessage(args.error),
    createdAt: new Date().toISOString(),
  };

  addProjectGitWorkspacePendingOrphan(args.projectPath, orphan);
  return orphan;
}

export function pendingOrphanWorktreeError(args: {
  projectPath: string;
  operation: PendingOrphanWorktreeRecovery["operation"];
  target: GitWorkspaceTarget;
  error: unknown;
  sourceRunId?: string;
  targetMessageId?: string;
}) {
  const orphan = persistPendingOrphanWorktree(args);
  return new GitWorkspaceError(
    "pending_orphan_worktree",
    "A worktree was created, but the run could not be recorded. Review and remove the orphaned worktree when safe.",
    {
      pendingOrphanWorktree: orphan,
      causeMessage: orphan.errorMessage,
    },
  );
}
