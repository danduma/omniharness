import { StateManager } from "@/lib/state-manager";
import type { GitWorkspaceSnapshot, GitWorkspaceTarget } from "@/lib/git-workspace";
import { t } from "@/lib/i18n";

export type GitWorkspaceLaunchRequest = {
  mode: "new_worktree";
  projectPath: string;
  newBranchName: string;
  checkoutPath: string;
  startPoint?: string;
  worktreeParent?: string;
  expectedHeadSha: string | null;
  expectedStatusFingerprint: string;
};

export type GitWorkspaceDialog =
  | { kind: "checkout"; projectPath: string; branchName: string }
  | { kind: "start_new_worktree"; projectPath: string }
  | { kind: "create_worktree"; projectPath: string; branchName?: string }
  | { kind: "remove_worktree"; projectPath: string; checkoutPath: string }
  | { kind: "fork_message_worktree"; projectPath: string; runId: string; targetMessageId: string; content: string };

export type GitWorkspaceErrorState = {
  message: string;
  details?: string[];
};

export type GitWorkspaceApiRequest =
  | { operation: "status"; projectPath: string }
  | { operation: "select"; projectPath: string; target: GitWorkspaceTarget }
  | {
    operation: "checkout_existing_branch";
    projectPath: string;
    branchName: string;
    expectedHeadSha: string | null;
    expectedStatusFingerprint: string;
    allowDirty?: boolean;
  }
  | {
    operation: "prepare_session_worktree";
    projectPath: string;
    newBranchName: string;
    checkoutPath: string;
    startPoint?: string;
    worktreeParent?: string;
    expectedHeadSha: string | null;
    expectedStatusFingerprint: string;
  }
  | {
    operation: "create_worktree_existing_branch";
    projectPath: string;
    branchName: string;
    checkoutPath: string;
    worktreeParent?: string;
    expectedHeadSha: string | null;
    expectedStatusFingerprint: string;
  }
  | {
    operation: "remove_worktree";
    projectPath: string;
    checkoutPath: string;
    expectedHeadSha: string | null;
    expectedStatusFingerprint: string;
    pruneOnly?: boolean;
  };

export type GitWorkspaceApiResponse = {
  snapshot?: GitWorkspaceSnapshot;
  target?: GitWorkspaceTarget;
};

export type GitWorkspaceApiClient = (request: GitWorkspaceApiRequest) => Promise<GitWorkspaceApiResponse>;

export type GitWorkspaceManagerState = {
  snapshotsByProject: Record<string, GitWorkspaceSnapshot | undefined>;
  selectedTargetsByProject: Record<string, GitWorkspaceTarget | undefined>;
  pendingLaunchByProject: Record<string, GitWorkspaceLaunchRequest | undefined>;
  loadingByProject: Record<string, boolean | undefined>;
  pendingOperation: GitWorkspaceApiRequest["operation"] | null;
  activeDialog: GitWorkspaceDialog | null;
  lastError: GitWorkspaceErrorState | null;
};

const INITIAL_STATE: GitWorkspaceManagerState = {
  snapshotsByProject: {},
  selectedTargetsByProject: {},
  pendingLaunchByProject: {},
  loadingByProject: {},
  pendingOperation: null,
  activeDialog: null,
  lastError: null,
};

async function defaultGitWorkspaceApi(request: GitWorkspaceApiRequest): Promise<GitWorkspaceApiResponse> {
  const response = await fetch("/api/git", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? t("git.workspace.error.generic"));
    (error as Error & { details?: string[] }).details = payload?.error?.details;
    throw error;
  }
  return payload;
}

function toErrorState(error: unknown): GitWorkspaceErrorState {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: (error as Error & { details?: string[] }).details,
    };
  }
  return { message: String(error) };
}

function omitKey<TValue>(record: Record<string, TValue | undefined>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

export class GitWorkspaceManager extends StateManager<GitWorkspaceManagerState> {
  private readonly api: GitWorkspaceApiClient;

  constructor(api: GitWorkspaceApiClient = defaultGitWorkspaceApi) {
    super(INITIAL_STATE);
    this.api = api;
  }

  async loadStatus(projectPath: string) {
    this.patch((current) => ({
      loadingByProject: { ...current.loadingByProject, [projectPath]: true },
      lastError: null,
    }));
    try {
      const payload = await this.api({ operation: "status", projectPath });
      this.patch((current) => ({
        snapshotsByProject: payload.snapshot
          ? { ...current.snapshotsByProject, [projectPath]: payload.snapshot }
          : current.snapshotsByProject,
        loadingByProject: { ...current.loadingByProject, [projectPath]: false },
        lastError: null,
      }));
      return payload.snapshot ?? null;
    } catch (error) {
      this.patch((current) => ({
        loadingByProject: { ...current.loadingByProject, [projectPath]: false },
        lastError: toErrorState(error),
      }));
      throw error;
    }
  }

  async selectTarget(projectPath: string, target: GitWorkspaceTarget) {
    return this.runOperation({
      operation: "select",
      projectPath,
      target,
    }, (payload) => ({
      selectedTargetsByProject: payload.target
        ? { ...this.getSnapshot().selectedTargetsByProject, [projectPath]: payload.target }
        : this.getSnapshot().selectedTargetsByProject,
      snapshotsByProject: payload.snapshot
        ? { ...this.getSnapshot().snapshotsByProject, [projectPath]: payload.snapshot }
        : this.getSnapshot().snapshotsByProject,
    }));
  }

  requestCheckout(projectPath: string, branchName: string) {
    this.setKey("activeDialog", { kind: "checkout", projectPath, branchName });
  }

  async confirmCheckout(args: Extract<GitWorkspaceApiRequest, { operation: "checkout_existing_branch" }>) {
    return this.runOperation(args, (payload) => ({
      activeDialog: null,
      snapshotsByProject: payload.snapshot
        ? { ...this.getSnapshot().snapshotsByProject, [args.projectPath]: payload.snapshot }
        : this.getSnapshot().snapshotsByProject,
      selectedTargetsByProject: payload.target
        ? { ...this.getSnapshot().selectedTargetsByProject, [args.projectPath]: payload.target }
        : this.getSnapshot().selectedTargetsByProject,
    }));
  }

  requestStartInNewWorktree(projectPath: string) {
    this.setKey("activeDialog", { kind: "start_new_worktree", projectPath });
  }

  confirmStartInNewWorktree(request: GitWorkspaceLaunchRequest) {
    this.patch((current) => ({
      activeDialog: null,
      pendingLaunchByProject: {
        ...current.pendingLaunchByProject,
        [request.projectPath]: request,
      },
      lastError: null,
    }));
  }

  requestCreateWorktree(projectPath: string, branchName?: string) {
    this.setKey("activeDialog", { kind: "create_worktree", projectPath, branchName });
  }

  async confirmCreateWorktree(args: Extract<GitWorkspaceApiRequest, { operation: "create_worktree_existing_branch" | "prepare_session_worktree" }>) {
    return this.runOperation(args, (payload) => ({
      activeDialog: null,
      selectedTargetsByProject: payload.target
        ? { ...this.getSnapshot().selectedTargetsByProject, [args.projectPath]: payload.target }
        : this.getSnapshot().selectedTargetsByProject,
      snapshotsByProject: payload.snapshot
        ? { ...this.getSnapshot().snapshotsByProject, [args.projectPath]: payload.snapshot }
        : this.getSnapshot().snapshotsByProject,
    }));
  }

  requestRemoveWorktree(projectPath: string, checkoutPath: string) {
    this.setKey("activeDialog", { kind: "remove_worktree", projectPath, checkoutPath });
  }

  async confirmRemoveWorktree(args: Extract<GitWorkspaceApiRequest, { operation: "remove_worktree" }>) {
    return this.runOperation(args, (payload) => ({
      activeDialog: null,
      snapshotsByProject: payload.snapshot
        ? { ...this.getSnapshot().snapshotsByProject, [args.projectPath]: payload.snapshot }
        : this.getSnapshot().snapshotsByProject,
    }));
  }

  consumePendingLaunch(projectPath: string) {
    const launch = this.getSnapshot().pendingLaunchByProject[projectPath];
    if (!launch) {
      return null;
    }
    this.patch((current) => ({
      pendingLaunchByProject: omitKey(current.pendingLaunchByProject, projectPath),
    }));
    return launch;
  }

  clearError() {
    this.setKey("lastError", null);
  }

  requestForkMessageWorktree(projectPath: string, runId: string, targetMessageId: string, content: string) {
    this.setKey("activeDialog", { kind: "fork_message_worktree", projectPath, runId, targetMessageId, content });
  }

  private async runOperation(
    request: GitWorkspaceApiRequest,
    applyPayload: (payload: GitWorkspaceApiResponse) => Partial<GitWorkspaceManagerState>,
  ) {
    this.patch({ pendingOperation: request.operation, lastError: null });
    try {
      const payload = await this.api(request);
      this.patch({
        ...applyPayload(payload),
        pendingOperation: null,
        lastError: null,
      });
      return payload;
    } catch (error) {
      this.patch({
        pendingOperation: null,
        lastError: toErrorState(error),
      });
      throw error;
    }
  }
}

export const gitWorkspaceManager = new GitWorkspaceManager();
