import { afterEach, describe, expect, it, vi } from "vitest";
import { GitWorkspaceManager } from "@/app/home/GitWorkspaceManager";
import type { GitWorkspaceSnapshot, GitWorkspaceTarget } from "@/lib/git-workspace";

const CACHE_STORAGE_KEY = "omni-git-workspace-cache:v1";

function installLocalStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  } satisfies Storage;
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

function target(overrides: Partial<GitWorkspaceTarget> = {}): GitWorkspaceTarget {
  return {
    kind: "worktree",
    repoRoot: "/repo",
    gitCommonDir: "/repo/.git",
    checkoutPath: "/repo-feature",
    branchName: "feature/test",
    worktreeId: "/repo-feature",
    ...overrides,
  };
}

function snapshot(overrides: Partial<GitWorkspaceSnapshot> = {}): GitWorkspaceSnapshot {
  return {
    repoRoot: "/repo",
    gitCommonDir: "/repo/.git",
    checkoutPath: "/repo",
    headSha: "abc123",
    branchName: "main",
    detachedLabel: null,
    isDetached: false,
    isBare: false,
    dirtyFileCount: 0,
    conflictedFileCount: 0,
    aheadCount: 0,
    behindCount: 0,
    statusFingerprint: "fingerprint",
    branches: [],
    worktrees: [],
    warnings: [],
    refreshedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("GitWorkspaceManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads status through the git API and stores the snapshot by project", async () => {
    const api = vi.fn().mockResolvedValue({ snapshot: snapshot() });
    const manager = new GitWorkspaceManager(api);

    await manager.loadStatus("/repo");

    expect(api).toHaveBeenCalledWith({ operation: "status", projectPath: "/repo" });
    expect(manager.getSnapshot().snapshotsByProject["/repo"]?.branchName).toBe("main");
    expect(manager.getSnapshot().loadingByProject["/repo"]).toBe(false);
  });

  it("hydrates the last good workspace snapshot from browser cache while refreshing", async () => {
    const cachedSnapshot = snapshot({ branchName: "cached" });
    const cachedTarget = target({ branchName: "cached", checkoutPath: "/repo-cached", worktreeId: "/repo-cached" });
    installLocalStorage({
      [CACHE_STORAGE_KEY]: JSON.stringify({
        projects: {
          "/repo": {
            snapshot: cachedSnapshot,
            selectedTarget: cachedTarget,
            savedAt: new Date().toISOString(),
          },
        },
      }),
    });
    let resolveApi: (payload: { snapshot: GitWorkspaceSnapshot }) => void = () => undefined;
    const api = vi.fn(() => new Promise<{ snapshot: GitWorkspaceSnapshot }>((resolve) => {
      resolveApi = resolve;
    }));
    const manager = new GitWorkspaceManager(api);

    const loading = manager.loadStatus("/repo");

    expect(manager.getSnapshot().snapshotsByProject["/repo"]?.branchName).toBe("cached");
    expect(manager.getSnapshot().selectedTargetsByProject["/repo"]).toEqual(cachedTarget);
    expect(manager.getSnapshot().loadingByProject["/repo"]).toBe(true);

    resolveApi({ snapshot: snapshot({ branchName: "fresh" }) });
    await loading;

    expect(manager.getSnapshot().snapshotsByProject["/repo"]?.branchName).toBe("fresh");
    expect(manager.getSnapshot().loadingByProject["/repo"]).toBe(false);
  });

  it("persists refreshed snapshots for future immediate workspace labels", async () => {
    const localStorage = installLocalStorage();
    const selected = target({ branchName: "feature/cache" });
    const refreshed = snapshot({ branchName: "feature/cache" });
    const api = vi.fn().mockResolvedValue({ target: selected, snapshot: refreshed });
    const manager = new GitWorkspaceManager(api);

    await manager.selectTarget("/repo", selected);

    const cached = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) ?? "{}");
    expect(cached.projects["/repo"].snapshot.branchName).toBe("feature/cache");
    expect(cached.projects["/repo"].selectedTarget.branchName).toBe("feature/cache");
  });

  it("selects a target only after the API validates it", async () => {
    const selected = target();
    const refreshed = snapshot({ worktrees: [{ ...selected, headSha: "abc123", detachedLabel: null, isCurrent: false, isDetached: false, isBare: false, isPrunable: false, dirtyFileCount: 0, conflictedFileCount: 0 }] });
    const api = vi.fn().mockResolvedValue({ target: selected, snapshot: refreshed });
    const manager = new GitWorkspaceManager(api);

    await manager.selectTarget("/repo", selected);

    expect(api).toHaveBeenCalledWith({ operation: "select", projectPath: "/repo", target: selected });
    expect(manager.getSnapshot().selectedTargetsByProject["/repo"]).toEqual(selected);
    expect(manager.getSnapshot().snapshotsByProject["/repo"]).toEqual(refreshed);
  });

  it("stores a confirmed new-worktree launch request separately from selected targets", () => {
    const manager = new GitWorkspaceManager();
    manager.confirmStartInNewWorktree({
      mode: "new_worktree",
      projectPath: "/repo",
      newBranchName: "feature/new-session",
      checkoutPath: "/repo-new-session",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });

    expect(manager.getSnapshot().pendingLaunchByProject["/repo"]?.newBranchName).toBe("feature/new-session");
    expect(manager.getSnapshot().selectedTargetsByProject["/repo"]).toBeUndefined();

    const launch = manager.consumePendingLaunch("/repo");
    expect(launch?.checkoutPath).toBe("/repo-new-session");
    expect(manager.getSnapshot().pendingLaunchByProject["/repo"]).toBeUndefined();
  });

  it("confirms checkout through the API and closes the checkout dialog", async () => {
    const selected = target({ kind: "current_checkout", checkoutPath: "/repo", branchName: "next", worktreeId: null });
    const refreshed = snapshot({ branchName: "next" });
    const api = vi.fn().mockResolvedValue({ target: selected, snapshot: refreshed });
    const manager = new GitWorkspaceManager(api);

    manager.requestCheckout("/repo", "next");
    await manager.confirmCheckout({
      operation: "checkout_existing_branch",
      projectPath: "/repo",
      branchName: "next",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });

    expect(api).toHaveBeenCalledWith({
      operation: "checkout_existing_branch",
      projectPath: "/repo",
      branchName: "next",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });
    expect(manager.getSnapshot().activeDialog).toBeNull();
    expect(manager.getSnapshot().selectedTargetsByProject["/repo"]).toEqual(selected);
    expect(manager.getSnapshot().snapshotsByProject["/repo"]).toEqual(refreshed);
  });

  it("creates a worktree for an existing branch and selects the returned target", async () => {
    const selected = target({ checkoutPath: "/repo-next", branchName: "next", worktreeId: "/repo-next" });
    const refreshed = snapshot({ worktrees: [{ ...selected, headSha: "abc123", detachedLabel: null, isCurrent: false, isDetached: false, isBare: false, isPrunable: false, dirtyFileCount: 0, conflictedFileCount: 0 }] });
    const api = vi.fn().mockResolvedValue({ target: selected, snapshot: refreshed });
    const manager = new GitWorkspaceManager(api);

    manager.requestCreateWorktree("/repo", "next");
    await manager.confirmCreateWorktree({
      operation: "create_worktree_existing_branch",
      projectPath: "/repo",
      branchName: "next",
      checkoutPath: "/repo-next",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });

    expect(api).toHaveBeenCalledWith({
      operation: "create_worktree_existing_branch",
      projectPath: "/repo",
      branchName: "next",
      checkoutPath: "/repo-next",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });
    expect(manager.getSnapshot().activeDialog).toBeNull();
    expect(manager.getSnapshot().selectedTargetsByProject["/repo"]).toEqual(selected);
  });

  it("removes a clean worktree through the API without changing the selected target", async () => {
    const selected = target();
    const refreshed = snapshot({ worktrees: [] });
    const api = vi.fn()
      .mockResolvedValueOnce({ target: selected, snapshot: snapshot() })
      .mockResolvedValueOnce({ snapshot: refreshed });
    const manager = new GitWorkspaceManager(api);
    await manager.selectTarget("/repo", selected);
    api.mockClear();

    manager.requestRemoveWorktree("/repo", "/repo-feature");
    await manager.confirmRemoveWorktree({
      operation: "remove_worktree",
      projectPath: "/repo",
      checkoutPath: "/repo-feature",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });

    expect(api).toHaveBeenCalledWith({
      operation: "remove_worktree",
      projectPath: "/repo",
      checkoutPath: "/repo-feature",
      expectedHeadSha: "abc123",
      expectedStatusFingerprint: "fingerprint",
    });
    expect(manager.getSnapshot().activeDialog).toBeNull();
    expect(manager.getSnapshot().snapshotsByProject["/repo"]).toEqual(refreshed);
    expect(manager.getSnapshot().selectedTargetsByProject["/repo"]).toEqual(selected);
  });

  it("captures structured API errors without replacing the last good snapshot", async () => {
    const manager = new GitWorkspaceManager(vi.fn()
      .mockResolvedValueOnce({ snapshot: snapshot() })
      .mockRejectedValueOnce(new Error("Repository status changed after confirmation.")));

    await manager.loadStatus("/repo");
    await expect(manager.selectTarget("/repo", target())).rejects.toThrow("Repository status changed after confirmation.");

    expect(manager.getSnapshot().snapshotsByProject["/repo"]?.statusFingerprint).toBe("fingerprint");
    expect(manager.getSnapshot().lastError?.message).toBe("Repository status changed after confirmation.");
  });
});
