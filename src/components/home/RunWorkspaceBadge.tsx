import { FolderGit2, GitBranch } from "lucide-react";
import type { RunRecord } from "@/app/home/types";
import type { GitWorkspaceRunSnapshot } from "@/lib/git-workspace";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface RunWorkspaceBadgeProps {
  run: RunRecord | null;
  fallbackPath?: string | null;
  className?: string;
}

function parseRunWorkspaceSnapshot(value: string | null | undefined): GitWorkspaceRunSnapshot | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<GitWorkspaceRunSnapshot>;
    if (parsed.target?.checkoutPath) {
      return parsed as GitWorkspaceRunSnapshot;
    }
  } catch {
    return null;
  }
  return null;
}

function lastPathSegment(value: string | null | undefined) {
  return value?.split(/[\\/]/).filter(Boolean).pop() || value || "";
}

export function RunWorkspaceBadge({ run, fallbackPath, className }: RunWorkspaceBadgeProps) {
  const snapshot = parseRunWorkspaceSnapshot(run?.gitWorkspaceJson);
  const checkoutPath = snapshot?.target.checkoutPath ?? fallbackPath ?? run?.projectPath ?? null;
  if (!run || !checkoutPath) {
    return null;
  }

  const branchLabel = snapshot?.branchName ?? snapshot?.detachedLabel ?? null;
  const label = branchLabel
    ? branchLabel
    : lastPathSegment(checkoutPath) || t("git.workspace.runBadge.fallback");
  const title = branchLabel
    ? t("git.workspace.runBadge.titleWithBranch", { branch: branchLabel, path: checkoutPath })
    : t("git.workspace.runBadge.titleWithPath", { path: checkoutPath });
  const isWorktree = snapshot?.target.kind === "worktree";

  return (
    <span
      className={cn(
        "inline-flex max-w-[14rem] shrink items-center gap-1 truncate rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 font-mono text-[10px] text-muted-foreground",
        className,
      )}
      title={title}
      aria-label={title}
    >
      {isWorktree ? <FolderGit2 className="h-3 w-3" /> : <GitBranch className="h-3 w-3" />}
      <span className="truncate">{label}</span>
    </span>
  );
}
