"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, Check, FolderGit2, GitBranch, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { shallowEqualRecord, useManagerSelector } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { GitBranchSummary, GitWorkspaceSnapshot, GitWorkspaceTarget, GitWorktreeSummary } from "@/lib/git-workspace";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "@/app/home/GitWorkspaceManager";

interface BranchWorkspaceButtonProps {
  projectPath: string | null;
  disabled?: boolean;
  themeMode: "day" | "night";
}

function workspaceLabel(snapshot: GitWorkspaceSnapshot | undefined, selectedTarget: GitWorkspaceTarget | undefined) {
  if (selectedTarget?.branchName) {
    return selectedTarget.branchName;
  }
  if (selectedTarget?.checkoutPath) {
    return t("git.workspace.label.worktree");
  }
  if (!snapshot) {
    return t("git.workspace.label.unavailable");
  }
  return snapshot.branchName ?? snapshot.detachedLabel ?? t("git.workspace.label.detached");
}

function statusTone(snapshot: GitWorkspaceSnapshot | undefined) {
  if (!snapshot) {
    return "muted";
  }
  if (snapshot.conflictedFileCount > 0) {
    return "danger";
  }
  if (snapshot.warnings.length > 0) {
    return "warning";
  }
  return "clean";
}

function slugBranchName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "workspace";
}

function suggestCheckoutPath(snapshot: GitWorkspaceSnapshot | undefined, branchName: string) {
  if (!snapshot?.repoRoot) {
    return "";
  }
  const pieces = snapshot.repoRoot.split("/");
  const repoName = pieces.pop() || "repo";
  const parent = pieces.join("/") || "/";
  return `${parent}/${repoName}-${slugBranchName(branchName).replace(/\//g, "-")}`;
}

function targetFromWorktree(snapshot: GitWorkspaceSnapshot, worktree: GitWorktreeSummary): GitWorkspaceTarget {
  return {
    kind: worktree.isCurrent ? "current_checkout" : "worktree",
    repoRoot: snapshot.repoRoot,
    gitCommonDir: snapshot.gitCommonDir,
    checkoutPath: worktree.checkoutPath,
    branchName: worktree.branchName,
    worktreeId: worktree.isCurrent ? null : worktree.checkoutPath,
  };
}

function worktreeLabel(worktree: GitWorktreeSummary) {
  return worktree.branchName ?? worktree.detachedLabel ?? t("git.workspace.label.detached");
}

function selectWorkspaceState(projectPath: string | null) {
  return function select(snapshot: ReturnType<typeof gitWorkspaceManager.getSnapshot>) {
    if (!projectPath) {
      return {
        snapshot: undefined,
        selectedTarget: undefined,
        pendingLaunch: undefined,
        loading: false,
        pendingOperation: snapshot.pendingOperation,
        activeDialog: snapshot.activeDialog,
        dialogDraft: snapshot.dialogDraft,
        lastError: snapshot.lastError,
      };
    }
    return {
      snapshot: snapshot.snapshotsByProject[projectPath],
      selectedTarget: snapshot.selectedTargetsByProject[projectPath],
      pendingLaunch: snapshot.pendingLaunchByProject[projectPath],
      loading: Boolean(snapshot.loadingByProject[projectPath]),
      pendingOperation: snapshot.pendingOperation,
      activeDialog: snapshot.activeDialog,
      dialogDraft: snapshot.dialogDraft,
      lastError: snapshot.lastError,
    };
  };
}

export function BranchWorkspaceButton({ projectPath, disabled = false, themeMode }: BranchWorkspaceButtonProps) {
  useI18nSnapshot();
  const selector = useMemo(() => selectWorkspaceState(projectPath), [projectPath]);
  const { snapshot, selectedTarget, pendingLaunch, loading, pendingOperation, activeDialog, dialogDraft, lastError } = useManagerSelector(
    gitWorkspaceManager,
    selector,
    shallowEqualRecord,
  );
  const { branchName, checkoutPath } = dialogDraft;
  const canUseGit = Boolean(projectPath);
  const tone = statusTone(snapshot);
  const label = pendingLaunch?.newBranchName ?? workspaceLabel(snapshot, selectedTarget);
  const localBranches = useMemo(
    () => snapshot?.branches.filter((branch) => !branch.isRemote) ?? [],
    [snapshot],
  );
  const checkoutDialog = activeDialog?.kind === "checkout" && activeDialog.projectPath === projectPath
    ? activeDialog
    : null;
  const createDialog = activeDialog?.kind === "create_worktree" && activeDialog.projectPath === projectPath
    ? activeDialog
    : null;
  const removeDialog = activeDialog?.kind === "remove_worktree" && activeDialog.projectPath === projectPath
    ? activeDialog
    : null;
  const removeWorktree = removeDialog && snapshot
    ? snapshot.worktrees.find((worktree) => worktree.checkoutPath === removeDialog.checkoutPath)
    : undefined;

  useEffect(() => {
    if (projectPath) {
      void gitWorkspaceManager.loadStatus(projectPath).catch(() => undefined);
    }
  }, [projectPath]);

  useEffect(() => {
    if (activeDialog?.kind === "start_new_worktree" && snapshot) {
      const nextBranch = `feature/${slugBranchName(snapshot.branchName ?? snapshot.detachedLabel ?? "workspace")}`;
      gitWorkspaceManager.setDialogDraft({
        branchName: nextBranch,
        checkoutPath: suggestCheckoutPath(snapshot, nextBranch),
      });
    }
  }, [activeDialog, snapshot]);

  useEffect(() => {
    if (activeDialog?.kind === "create_worktree" && snapshot) {
      const nextBranch = activeDialog.branchName ?? snapshot.branchName ?? snapshot.detachedLabel ?? "workspace";
      gitWorkspaceManager.setDialogDraft({
        branchName: nextBranch,
        checkoutPath: suggestCheckoutPath(snapshot, nextBranch),
      });
    }
  }, [activeDialog, snapshot]);

  const confirmStartInNewWorktree = () => {
    if (!projectPath || !snapshot || !branchName.trim() || !checkoutPath.trim()) {
      return;
    }
    const request: GitWorkspaceLaunchRequest = {
      mode: "new_worktree",
      projectPath,
      newBranchName: branchName.trim(),
      checkoutPath: checkoutPath.trim(),
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    };
    gitWorkspaceManager.confirmStartInNewWorktree(request);
  };

  const selectWorktree = (worktree: GitWorktreeSummary) => {
    if (!projectPath || !snapshot) {
      return;
    }
    void gitWorkspaceManager.selectTarget(projectPath, targetFromWorktree(snapshot, worktree)).catch(() => undefined);
  };

  const canCheckoutBranch = (branch: GitBranchSummary) => {
    if (!snapshot || !projectPath || branch.isCurrent || branch.isRemote) {
      return false;
    }
    if (snapshot.dirtyFileCount > 0 || snapshot.conflictedFileCount > 0 || snapshot.isDetached) {
      return false;
    }
    return !branch.checkedOutPath || branch.checkedOutPath === snapshot.checkoutPath;
  };

  const canCreateBranchWorktree = (branch: GitBranchSummary) => {
    return Boolean(snapshot && projectPath && !branch.isRemote && !branch.checkedOutPath && !snapshot.conflictedFileCount);
  };

  const canRemoveWorktree = (worktree: GitWorktreeSummary) => {
    return !worktree.isCurrent && worktree.dirtyFileCount === 0 && worktree.conflictedFileCount === 0;
  };

  const confirmCheckout = () => {
    if (!projectPath || !snapshot || !checkoutDialog) {
      return;
    }
    void gitWorkspaceManager.confirmCheckout({
      operation: "checkout_existing_branch",
      projectPath,
      branchName: checkoutDialog.branchName,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }).catch(() => undefined);
  };

  const confirmCreateWorktree = () => {
    if (!projectPath || !snapshot || !createDialog || !branchName.trim() || !checkoutPath.trim()) {
      return;
    }
    void gitWorkspaceManager.confirmCreateWorktree({
      operation: "create_worktree_existing_branch",
      projectPath,
      branchName: branchName.trim(),
      checkoutPath: checkoutPath.trim(),
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }).catch(() => undefined);
  };

  const confirmRemoveWorktree = () => {
    if (!projectPath || !snapshot || !removeDialog) {
      return;
    }
    void gitWorkspaceManager.confirmRemoveWorktree({
      operation: "remove_worktree",
      projectPath,
      checkoutPath: removeDialog.checkoutPath,
      expectedHeadSha: snapshot.headSha,
      expectedStatusFingerprint: snapshot.statusFingerprint,
    }).catch(() => undefined);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || !canUseGit}
              className={cn(
                "h-8 max-w-[11rem] shrink truncate rounded-full px-2 text-xs font-medium sm:max-w-[14rem]",
                themeMode === "night"
                  ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
                  : "text-[#6f6f6f] hover:bg-black/[0.04] hover:text-[#4f4f4f] dark:text-muted-foreground dark:hover:bg-background/45 dark:hover:text-foreground",
              )}
              aria-label={t("git.workspace.button.aria")}
              title={t("git.workspace.button.title")}
            />
          }
        >
          {loading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : tone === "danger" || tone === "warning" ? (
            <AlertTriangle className={cn("h-3.5 w-3.5", tone === "danger" ? "text-destructive" : "text-amber-600")} />
          ) : selectedTarget?.kind === "worktree" || pendingLaunch ? (
            <FolderGit2 className="h-3.5 w-3.5" />
          ) : (
            <GitBranch className="h-3.5 w-3.5" />
          )}
          <span className="min-w-0 truncate">{label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-[min(92vw,24rem)] p-2">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("git.workspace.menu.current")}</DropdownMenuLabel>
            <div className="px-1.5 pb-2 text-xs text-muted-foreground">
              <div className="truncate font-medium text-foreground">{label}</div>
              <div className="truncate">{selectedTarget?.checkoutPath ?? snapshot?.checkoutPath ?? t("git.workspace.status.noRepository")}</div>
              {snapshot ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {snapshot.dirtyFileCount > 0 ? <span>{t("git.workspace.badge.dirty", { count: snapshot.dirtyFileCount })}</span> : null}
                  {snapshot.conflictedFileCount > 0 ? <span>{t("git.workspace.badge.conflicted", { count: snapshot.conflictedFileCount })}</span> : null}
                  {snapshot.aheadCount ? <span>{t("git.workspace.badge.ahead", { count: snapshot.aheadCount })}</span> : null}
                  {snapshot.behindCount ? <span>{t("git.workspace.badge.behind", { count: snapshot.behindCount })}</span> : null}
                  {snapshot.dirtyFileCount === 0 && snapshot.conflictedFileCount === 0 ? <span>{t("git.workspace.status.clean")}</span> : null}
                </div>
              ) : null}
            </div>

            <DropdownMenuItem
              onClick={() => projectPath && gitWorkspaceManager.loadStatus(projectPath).catch(() => undefined)}
              disabled={!projectPath || loading}
            >
              <RefreshCw />
              {t("git.workspace.action.refresh")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => projectPath && gitWorkspaceManager.requestStartInNewWorktree(projectPath)}
              disabled={!projectPath || !snapshot || snapshot.isDetached || snapshot.conflictedFileCount > 0}
            >
              <GitBranch />
              {t("git.workspace.action.startNewWorktree")}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("git.workspace.menu.branches")}</DropdownMenuLabel>
            {localBranches.length ? localBranches.map((branch) => {
              const checked = branch.name === snapshot?.branchName;
              const checkoutDisabled = !canCheckoutBranch(branch);
              const createDisabled = !canCreateBranchWorktree(branch);
              return (
                <div key={branch.fullName} className="grid gap-1 rounded-md px-1.5 py-1.5 text-sm">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {checked ? <Check className="h-4 w-4 shrink-0" /> : <GitBranch className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                    {branch.checkedOutPath && !checked ? (
                      <span className="max-w-[9rem] truncate text-xs text-muted-foreground" title={branch.checkedOutPath}>
                        {t("git.workspace.badge.checkedOut")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={checkoutDisabled}
                      onClick={() => projectPath && gitWorkspaceManager.requestCheckout(projectPath, branch.name)}
                    >
                      {t("git.workspace.action.checkoutBranch")}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={createDisabled}
                      onClick={() => projectPath && gitWorkspaceManager.requestCreateWorktree(projectPath, branch.name)}
                    >
                      {t("git.workspace.action.createWorktreeForBranch")}
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <div className="px-1.5 py-1 text-xs text-muted-foreground">{t("git.workspace.empty.branches")}</div>
            )}
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("git.workspace.menu.worktrees")}</DropdownMenuLabel>
            {snapshot?.worktrees.length ? snapshot.worktrees.map((worktree) => {
              const checked = selectedTarget?.checkoutPath === worktree.checkoutPath || (!selectedTarget && worktree.isCurrent);
              return (
                <div key={worktree.checkoutPath} className="flex items-center gap-1 rounded-md px-1.5 py-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                    onClick={() => selectWorktree(worktree)}
                  >
                    {checked ? <Check className="h-4 w-4 shrink-0" /> : <FolderGit2 className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{worktreeLabel(worktree)}</span>
                    {worktree.conflictedFileCount > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> : null}
                  </button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={!projectPath || !canRemoveWorktree(worktree)}
                    aria-label={t("git.workspace.action.removeWorktree")}
                    title={t("git.workspace.action.removeWorktree")}
                    onClick={() => projectPath && gitWorkspaceManager.requestRemoveWorktree(projectPath, worktree.checkoutPath)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            }) : (
              <div className="px-1.5 py-1 text-xs text-muted-foreground">{t("git.workspace.empty.worktrees")}</div>
            )}
          </DropdownMenuGroup>

          {lastError ? (
            <div className="mt-2 rounded-md border border-destructive/25 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              <div className="font-medium">{lastError.message}</div>
              {lastError.details?.length ? <div className="mt-1 opacity-80">{lastError.details.join(" ")}</div> : null}
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={activeDialog?.kind === "start_new_worktree" && activeDialog.projectPath === projectPath}
        onOpenChange={(open) => {
          if (!open) {
            gitWorkspaceManager.setKey("activeDialog", null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("git.workspace.dialog.start.title")}</DialogTitle>
            <DialogDescription>{t("git.workspace.dialog.start.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("git.workspace.field.branchName")}</span>
              <Input value={branchName} onChange={(event) => {
                const nextBranch = event.target.value;
                gitWorkspaceManager.setDialogBranchName(nextBranch, suggestCheckoutPath(snapshot, nextBranch));
              }} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("git.workspace.field.checkoutPath")}</span>
              <Input value={checkoutPath} onChange={(event) => gitWorkspaceManager.setDialogCheckoutPath(event.target.value)} />
            </label>
            {pendingLaunch ? (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
                {t("git.workspace.dialog.start.pending", { branch: pendingLaunch.newBranchName })}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={confirmStartInNewWorktree} disabled={!branchName.trim() || !checkoutPath.trim() || Boolean(pendingOperation)}>
              {t("git.workspace.dialog.start.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(checkoutDialog)}
        onOpenChange={(open) => {
          if (!open) {
            gitWorkspaceManager.setKey("activeDialog", null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("git.workspace.dialog.checkout.title")}</DialogTitle>
            <DialogDescription>
              {t("git.workspace.dialog.checkout.description", {
                branch: checkoutDialog?.branchName ?? "",
                path: snapshot?.checkoutPath ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
            {t("git.workspace.dialog.checkout.warning")}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={confirmCheckout} disabled={!checkoutDialog || Boolean(pendingOperation)}>
              {t("git.workspace.dialog.checkout.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(createDialog)}
        onOpenChange={(open) => {
          if (!open) {
            gitWorkspaceManager.setKey("activeDialog", null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("git.workspace.dialog.createExisting.title")}</DialogTitle>
            <DialogDescription>{t("git.workspace.dialog.createExisting.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("git.workspace.field.branchName")}</span>
              <Input value={branchName} onChange={(event) => {
                const nextBranch = event.target.value;
                gitWorkspaceManager.setDialogBranchName(nextBranch, suggestCheckoutPath(snapshot, nextBranch));
              }} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{t("git.workspace.field.checkoutPath")}</span>
              <Input value={checkoutPath} onChange={(event) => gitWorkspaceManager.setDialogCheckoutPath(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={confirmCreateWorktree} disabled={!branchName.trim() || !checkoutPath.trim() || Boolean(pendingOperation)}>
              {t("git.workspace.dialog.createExisting.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removeDialog)}
        onOpenChange={(open) => {
          if (!open) {
            gitWorkspaceManager.setKey("activeDialog", null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("git.workspace.dialog.remove.title")}</DialogTitle>
            <DialogDescription>
              {t("git.workspace.dialog.remove.description", {
                branch: removeWorktree ? worktreeLabel(removeWorktree) : t("git.workspace.label.detached"),
                path: removeDialog?.checkoutPath ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {t("git.workspace.dialog.remove.warning")}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRemoveWorktree}
              disabled={!removeDialog || Boolean(pendingOperation) || Boolean(removeWorktree && !canRemoveWorktree(removeWorktree))}
            >
              {t("git.workspace.dialog.remove.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
