import { describe, expect, it, vi } from "vitest";
import { ClaudeAccountAuthManager } from "@/interface/home/ClaudeAccountAuthManager";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function operation(accountId: string, phase = "authenticating") {
  return {
    account: { id: accountId, status: phase },
    operation: {
      id: `operation-${accountId}`,
      accountId,
      phase,
      startedAt: "2026-08-21T10:00:00.000Z",
      deadlineAt: "2026-08-21T10:10:00.000Z",
      error: null,
      terminal: phase === "authenticating" ? { id: `terminal-${accountId}` } : null,
    },
  };
}

function api(overrides: Record<string, unknown> = {}) {
  return {
    connectClaude: vi.fn().mockResolvedValue(operation("account-a")),
    signInClaude: vi.fn().mockResolvedValue(operation("local-session-claude")),
    getAuthOperation: vi.fn().mockResolvedValue(operation("account-a")),
    actOnAuthOperation: vi.fn().mockResolvedValue(operation("account-a", "cancelled")),
    logout: vi.fn().mockResolvedValue({ account: { id: "account-a", status: "login_required" } }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    purge: vi.fn().mockResolvedValue({ ok: true }),
    refreshStatus: vi.fn().mockResolvedValue({ id: "account-a", status: "available" }),
    ...overrides,
  };
}

describe("ClaudeAccountAuthManager", () => {
  it("starts an in-app login and keeps the managed terminal attached", async () => {
    const accounts = api();
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");
    manager.patchDraft({ label: "Personal Max", email: "person@example.com", sso: true });

    await manager.begin();

    expect(accounts.connectClaude).toHaveBeenCalledWith({
      label: "Personal Max",
      email: "person@example.com",
      sso: true,
    });
    expect(manager.getSnapshot()).toMatchObject({
      open: true,
      accountId: "account-a",
      phase: "authenticating",
      terminalId: "terminal-account-a",
      pending: false,
    });
  });

  it("starts the normal Claude sign-in without asking for an account label first", async () => {
    const accounts = api();
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");

    await manager.beginLocalSignIn();

    expect(accounts.signInClaude).toHaveBeenCalledWith();
    expect(accounts.connectClaude).not.toHaveBeenCalled();
    expect(manager.getSnapshot()).toMatchObject({
      open: true,
      accountId: "local-session-claude",
      phase: "authenticating",
      terminalId: "terminal-local-session-claude",
      label: "",
      email: "",
      sso: false,
    });
  });

  it("closing the dialog does not cancel the server-owned operation", async () => {
    const accounts = api();
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");
    await manager.begin();

    manager.setOpen(false);

    expect(accounts.actOnAuthOperation).not.toHaveBeenCalled();
    expect(manager.getSnapshot()).toMatchObject({
      open: false,
      accountId: "account-a",
      phase: "authenticating",
    });
  });

  it("only cancels after an explicit cancel action", async () => {
    const accounts = api();
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");
    await manager.begin();

    await manager.cancel();

    expect(accounts.actOnAuthOperation).toHaveBeenCalledWith({ accountId: "account-a", action: "cancel" });
    expect(manager.getSnapshot()).toMatchObject({ phase: "cancelled", terminalId: null });
  });

  it("resumes an existing operation by account id", async () => {
    const accounts = api({
      getAuthOperation: vi.fn().mockResolvedValue(operation("account-existing")),
    });
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");

    await manager.resume("account-existing");

    expect(accounts.getAuthOperation).toHaveBeenCalledWith({ accountId: "account-existing" });
    expect(manager.getSnapshot()).toMatchObject({
      open: true,
      accountId: "account-existing",
      terminalId: "terminal-account-existing",
    });
  });

  it("starts sign-in immediately when a revoked account has no live operation", async () => {
    const accounts = api({
      getAuthOperation: vi.fn().mockResolvedValue({
        account: { id: "account-revoked", status: "login_required" },
        operation: null,
      }),
      actOnAuthOperation: vi.fn().mockResolvedValue(operation("account-revoked")),
    });
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");

    await manager.resume("account-revoked");

    expect(accounts.actOnAuthOperation).toHaveBeenCalledWith({
      accountId: "account-revoked",
      action: "retry",
    });
    expect(manager.getSnapshot()).toMatchObject({
      open: true,
      accountId: "account-revoked",
      phase: "authenticating",
      terminalId: "terminal-account-revoked",
    });
  });

  it("ignores a stale response after switching runners", async () => {
    const response = deferred<ReturnType<typeof operation>>();
    const accounts = api({ connectClaude: vi.fn().mockReturnValue(response.promise) });
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");

    const begin = manager.begin();
    manager.configureScope("runner-b");
    response.resolve(operation("account-from-runner-a"));
    await begin;

    expect(manager.getSnapshot()).toMatchObject({
      runnerScope: "runner-b",
      accountId: null,
      phase: "idle",
      terminalId: null,
      pending: false,
    });
  });

  it("lets the newest request own the state", async () => {
    const first = deferred<ReturnType<typeof operation>>();
    const second = deferred<ReturnType<typeof operation>>();
    const accounts = api({
      getAuthOperation: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    });
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");

    const older = manager.resume("account-old");
    const newer = manager.resume("account-new");
    second.resolve(operation("account-new"));
    await newer;
    first.resolve(operation("account-old"));
    await older;

    expect(manager.getSnapshot()).toMatchObject({ accountId: "account-new", terminalId: "terminal-account-new" });
  });

  it("polls verification to completion after the managed terminal exits", async () => {
    const accounts = api({
      getAuthOperation: vi.fn()
        .mockResolvedValueOnce(operation("account-a", "verifying"))
        .mockResolvedValueOnce(operation("account-a", "completed")),
    });
    const manager = new ClaudeAccountAuthManager(accounts, async () => undefined);
    manager.configureScope("runner-a");
    await manager.begin();

    await manager.refreshAfterTerminalExit();

    expect(accounts.getAuthOperation).toHaveBeenCalledTimes(2);
    expect(manager.getSnapshot()).toMatchObject({ phase: "completed", terminalId: null });
  });

  it("keeps destructive purge confirmation in the manager and submits the exact typed id", async () => {
    const accounts = api();
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");
    manager.openPurge("account-a");
    manager.setPurgeConfirmation("account-a");

    await manager.confirmPurge();

    expect(accounts.purge).toHaveBeenCalledWith({ accountId: "account-a", confirmAccountId: "account-a" });
    expect(manager.getSnapshot()).toMatchObject({ purgeAccountId: null, purgeConfirmation: "" });
  });

  it("requires an explicit manager-owned confirmation before unregistering", async () => {
    const accounts = api();
    const manager = new ClaudeAccountAuthManager(accounts);
    manager.configureScope("runner-a");
    manager.openRemove("account-a");

    await manager.confirmRemove();

    expect(accounts.remove).toHaveBeenCalledWith({ accountId: "account-a" });
    expect(manager.getSnapshot().removeAccountId).toBeNull();
  });
});
