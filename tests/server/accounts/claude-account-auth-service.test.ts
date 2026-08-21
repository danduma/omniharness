import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import {
  ClaudeAccountAuthService,
  type ClaudeAccountAuthServiceDependencies,
} from "@/server/accounts/claude-account-auth-service";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import type { TerminalExit } from "@/server/terminal/terminal-manager";

class FakeManagedTerminal {
  readonly created: Array<{
    id: string;
    accountId: string;
    operationId: string;
    ownerSessionId: string;
    cwd: string;
    env: Record<string, string>;
    onExit?: (exit: TerminalExit) => void;
  }> = [];

  createManagedTerminal(options: {
    accountId: string;
    operationId: string;
    ownerSessionId: string;
    cwd: string;
    env: Record<string, string>;
    onExit?: (exit: TerminalExit) => void;
  }) {
    const created = {
      id: `term-${this.created.length + 1}`,
      accountId: options.accountId,
      operationId: options.operationId,
      ownerSessionId: options.ownerSessionId,
      cwd: options.cwd,
      env: options.env,
      onExit: options.onExit,
    };
    this.created.push(created);
    return { id: created.id, cols: 100, rows: 30 };
  }

  kill() {
    return true;
  }

  releaseLifecycleOwner() {
    return true;
  }
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for authentication transition.");
}

function createService(overrides: Partial<ClaudeAccountAuthServiceDependencies> = {}) {
  const terminals = new FakeManagedTerminal();
  const root = mkdtempSync(join(tmpdir(), "omni-claude-auth-service-"));
  const service = new ClaudeAccountAuthService({
    terminalManager: terminals,
    instanceRoot: root,
    runnerInstanceId: "runner-test",
    binary: "/usr/bin/claude-test",
    env: { PATH: "/usr/bin", HOME: root },
    assertCapability: async () => undefined,
    probeStatus: async () => ({
      loggedIn: true,
      email: "person@example.com",
      subscriptionType: "max",
      authMethod: "claude.ai",
    }),
    runCommand: async () => ({ stdout: "", stderr: "" }),
    quiesceAccount: async (accountId) => ({
      ok: true,
      accountId,
      fenced: true,
      prewarmedEvicted: 0,
      startingCount: 0,
      startingAgents: [],
      liveAgents: [],
    }),
    resumeAccount: async (accountId) => ({ ok: true, accountId, fenced: false }),
    ...overrides,
  });
  return { service, terminals, root };
}

describe("Claude account authentication service", () => {
  beforeEach(async () => {
    await db.delete(accounts).where(like(accounts.id, "claude-managed-%"));
    __resetNamedEventsForTests();
  });

  it("creates a disabled account, owns the login PTY, verifies status, and enables the account", async () => {
    const { service, terminals } = createService();
    const started = await service.connect({
      label: "Personal Max",
      email: "person@example.com",
      sso: true,
      ownerSessionId: "session-a",
    });

    expect(started.account).toMatchObject({
      label: "Personal Max",
      authMode: "isolated_cli_home",
      enabled: false,
      status: "authenticating",
    });
    expect(started.operation).toMatchObject({ phase: "authenticating", terminal: { id: "term-1" } });
    expect(terminals.created[0]).toMatchObject({
      accountId: started.account.id,
      operationId: started.operation.id,
      ownerSessionId: "session-a",
    });

    terminals.created[0].onExit?.({ exitCode: 0 });
    await waitFor(async () => {
      const row = await db.select().from(accounts).where(eq(accounts.id, started.account.id)).get();
      return row?.status === "available";
    });

    const row = await db.select().from(accounts).where(eq(accounts.id, started.account.id)).get();
    expect(row).toMatchObject({ enabled: true, status: "available", lifecycleOperationId: null });
    expect(JSON.parse(row!.metadataJson!)).toMatchObject({
      identity: { email: "person@example.com", subscriptionType: "max" },
    });
    const eventKinds = getNamedEventsSince(0).events.map((entry) => entry.event.kind);
    expect(eventKinds).toEqual(expect.arrayContaining([
      "account.auth_started",
      "account.auth_terminal_ready",
      "account.auth_verifying",
      "account.auth_completed",
    ]));
  });

  it("does not expose a managed terminal to another authenticated session", async () => {
    const { service } = createService();
    const started = await service.connect({ label: "Work", ownerSessionId: "session-a" });

    expect((await service.getOperation(started.account.id, "session-a")).operation?.terminal).toEqual({ id: "term-1" });
    expect((await service.getOperation(started.account.id, "session-b")).operation?.terminal).toBeNull();
    await expect(service.act(started.account.id, "cancel", "session-b")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("repairs an existing local-session account in the exact profile workers use", async () => {
    const assertCapability = vi.fn(async () => undefined);
    const probeStatus = vi.fn(async () => ({
      loggedIn: true,
      email: "local@example.com",
      subscriptionType: "max",
      authMethod: "claude.ai",
    }));
    const { service, terminals, root } = createService({ assertCapability, probeStatus });
    const accountId = "claude-managed-local-session";
    await db.insert(accounts).values({
      id: accountId,
      cliType: "claude",
      provider: "anthropic",
      type: "subscription",
      label: "Local Claude",
      authMode: "local_session",
      authRef: "local-session",
      enabled: false,
      status: "login_required",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const started = await service.act(accountId, "retry", "session-a");

    expect(terminals.created[0]).toMatchObject({
      accountId,
      cwd: root,
      env: { CLAUDE_CONFIG_DIR: join(root, ".claude") },
    });
    expect(assertCapability).toHaveBeenCalledWith(join(root, ".claude"), false);

    terminals.created[0].onExit?.({ exitCode: 0 });
    await waitFor(async () => (
      await db.select().from(accounts).where(eq(accounts.id, accountId)).get()
    )?.status === "available");

    expect(probeStatus).toHaveBeenCalledWith(join(root, ".claude"));
    expect((await service.getOperation(accountId, "session-a")).account).toMatchObject({
      enabled: true,
      status: "available",
      authMode: "local_session",
    });
    expect(started.operation).toMatchObject({ phase: "authenticating" });
  });

  it("cancels explicitly and leaves the account disabled and login-required", async () => {
    const { service } = createService();
    const started = await service.connect({ label: "Work", ownerSessionId: "session-a" });
    const result = await service.act(started.account.id, "cancel", "session-a");

    expect(result.account).toMatchObject({ enabled: false, status: "login_required" });
    expect(result.operation).toMatchObject({ phase: "cancelled", terminal: null });
    expect(getNamedEventsSince(0).events.map((entry) => entry.event.kind)).toContain("account.auth_cancelled");
  });

  it("times out and kills a login operation that never exits", async () => {
    const scheduled: { timeout: (() => void) | null } = { timeout: null };
    const { service } = createService({
      scheduleTimeout: (callback) => {
        scheduled.timeout = callback;
        return { cancel: vi.fn() };
      },
    });
    const started = await service.connect({ label: "Timeout", ownerSessionId: "session-a" });

    scheduled.timeout?.();
    await waitFor(async () => (await db.select().from(accounts).where(eq(accounts.id, started.account.id)).get())?.status === "auth_failed");

    expect((await service.getOperation(started.account.id, "session-a")).operation).toMatchObject({
      phase: "failed",
      error: { code: "account.auth.timeout" },
      terminal: null,
    });
  });

  it("refuses a concurrent login operation instead of starting a second PTY", async () => {
    const { service, terminals } = createService();
    await service.connect({ label: "First", ownerSessionId: "session-a" });

    await expect(service.connect({ label: "Second", ownerSessionId: "session-a" })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(terminals.created).toHaveLength(1);
    expect(getNamedEventsSince(0).events.map((entry) => entry.event.kind)).toContain("account.auth_retry_refused");
  });

  it("fails closed unless fresh Claude config directories stay logged out before and after login", async () => {
    const statusConfigDirs: string[] = [];
    const { service, terminals } = createService({
      assertCapability: undefined,
      runCommand: async (args, configDir) => {
        if (args[0] === "--version") return { stdout: "2.1.238 (Claude Code)", stderr: "" };
        if (args.join(" ") === "auth login --help") return { stdout: "--claudeai --email --sso", stderr: "" };
        if (args.join(" ") === "auth status --help") return { stdout: "--json", stderr: "" };
        if (args.join(" ") === "auth status --json") {
          statusConfigDirs.push(configDir);
          return { stdout: JSON.stringify({ loggedIn: false }), stderr: "" };
        }
        return { stdout: "", stderr: "" };
      },
    });

    const started = await service.connect({ label: "Isolated", ownerSessionId: "session-a" });
    terminals.created[0].onExit?.({ exitCode: 0 });
    await waitFor(async () => (await db.select().from(accounts).where(eq(accounts.id, started.account.id)).get())?.status === "available");

    expect(statusConfigDirs).toHaveLength(4);
    expect(new Set(statusConfigDirs).size).toBe(4);
    expect(statusConfigDirs.every((configDir) => configDir.includes("sentinel-"))).toBe(true);
  });

  it("logs out through the scoped Claude CLI and leaves the account login-required", async () => {
    const commandCalls: string[][] = [];
    const bridgeCalls: string[] = [];
    const { service, terminals } = createService({
      runCommand: async (args) => {
        commandCalls.push([...args]);
        return { stdout: "", stderr: "" };
      },
      quiesceAccount: async (accountId) => {
        bridgeCalls.push(`quiesce:${accountId}`);
        return { ok: true, accountId, fenced: true, prewarmedEvicted: 0, startingCount: 0, startingAgents: [], liveAgents: [] };
      },
      resumeAccount: async (accountId) => {
        bridgeCalls.push(`resume:${accountId}`);
        return { ok: true, accountId, fenced: false };
      },
    });
    const started = await service.connect({ label: "Work", ownerSessionId: "session-a" });
    terminals.created[0].onExit?.({ exitCode: 0 });
    await waitFor(async () => (await db.select().from(accounts).where(eq(accounts.id, started.account.id)).get())?.status === "available");

    const result = await service.logout(started.account.id);

    expect(commandCalls).toContainEqual(["auth", "logout"]);
    expect(bridgeCalls).toEqual([`quiesce:${started.account.id}`, `resume:${started.account.id}`]);
    expect(result.account).toMatchObject({ enabled: false, status: "login_required" });
    expect(getNamedEventsSince(0).events.map((entry) => entry.event.kind)).toEqual(expect.arrayContaining([
      "account.logout_started",
      "account.logout_completed",
    ]));
  });

  it("normalizes an already logged-out isolated profile without invoking logout", async () => {
    const commandCalls: string[][] = [];
    const { service } = createService({
      probeStatus: async () => ({ loggedIn: false }),
      runCommand: async (args) => {
        commandCalls.push([...args]);
        return { stdout: "", stderr: "" };
      },
    });
    const started = await service.connect({ label: "Logged out", ownerSessionId: "session-a" });
    await service.act(started.account.id, "cancel", "session-a");
    await db.update(accounts).set({ enabled: true, status: "unknown" }).where(eq(accounts.id, started.account.id));

    const result = await service.logout(started.account.id);

    expect(commandCalls).toEqual([]);
    expect(result.account).toMatchObject({ enabled: false, status: "login_required" });
  });

  it("fences before destructive work and refuses while the bridge reports a live account worker", async () => {
    const resumed: string[] = [];
    const { service } = createService({
      quiesceAccount: async (accountId) => ({
        ok: true,
        accountId,
        fenced: true,
        prewarmedEvicted: 1,
        startingCount: 0,
        startingAgents: [],
        liveAgents: [{ name: "worker-live", state: "working" }],
      }),
      resumeAccount: async (accountId) => {
        resumed.push(accountId);
        return { ok: true, accountId, fenced: false };
      },
    });
    const started = await service.connect({ label: "Busy", ownerSessionId: "session-a" });
    await service.act(started.account.id, "cancel", "session-a");

    await expect(service.remove(started.account.id)).rejects.toMatchObject({ statusCode: 409 });

    expect(await db.select().from(accounts).where(eq(accounts.id, started.account.id)).get()).toMatchObject({
      status: "login_required",
      enabled: false,
      lifecycleOperationId: null,
    });
    expect(resumed).toEqual([started.account.id]);
    expect(getNamedEventsSince(0).events.map((entry) => entry.event.kind)).toContain("account.remove_refused");
  });

  it("removes inventory while preserving profile data and purges only after exact confirmation", async () => {
    const first = createService();
    const removable = await first.service.connect({ label: "Keep files", ownerSessionId: "session-a" });
    await first.service.act(removable.account.id, "cancel", "session-a");
    const preservedPath = join(first.root, "account-cli-homes", "claude", removable.account.id);

    const removed = await first.service.remove(removable.account.id);
    expect(removed).toEqual({ ok: true, accountId: removable.account.id, profileDataPreserved: true });
    expect(await db.select().from(accounts).where(eq(accounts.id, removable.account.id)).get()).toBeUndefined();
    expect(() => statSync(preservedPath)).not.toThrow();

    const second = createService();
    const purgeable = await second.service.connect({ label: "Delete files", ownerSessionId: "session-a" });
    await second.service.act(purgeable.account.id, "cancel", "session-a");
    const purgedPath = join(second.root, "account-cli-homes", "claude", purgeable.account.id);
    await expect(second.service.purge(purgeable.account.id, { purge: true, confirmAccountId: "wrong" }))
      .rejects.toMatchObject({ statusCode: 400 });

    const purged = await second.service.purge(purgeable.account.id, {
      purge: true,
      confirmAccountId: purgeable.account.id,
    });
    expect(purged).toEqual({ ok: true, accountId: purgeable.account.id, profileDataPurged: true });
    expect(await db.select().from(accounts).where(eq(accounts.id, purgeable.account.id)).get()).toBeUndefined();
    expect(() => statSync(purgedPath)).toThrow();
  });

  it("reconciles interrupted login and durable purge leases on runner startup", async () => {
    const login = createService({
      probeStatus: async () => ({ loggedIn: true, email: "recovered@example.com" }),
    });
    const interrupted = await login.service.connect({ label: "Interrupted", ownerSessionId: "session-a" });
    login.service.shutdown();

    await login.service.reconcileAtStartup();

    expect(await db.select().from(accounts).where(eq(accounts.id, interrupted.account.id)).get()).toMatchObject({
      status: "available",
      enabled: true,
      lifecycleOperationId: null,
    });

    const purge = createService();
    const purging = await purge.service.connect({ label: "Purging", ownerSessionId: "session-a" });
    await purge.service.act(purging.account.id, "cancel", "session-a");
    await db.update(accounts).set({
      enabled: false,
      status: "purging",
      lifecycleOperationId: "purge-crash",
      lifecycleOperationKind: "purge",
      lifecycleOperationOwner: "old-runner",
      lifecycleOperationStartedAt: new Date(),
    }).where(eq(accounts.id, purging.account.id));

    await purge.service.reconcileAtStartup();

    expect(await db.select().from(accounts).where(eq(accounts.id, purging.account.id)).get()).toBeUndefined();
    expect(getNamedEventsSince(0).events.map((entry) => entry.event.kind)).toContain("account.purge_completed");
  });
});
