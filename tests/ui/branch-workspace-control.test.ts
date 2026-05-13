import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const sources = [
  "src/components/home/ConversationComposer.tsx",
  "src/components/home/BranchWorkspaceButton.tsx",
  "src/app/home/ComposerContainer.tsx",
  "src/app/home/useHomeMutations.ts",
  "src/app/home/useConversationActions.ts",
  "src/app/home/GitWorkspaceManager.ts",
  "src/components/home/HomeHeader.tsx",
  "src/components/home/ConversationMain.tsx",
  "src/components/home/RunWorkspaceBadge.tsx",
].map((relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8")).join("\n");

describe("branch workspace control", () => {
  it("mounts a translated composer workspace control for new conversations", () => {
    expect(sources).toContain('import { BranchWorkspaceButton } from "./BranchWorkspaceButton";');
    expect(sources).toContain("<BranchWorkspaceButton");
    expect(sources).toContain("workspaceProjectPath={currentProjectScope}");
    expect(sources).toContain("git.workspace.button.aria");
    expect(sources).toContain("git.workspace.action.startNewWorktree");
    expect(sources).toContain("git.workspace.dialog.start.confirm");
  });

  it("keeps git state in GitWorkspaceManager and stores pending launch intent separately", () => {
    expect(sources).toContain("gitWorkspaceManager.loadStatus(projectPath)");
    expect(sources).toContain("selectTarget(projectPath: string, target: GitWorkspaceTarget)");
    expect(sources).toContain("requestCheckout(projectPath: string, branchName: string)");
    expect(sources).toContain("confirmCheckout(args: Extract<GitWorkspaceApiRequest, { operation: \"checkout_existing_branch\" }>)");
    expect(sources).toContain("confirmStartInNewWorktree(request: GitWorkspaceLaunchRequest)");
    expect(sources).toContain("requestCreateWorktree(projectPath: string, branchName?: string)");
    expect(sources).toContain("confirmCreateWorktree(args: Extract<GitWorkspaceApiRequest, { operation: \"create_worktree_existing_branch\" | \"prepare_session_worktree\" }>)");
    expect(sources).toContain("requestRemoveWorktree(projectPath: string, checkoutPath: string)");
    expect(sources).toContain("confirmRemoveWorktree(args: Extract<GitWorkspaceApiRequest, { operation: \"remove_worktree\" }>)");
    expect(sources).toContain("pendingLaunchByProject");
    expect(sources).toContain("consumePendingLaunch(projectPath: string)");
  });

  it("surfaces advanced branch checkout, existing-branch worktree creation, and clean worktree removal", () => {
    expect(sources).toContain("git.workspace.menu.branches");
    expect(sources).toContain("git.workspace.action.checkoutBranch");
    expect(sources).toContain("git.workspace.action.createWorktreeForBranch");
    expect(sources).toContain("git.workspace.action.removeWorktree");
    expect(sources).toContain("git.workspace.dialog.checkout.title");
    expect(sources).toContain("git.workspace.dialog.checkout.confirm");
    expect(sources).toContain("git.workspace.dialog.createExisting.title");
    expect(sources).toContain("git.workspace.dialog.createExisting.confirm");
    expect(sources).toContain("git.workspace.dialog.remove.title");
    expect(sources).toContain("git.workspace.dialog.remove.confirm");
    expect(sources).toContain("gitWorkspaceManager.requestCheckout(projectPath, branch.name)");
    expect(sources).toContain("gitWorkspaceManager.requestCreateWorktree(projectPath, branch.name)");
    expect(sources).toContain("gitWorkspaceManager.requestRemoveWorktree(projectPath, worktree.checkoutPath)");
  });

  it("adds a translated fork-into-worktree action for message checkpoints", () => {
    expect(sources).toContain("requestForkMessageWorktree(projectPath: string, runId: string, targetMessageId: string, content: string)");
    expect(sources).toContain("handleForkMessageIntoWorktree");
    expect(sources).toContain("handleConfirmForkMessageIntoWorktree");
    expect(sources).toContain("git.workspace.action.forkMessageWorktree");
    expect(sources).toContain("git.workspace.dialog.fork.title");
    expect(sources).toContain("git.workspace.dialog.fork.confirm");
    expect(sources).toContain("gitWorkspaceLaunch");
  });

  it("sends selected or pending git workspace intent only when starting a new run", () => {
    expect(sources).toContain("gitWorkspaceManager.getSnapshot()");
    expect(sources).toContain("pendingLaunchByProject[payload.projectPath]");
    expect(sources).toContain("selectedTargetsByProject[payload.projectPath]");
    expect(sources).toContain("gitWorkspaceLaunch: pendingWorkspaceLaunch");
    expect(sources).toContain("gitWorkspaceTarget: selectedWorkspaceTarget");
    expect(sources).toContain("gitWorkspaceManager.consumePendingLaunch(variables.projectPath)");
  });

  it("shows selected runs with an immutable workspace badge", () => {
    expect(sources).toContain('import { RunWorkspaceBadge } from "./RunWorkspaceBadge";');
    expect(sources).toContain("<RunWorkspaceBadge run={selectedRun} fallbackPath={activeConversationCwd} />");
    expect(sources).toContain("parseRunWorkspaceSnapshot(run?.gitWorkspaceJson)");
    expect(sources).toContain("git.workspace.runBadge.titleWithBranch");
  });
});
