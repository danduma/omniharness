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
  | { kind: "fork_session_worktree"; projectPath: string; runId: string; targetMessageId: string; content: string }
  | { kind: "fork_message_worktree"; projectPath: string; runId: string; targetMessageId: string; content: string };

export type GitWorkspaceErrorState = {
  message: string;
  details?: string[];
};

export type GitWorkspaceDialogDraft = {
  branchName: string;
  checkoutPath: string;
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
  dialogDraft: GitWorkspaceDialogDraft;
  lastErrorByProject: Record<string, GitWorkspaceErrorState | undefined>;
  lastError: GitWorkspaceErrorState | null;
};

const INITIAL_STATE: GitWorkspaceManagerState = {
  snapshotsByProject: {},
  selectedTargetsByProject: {},
  pendingLaunchByProject: {},
  loadingByProject: {},
  pendingOperation: null,
  activeDialog: null,
  dialogDraft: {
    branchName: "",
    checkoutPath: "",
  },
  lastErrorByProject: {},
  lastError: null,
};

const CACHE_STORAGE_KEY = "omni-git-workspace-cache:v1";
const CACHE_MAX_PROJECTS = 20;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedGitWorkspaceProject = {
  snapshot?: GitWorkspaceSnapshot;
  selectedTarget?: GitWorkspaceTarget;
  savedAt: string;
};

type CachedGitWorkspaceState = {
  projects: Record<string, CachedGitWorkspaceProject | undefined>;
};

function getCacheStorage(): Storage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  return window.localStorage;
}

function readCache(): CachedGitWorkspaceState {
  const storage = getCacheStorage();
  if (!storage) {
    return { projects: {} };
  }
  try {
    const raw = storage.getItem(CACHE_STORAGE_KEY);
    if (!raw) {
      return { projects: {} };
    }
    const parsed = JSON.parse(raw) as Partial<CachedGitWorkspaceState>;
    return parsed && typeof parsed === "object" && parsed.projects && typeof parsed.projects === "object"
      ? { projects: parsed.projects }
      : { projects: {} };
  } catch {
    return { projects: {} };
  }
}

function writeCache(cache: CachedGitWorkspaceState) {
  const storage = getCacheStorage();
  if (!storage) {
    return;
  }
  try {
    const entries = Object.entries(cache.projects)
      .filter((entry): entry is [string, CachedGitWorkspaceProject] => Boolean(entry[1]?.snapshot))
      .sort(([, first], [, second]) => Date.parse(second.savedAt) - Date.parse(first.savedAt))
      .slice(0, CACHE_MAX_PROJECTS);
    storage.setItem(CACHE_STORAGE_KEY, JSON.stringify({ projects: Object.fromEntries(entries) }));
  } catch {
    // The live git API remains the source of truth when browser storage is unavailable.
  }
}

function isFreshCachedProject(cached: CachedGitWorkspaceProject | undefined) {
  if (!cached?.snapshot) {
    return false;
  }
  const savedAt = Date.parse(cached.savedAt);
  return Number.isFinite(savedAt) && Date.now() - savedAt <= CACHE_MAX_AGE_MS;
}

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
  private requestSeq = 0;
  private readonly activeStatusRequestsByProject = new Map<string, number>();
  private readonly activeOperationsByProject = new Map<string, { id: number; operation: GitWorkspaceApiRequest["operation"] }>();

  constructor(api: GitWorkspaceApiClient = defaultGitWorkspaceApi) {
    super(INITIAL_STATE);
    this.api = api;
  }

  private nextRequestId() {
    this.requestSeq += 1;
    return this.requestSeq;
  }

  private currentPendingOperation() {
    const pending = Array.from(this.activeOperationsByProject.values());
    return pending[pending.length - 1]?.operation ?? null;
  }

  hydrateCachedProject(projectPath: string) {
    if (this.getSnapshot().snapshotsByProject[projectPath]) {
      return false;
    }
    const cached = readCache().projects[projectPath];
    if (!cached?.snapshot || !isFreshCachedProject(cached)) {
      return false;
    }
    const cachedSnapshot = cached.snapshot;
    this.patch((current) => ({
      snapshotsByProject: { ...current.snapshotsByProject, [projectPath]: cachedSnapshot },
      selectedTargetsByProject: cached.selectedTarget
        ? { ...current.selectedTargetsByProject, [projectPath]: cached.selectedTarget }
        : current.selectedTargetsByProject,
    }));
    return true;
  }

  async loadStatus(projectPath: string) {
    this.hydrateCachedProject(projectPath);
    const requestId = this.nextRequestId();
    this.activeStatusRequestsByProject.set(projectPath, requestId);
    this.patch((current) => ({
      loadingByProject: { ...current.loadingByProject, [projectPath]: true },
      lastErrorByProject: omitKey(current.lastErrorByProject, projectPath),
      lastError: null,
    }));
    try {
      const payload = await this.api({ operation: "status", projectPath });
      if (this.activeStatusRequestsByProject.get(projectPath) !== requestId) {
        return payload.snapshot ?? null;
      }
      this.activeStatusRequestsByProject.delete(projectPath);
      this.rememberCacheEntry(projectPath, payload.snapshot);
      this.patch((current) => ({
        snapshotsByProject: payload.snapshot
          ? { ...current.snapshotsByProject, [projectPath]: payload.snapshot }
          : current.snapshotsByProject,
        loadingByProject: { ...current.loadingByProject, [projectPath]: false },
        lastErrorByProject: omitKey(current.lastErrorByProject, projectPath),
        lastError: null,
      }));
      return payload.snapshot ?? null;
    } catch (error) {
      if (this.activeStatusRequestsByProject.get(projectPath) !== requestId) {
        throw error;
      }
      this.activeStatusRequestsByProject.delete(projectPath);
      const errorState = toErrorState(error);
      this.patch((current) => ({
        loadingByProject: { ...current.loadingByProject, [projectPath]: false },
        lastErrorByProject: { ...current.lastErrorByProject, [projectPath]: errorState },
        lastError: errorState,
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

  setDialogDraft(draft: GitWorkspaceDialogDraft) {
    this.setKey("dialogDraft", draft);
  }

  setDialogBranchName(branchName: string, fallbackCheckoutPath = "") {
    this.patch((current) => ({
      dialogDraft: {
        branchName,
        checkoutPath: current.dialogDraft.checkoutPath || fallbackCheckoutPath,
      },
    }));
  }

  setDialogCheckoutPath(checkoutPath: string) {
    this.patch((current) => ({
      dialogDraft: {
        ...current.dialogDraft,
        checkoutPath,
      },
    }));
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
      lastErrorByProject: omitKey(current.lastErrorByProject, request.projectPath),
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

  clearError(projectPath?: string) {
    if (!projectPath) {
      this.patch({ lastErrorByProject: {}, lastError: null });
      return;
    }

    this.patch((current) => ({
      lastErrorByProject: omitKey(current.lastErrorByProject, projectPath),
      lastError: current.lastErrorByProject[projectPath] === current.lastError ? null : current.lastError,
    }));
  }

  requestForkMessageWorktree(projectPath: string, runId: string, targetMessageId: string, content: string) {
    this.setKey("activeDialog", { kind: "fork_message_worktree", projectPath, runId, targetMessageId, content });
  }

  requestForkSessionWorktree(projectPath: string, runId: string, targetMessageId: string, content: string) {
    this.setKey("activeDialog", { kind: "fork_session_worktree", projectPath, runId, targetMessageId, content });
  }

  private async runOperation(
    request: GitWorkspaceApiRequest,
    applyPayload: (payload: GitWorkspaceApiResponse) => Partial<GitWorkspaceManagerState>,
  ) {
    const requestId = this.nextRequestId();
    this.activeOperationsByProject.set(request.projectPath, { id: requestId, operation: request.operation });
    this.patch((current) => ({
      pendingOperation: this.currentPendingOperation(),
      lastErrorByProject: omitKey(current.lastErrorByProject, request.projectPath),
      lastError: null,
    }));
    try {
      const payload = await this.api(request);
      if (this.activeOperationsByProject.get(request.projectPath)?.id !== requestId) {
        return payload;
      }
      this.activeOperationsByProject.delete(request.projectPath);
      this.rememberCacheEntry(request.projectPath, payload.snapshot, payload.target);
      this.patch({
        ...applyPayload(payload),
        pendingOperation: this.currentPendingOperation(),
        lastErrorByProject: omitKey(this.getSnapshot().lastErrorByProject, request.projectPath),
        lastError: null,
      });
      return payload;
    } catch (error) {
      if (this.activeOperationsByProject.get(request.projectPath)?.id !== requestId) {
        throw error;
      }
      this.activeOperationsByProject.delete(request.projectPath);
      const errorState = toErrorState(error);
      this.patch({
        pendingOperation: this.currentPendingOperation(),
        lastErrorByProject: { ...this.getSnapshot().lastErrorByProject, [request.projectPath]: errorState },
        lastError: errorState,
      });
      throw error;
    }
  }

  private rememberCacheEntry(projectPath: string, snapshot?: GitWorkspaceSnapshot, selectedTarget?: GitWorkspaceTarget) {
    if (!snapshot) {
      return;
    }
    const currentSelectedTarget = selectedTarget ?? this.getSnapshot().selectedTargetsByProject[projectPath];
    const cache = readCache();
    cache.projects[projectPath] = {
      snapshot,
      selectedTarget: currentSelectedTarget,
      savedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }
}

export const gitWorkspaceManager = new GitWorkspaceManager();
