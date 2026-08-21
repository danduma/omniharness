import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountSecrets,
  accountUsageSnapshots,
  accounts,
  creditEvents,
  runs,
  settings,
  workerCredentialAllocations,
  workers,
  workerTokenUsage,
} from "@/server/db/schema";
import { toAccountDto, type AccountDto } from "@/server/accounts/dto";
import {
  assertClaudeLoginInput,
  buildClaudeAuthChildEnv,
  buildClaudeLoginArgs,
  claudeSafeIdentity,
  CLAUDE_LOGOUT_ARGS,
  CLAUDE_STATUS_ARGS,
  parseClaudeAuthStatus,
  type ClaudeAuthStatus,
} from "@/server/accounts/claude-auth-contract";
import {
  assertSafePurgeTarget,
  ensurePrivateClaudeConfigDir,
  resolveAccountCliHome,
  resolveClaudeConfigDir,
} from "@/server/accounts/cli-home";
import { deletedAccountSettingKey } from "@/server/accounts/migration";
import { repairAccountsFromCredentialVerificationHistory } from "@/server/accounts/login-required";
import { RuntimeHttpError } from "@/server/agent-runtime/types";
import { resolveCommand, withManagedPath } from "@/server/agent-runtime/tool-env";
import { emitNamedEvent } from "@/server/events/named-events";
import { ensureRunnerIdentity } from "@/server/runner/identity";
import {
  getTerminalManager,
  type CreatedTerminal,
  type TerminalExit,
} from "@/server/terminal/terminal-manager";
import {
  quiesceAccount as quiesceBridgeAccount,
  resumeAccount as resumeBridgeAccount,
  type AccountQuiesceResult,
} from "@/server/bridge-client";

const execFileAsync = promisify(execFile);
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const COMMAND_TIMEOUT_MS = 10_000;
const COMMAND_MAX_BUFFER = 256 * 1024;

export type ClaudeAccountAuthPhase =
  | "authenticating"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type ClaudeAccountAuthOperationDto = {
  id: string;
  accountId: string;
  phase: ClaudeAccountAuthPhase;
  startedAt: string;
  deadlineAt: string;
  error: { code: string; message: string } | null;
  terminal: { id: string } | null;
};

type OperationRecord = Omit<ClaudeAccountAuthOperationDto, "terminal"> & {
  terminalId: string | null;
  ownerSessionId: string;
  timeout: { cancel(): void } | null;
};

type ManagedTerminalOwner = {
  createManagedTerminal(options: {
    command: string;
    args: string[];
    env: Record<string, string>;
    cwd: string;
    cols?: number;
    rows?: number;
    ownerSessionId: string;
    runnerInstanceId: string;
    accountId: string;
    operationId: string;
    onExit?: (exit: TerminalExit) => void;
  }): CreatedTerminal;
  kill(id: string): boolean;
  releaseLifecycleOwner(id: string): boolean;
};

export type ClaudeAccountAuthServiceDependencies = {
  terminalManager: ManagedTerminalOwner;
  instanceRoot: string;
  runnerInstanceId: string;
  binary: string;
  env: Record<string, string | undefined>;
  now: () => Date;
  uuid: () => string;
  assertCapability: (configDir: string, requireIsolation: boolean) => Promise<void>;
  probeStatus: (configDir: string) => Promise<ClaudeAuthStatus>;
  runCommand: (args: readonly string[], configDir: string) => Promise<{ stdout: string; stderr: string }>;
  quiesceAccount: (accountId: string) => Promise<AccountQuiesceResult>;
  resumeAccount: (accountId: string) => Promise<{ ok: true; accountId: string; fenced: false }>;
  scheduleTimeout: (callback: () => void, milliseconds: number) => { cancel(): void };
};

function serializeMetadata(existing: string | null, identity: Record<string, unknown>) {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed: unknown = existing ? JSON.parse(existing) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
  } catch {
    metadata = {};
  }
  return JSON.stringify({ ...metadata, identity });
}

function publicError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function authFailureCode(error: unknown) {
  const message = publicError(error);
  if (/not found|ENOENT/i.test(message)) return "account.auth.binary_missing";
  if (/unsupported/i.test(message)) return "account.auth.unsupported_cli";
  if (/timed? out|timeout/i.test(message)) return "account.auth.timeout";
  if (/status/i.test(message)) return "account.auth.status_invalid";
  return "account.auth.failed";
}

export class ClaudeAccountAuthService {
  private readonly deps: ClaudeAccountAuthServiceDependencies;
  private readonly operations = new Map<string, OperationRecord>();

  constructor(dependencies: Partial<ClaudeAccountAuthServiceDependencies> = {}) {
    const env = dependencies.env ?? process.env;
    const managedEnv = withManagedPath({ ...env }, undefined, { loginShellPathMode: "cached" });
    const binary = dependencies.binary ?? resolveCommand("claude", { env: managedEnv }) ?? "claude";
    const instanceRoot = dependencies.instanceRoot ?? process.env.OMNIHARNESS_ROOT?.trim() ?? process.cwd();
    const runCommand = dependencies.runCommand ?? (async (args, configDir) => {
      const result = await execFileAsync(binary, [...args], {
        cwd: instanceRoot,
        env: buildClaudeAuthChildEnv(managedEnv, configDir),
        encoding: "utf8",
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: COMMAND_MAX_BUFFER,
      });
      return { stdout: result.stdout, stderr: result.stderr };
    });
    const probeStatus = dependencies.probeStatus ?? (async (configDir) => {
      const result = await runCommand(CLAUDE_STATUS_ARGS, configDir);
      return parseClaudeAuthStatus(result.stdout);
    });
    const assertCapability = dependencies.assertCapability ?? (async (configDir, requireIsolation) => {
      const [version, loginHelp, statusHelp] = await Promise.all([
        runCommand(["--version"], configDir),
        runCommand(["auth", "login", "--help"], configDir),
        runCommand(["auth", "status", "--help"], configDir),
      ]);
      if (!/Claude Code|\d+\.\d+\.\d+/i.test(version.stdout)) {
        throw new Error("The installed Claude CLI version is unsupported.");
      }
      for (const required of ["--claudeai", "--email", "--sso"]) {
        if (!loginHelp.stdout.includes(required)) {
          throw new Error(`The installed Claude CLI is unsupported because auth login lacks ${required}.`);
        }
      }
      if (!statusHelp.stdout.includes("--json")) {
        throw new Error("The installed Claude CLI is unsupported because auth status lacks --json.");
      }
      if (!requireIsolation) return;
      const sentinelIds = [
        `sentinel-${randomUUID()}`,
        `sentinel-${randomUUID()}`,
      ];
      const createdSentinels: string[] = [];
      try {
        for (const sentinelId of sentinelIds) {
          const sentinel = await ensurePrivateClaudeConfigDir(sentinelId, instanceRoot);
          createdSentinels.push(sentinelId);
          const sentinelResult = await runCommand(CLAUDE_STATUS_ARGS, sentinel.configDir);
          if (parseClaudeAuthStatus(sentinelResult.stdout).loggedIn) {
            throw new Error("The installed Claude CLI does not isolate authentication by CLAUDE_CONFIG_DIR.");
          }
        }
      } finally {
        for (const sentinelId of createdSentinels) {
          const target = await assertSafePurgeTarget(sentinelId, instanceRoot);
          await rm(target, { recursive: true, force: false });
        }
      }
      void configDir;
    });
    this.deps = {
      terminalManager: dependencies.terminalManager ?? getTerminalManager(),
      instanceRoot,
      runnerInstanceId: dependencies.runnerInstanceId ?? `runner-${process.pid}`,
      binary,
      env: managedEnv,
      now: dependencies.now ?? (() => new Date()),
      uuid: dependencies.uuid ?? randomUUID,
      assertCapability,
      probeStatus,
      runCommand,
      quiesceAccount: dependencies.quiesceAccount ?? quiesceBridgeAccount,
      resumeAccount: dependencies.resumeAccount ?? resumeBridgeAccount,
      scheduleTimeout: dependencies.scheduleTimeout ?? ((callback, milliseconds) => {
        const timer = setTimeout(callback, milliseconds);
        timer.unref?.();
        return { cancel: () => clearTimeout(timer) };
      }),
    };
  }

  async connect(input: {
    label: string;
    email?: string | null;
    sso?: boolean;
    ownerSessionId: string;
  }) {
    if ([...this.operations.values()].some((operation) => operation.phase === "authenticating" || operation.phase === "verifying")) {
      emitNamedEvent({
        kind: "account.auth_retry_refused",
        accountId: "pending",
        operationId: null,
        workerType: "claude",
        reason: "another_login_active",
      });
      throw new RuntimeHttpError(409, "Another Claude account sign-in is already running.");
    }
    const validated = assertClaudeLoginInput(input);
    const accountId = `claude-managed-${this.deps.uuid()}`;
    const now = this.deps.now();
    await db.insert(accounts).values({
      id: accountId,
      cliType: "claude",
      provider: "anthropic",
      type: "subscription",
      label: validated.label,
      authMode: "isolated_cli_home",
      authRef: `cli-home:${accountId}`,
      enabled: false,
      priority: 0,
      status: "authenticating",
      createdAt: now,
      updatedAt: now,
    });
    emitNamedEvent({
      kind: "account.created",
      accountId,
      workerType: "claude",
      provider: "anthropic",
      authMode: "isolated_cli_home",
    });
    return this.startOperation(accountId, {
      email: validated.email,
      sso: input.sso === true,
      ownerSessionId: input.ownerSessionId,
    });
  }

  async getOperation(accountId: string, ownerSessionId: string) {
    const account = await this.requireAccount(accountId);
    return {
      account: toAccountDto(account),
      operation: this.toOperationDto(this.operations.get(accountId) ?? null, ownerSessionId),
    };
  }

  async act(accountId: string, action: "retry" | "cancel", ownerSessionId: string) {
    if (action === "cancel") {
      return this.cancel(accountId, ownerSessionId);
    }
    await this.requireAccount(accountId);
    return this.startOperation(accountId, { email: null, sso: false, ownerSessionId });
  }

  private async startOperation(accountId: string, options: {
    email: string | null;
    sso: boolean;
    ownerSessionId: string;
  }) {
    const active = [...this.operations.values()].find(
      (candidate) => candidate.phase === "authenticating" || candidate.phase === "verifying",
    );
    if (active) {
      if (active.accountId === accountId) {
        const account = await this.requireAccount(accountId);
        return { account: toAccountDto(account), operation: this.toOperationDto(active, options.ownerSessionId)! };
      }
      emitNamedEvent({
        kind: "account.auth_retry_refused",
        accountId,
        operationId: active.id,
        workerType: "claude",
        reason: "another_login_active",
      });
      throw new RuntimeHttpError(409, "Another Claude account sign-in is already running.");
    }

    const existing = await this.requireAccount(accountId);
    if (existing.cliType !== "claude" || !["isolated_cli_home", "local_session"].includes(existing.authMode)) {
      throw new RuntimeHttpError(400, "This account does not support Claude sign-in.");
    }
    const operationId = this.deps.uuid();
    const startedAt = this.deps.now();
    const deadlineAt = new Date(startedAt.getTime() + LOGIN_TIMEOUT_MS);
    const operation: OperationRecord = {
      id: operationId,
      accountId,
      phase: "authenticating",
      startedAt: startedAt.toISOString(),
      deadlineAt: deadlineAt.toISOString(),
      error: null,
      terminalId: null,
      ownerSessionId: options.ownerSessionId,
      timeout: null,
    };
    this.operations.set(accountId, operation);

    const { accountHome, configDir, requireIsolation } = await this.ensureAuthTarget(existing);
    await db.update(accounts).set({
      enabled: false,
      status: "authenticating",
      lifecycleOperationId: operationId,
      lifecycleOperationKind: "login",
      lifecycleOperationOwner: this.deps.runnerInstanceId,
      lifecycleOperationStartedAt: startedAt,
      lifecycleOperationDeadlineAt: deadlineAt,
      lifecycleOperationErrorCode: null,
      updatedAt: startedAt,
    }).where(eq(accounts.id, accountId));

    emitNamedEvent({
      kind: "account.auth_started",
      accountId,
      operationId,
      workerType: "claude",
      previousStatus: null,
      status: "authenticating",
    });

    try {
      await this.deps.assertCapability(configDir, requireIsolation);
      const created = this.deps.terminalManager.createManagedTerminal({
        command: this.deps.binary,
        args: buildClaudeLoginArgs(options),
        env: buildClaudeAuthChildEnv(this.deps.env, configDir),
        cwd: accountHome,
        cols: 100,
        rows: 30,
        ownerSessionId: options.ownerSessionId,
        runnerInstanceId: this.deps.runnerInstanceId,
        accountId,
        operationId,
        onExit: (exit) => {
          void this.finishLogin(accountId, operationId, exit).catch((error) => {
            void this.failOperation(accountId, operationId, authFailureCode(error), publicError(error));
          });
        },
      });
      operation.terminalId = created.id;
      operation.timeout = this.deps.scheduleTimeout(() => {
        const current = this.operations.get(accountId);
        if (!current || current.id !== operationId || current.phase !== "authenticating") {
          emitNamedEvent({
            kind: "account.auth_exit_ignored",
            accountId,
            operationId,
            workerType: "claude",
            reason: !current
              ? "operation_missing"
              : current.id !== operationId
                ? "operation_replaced"
                : "operation_not_authenticating",
          });
          return;
        }
        const terminalId = current.terminalId;
        current.terminalId = null;
        void this.failOperation(accountId, operationId, "account.auth.timeout", "Claude sign-in timed out.")
          .finally(() => {
            if (terminalId) {
              this.deps.terminalManager.releaseLifecycleOwner(terminalId);
              this.deps.terminalManager.kill(terminalId);
            }
          });
      }, LOGIN_TIMEOUT_MS);
      emitNamedEvent({
        kind: "account.auth_terminal_ready",
        accountId,
        operationId,
        workerType: "claude",
      });
    } catch (error) {
      await this.failOperation(accountId, operationId, authFailureCode(error), publicError(error));
      throw new RuntimeHttpError(
        authFailureCode(error) === "account.auth.unsupported_cli" ? 422 : 500,
        publicError(error),
      );
    }

    const account = await this.requireAccount(accountId);
    return { account: toAccountDto(account), operation: this.toOperationDto(operation, options.ownerSessionId)! };
  }

  private async finishLogin(accountId: string, operationId: string, exit: TerminalExit) {
    const operation = this.operations.get(accountId);
    if (!operation || operation.id !== operationId || operation.phase !== "authenticating") {
      emitNamedEvent({
        kind: "account.auth_exit_ignored",
        accountId,
        operationId,
        workerType: "claude",
        reason: !operation
          ? "operation_missing"
          : operation.id !== operationId
            ? "operation_replaced"
            : "operation_not_authenticating",
      });
      return;
    }
    const terminalId = operation.terminalId;
    operation.timeout?.cancel();
    operation.timeout = null;
    if (exit.exitCode !== 0) {
      await this.failOperation(accountId, operationId, "account.auth.failed", `Claude sign-in exited with code ${exit.exitCode}.`);
      return;
    }
    operation.phase = "verifying";
    operation.terminalId = null;
    const now = this.deps.now();
    await db.update(accounts).set({ status: "verifying", updatedAt: now }).where(eq(accounts.id, accountId));
    emitNamedEvent({
      kind: "account.auth_verifying",
      accountId,
      operationId,
      workerType: "claude",
    });

    const existing = await this.requireAccount(accountId);
    const { configDir, requireIsolation } = await this.ensureAuthTarget(existing);
    await this.deps.assertCapability(configDir, requireIsolation);
    const status = await this.deps.probeStatus(configDir);
    if (!status.loggedIn) {
      await this.failOperation(accountId, operationId, "account.login_required", "Claude did not report a signed-in account after login.", "login_required");
      return;
    }
    const completedAt = this.deps.now();
    await db.update(accounts).set({
      enabled: true,
      status: "available",
      statusCheckedAt: completedAt,
      metadataJson: serializeMetadata(existing.metadataJson, claudeSafeIdentity(status, completedAt)),
      lifecycleOperationId: null,
      lifecycleOperationKind: null,
      lifecycleOperationOwner: null,
      lifecycleOperationStartedAt: null,
      lifecycleOperationDeadlineAt: null,
      lifecycleOperationErrorCode: null,
      lifecyclePreviousStatus: null,
      lifecyclePreviousEnabled: null,
      updatedAt: completedAt,
    }).where(eq(accounts.id, accountId));
    operation.phase = "completed";
    operation.error = null;
    if (terminalId) this.deps.terminalManager.releaseLifecycleOwner(terminalId);
    emitNamedEvent({
      kind: "account.auth_completed",
      accountId,
      operationId,
      workerType: "claude",
      status: "available",
    });
    emitNamedEvent({
      kind: "account.status_checked",
      accountId,
      workerType: "claude",
      previousStatus: "verifying",
      status: "available",
      source: "login_verification",
      reason: "logged_in",
    });
  }

  private async cancel(accountId: string, ownerSessionId: string) {
    const operation = this.operations.get(accountId);
    if (!operation || (operation.phase !== "authenticating" && operation.phase !== "verifying")) {
      throw new RuntimeHttpError(409, "Claude sign-in is not running.");
    }
    if (operation.ownerSessionId !== ownerSessionId) {
      emitNamedEvent({
        kind: "account.auth_exit_ignored",
        accountId,
        operationId: operation.id,
        workerType: "claude",
        reason: "cancel_owner_mismatch",
      });
      throw new RuntimeHttpError(403, "This browser session does not own the Claude sign-in operation.");
    }
    operation.phase = "cancelled";
    operation.timeout?.cancel();
    operation.timeout = null;
    const terminalId = operation.terminalId;
    operation.terminalId = null;
    operation.error = null;
    if (terminalId) {
      this.deps.terminalManager.releaseLifecycleOwner(terminalId);
      this.deps.terminalManager.kill(terminalId);
    }
    const now = this.deps.now();
    await db.update(accounts).set({
      enabled: false,
      status: "login_required",
      lifecycleOperationId: null,
      lifecycleOperationKind: null,
      lifecycleOperationOwner: null,
      lifecycleOperationStartedAt: null,
      lifecycleOperationDeadlineAt: null,
      lifecycleOperationErrorCode: null,
      updatedAt: now,
    }).where(eq(accounts.id, accountId));
    emitNamedEvent({
      kind: "account.auth_cancelled",
      accountId,
      operationId: operation.id,
      workerType: "claude",
    });
    const account = await this.requireAccount(accountId);
    return { account: toAccountDto(account), operation: this.toOperationDto(operation, ownerSessionId)! };
  }

  private async failOperation(
    accountId: string,
    operationId: string,
    code: string,
    message: string,
    status = "auth_failed",
  ) {
    const operation = this.operations.get(accountId);
    if (!operation || operation.id !== operationId || operation.phase === "cancelled") {
      emitNamedEvent({
        kind: "account.auth_exit_ignored",
        accountId,
        operationId,
        workerType: "claude",
        reason: !operation
          ? "operation_missing"
          : operation.id !== operationId
            ? "operation_replaced"
            : "operation_not_authenticating",
      });
      return;
    }
    const terminalId = operation.terminalId;
    operation.timeout?.cancel();
    operation.timeout = null;
    operation.phase = "failed";
    operation.terminalId = null;
    operation.error = { code, message };
    if (terminalId) this.deps.terminalManager.releaseLifecycleOwner(terminalId);
    const now = this.deps.now();
    await db.update(accounts).set({
      enabled: false,
      status,
      lifecycleOperationId: null,
      lifecycleOperationKind: null,
      lifecycleOperationOwner: null,
      lifecycleOperationStartedAt: null,
      lifecycleOperationDeadlineAt: null,
      lifecycleOperationErrorCode: code,
      updatedAt: now,
    }).where(eq(accounts.id, accountId));
    emitNamedEvent({
      kind: "account.auth_failed",
      accountId,
      operationId,
      workerType: "claude",
      code,
      reason: message,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: code as "account.auth.failed",
      message,
      surface: "banner",
      accountId,
      cause: null,
    });
  }

  async refreshStatus(accountId: string) {
    const existing = await this.requireAccount(accountId);
    if (existing.cliType !== "claude" || !["isolated_cli_home", "local_session"].includes(existing.authMode)) {
      throw new RuntimeHttpError(400, "This account does not support Claude status verification.");
    }
    const { configDir } = await this.ensureAuthTarget(existing);
    const previousStatus = existing.status;
    const now = this.deps.now();
    let status: ClaudeAuthStatus;
    try {
      status = await this.deps.probeStatus(configDir);
    } catch (error) {
      await db.update(accounts).set({ status: "unknown", statusCheckedAt: now, updatedAt: now }).where(eq(accounts.id, accountId));
      emitNamedEvent({
        kind: "account.status_checked",
        accountId,
        workerType: "claude",
        previousStatus,
        status: "unknown",
        source: "manual_refresh",
        reason: "probe_failed",
      });
      throw error;
    }
    const nextStatus = status.loggedIn ? "available" : "login_required";
    await db.update(accounts).set({
      enabled: status.loggedIn ? existing.enabled : false,
      status: nextStatus,
      statusCheckedAt: now,
      metadataJson: status.loggedIn
        ? serializeMetadata(existing.metadataJson, claudeSafeIdentity(status, now))
        : existing.metadataJson,
      updatedAt: now,
    }).where(eq(accounts.id, accountId));
    emitNamedEvent({
      kind: "account.status_checked",
      accountId,
      workerType: "claude",
      previousStatus,
      status: nextStatus,
      source: "manual_refresh",
      reason: status.loggedIn ? "logged_in" : "logged_out",
    });
    return toAccountDto((await this.requireAccount(accountId)));
  }

  private async restoreAfterDestructiveRefusal(accountId: string, previous: {
    status: string | null;
    enabled: boolean;
  }) {
    const now = this.deps.now();
    await db.update(accounts).set({
      enabled: previous.enabled,
      status: previous.status,
      lifecycleOperationId: null,
      lifecycleOperationKind: null,
      lifecycleOperationOwner: null,
      lifecycleOperationStartedAt: null,
      lifecycleOperationDeadlineAt: null,
      lifecycleOperationErrorCode: null,
      lifecyclePreviousStatus: null,
      lifecyclePreviousEnabled: null,
      updatedAt: now,
    }).where(eq(accounts.id, accountId));
    await this.deps.resumeAccount(accountId);
  }

  private destructiveRefusalKind(action: "logout" | "remove" | "purge") {
    return action === "logout"
      ? "account.logout_refused" as const
      : action === "remove"
        ? "account.remove_refused" as const
        : "account.purge_refused" as const;
  }

  private async beginDestructiveOperation(input: {
    accountId: string;
    action: "logout" | "remove" | "purge";
    operationId: string;
    status: string;
    previousStatus: string | null;
    previousEnabled: boolean;
    deadlineAt?: Date | null;
  }) {
    const startedAt = this.deps.now();
    await db.update(accounts).set({
      enabled: false,
      status: input.status,
      lifecycleOperationId: input.operationId,
      lifecycleOperationKind: input.action,
      lifecycleOperationOwner: this.deps.runnerInstanceId,
      lifecycleOperationStartedAt: startedAt,
      lifecycleOperationDeadlineAt: input.deadlineAt ?? null,
      lifecycleOperationErrorCode: null,
      lifecyclePreviousStatus: input.previousStatus,
      lifecyclePreviousEnabled: input.previousEnabled,
      updatedAt: startedAt,
    }).where(eq(accounts.id, input.accountId));

    let bridge: AccountQuiesceResult;
    try {
      bridge = await this.deps.quiesceAccount(input.accountId);
    } catch (error) {
      await this.restoreAfterDestructiveRefusal(input.accountId, {
        status: input.previousStatus,
        enabled: input.previousEnabled,
      });
      const message = publicError(error);
      emitNamedEvent({
        kind: this.destructiveRefusalKind(input.action),
        accountId: input.accountId,
        operationId: input.operationId,
        workerType: "claude",
        reason: "bridge_unavailable",
        blockingWorkerCount: 0,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "account.action.bridge_unavailable",
        message,
        surface: "banner",
        accountId: input.accountId,
        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
      });
      throw new RuntimeHttpError(503, "The worker runtime could not safely fence this account.");
    }

    const bridgeBlockingCount = bridge.startingCount + bridge.liveAgents.length;
    if (bridgeBlockingCount > 0) {
      await this.restoreAfterDestructiveRefusal(input.accountId, {
        status: input.previousStatus,
        enabled: input.previousEnabled,
      });
      emitNamedEvent({
        kind: this.destructiveRefusalKind(input.action),
        accountId: input.accountId,
        operationId: input.operationId,
        workerType: "claude",
        reason: "active_workers",
        blockingWorkerCount: bridgeBlockingCount,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "account.action.active_workers",
        message: `Account action refused because ${bridgeBlockingCount} worker${bridgeBlockingCount === 1 ? " is" : "s are"} still active.`,
        surface: "banner",
        accountId: input.accountId,
        cause: null,
      });
      throw new RuntimeHttpError(409, "Stop workers using this account before continuing.", {
        blockingWorkerIds: [
          ...bridge.liveAgents.map((agent) => agent.name),
          ...bridge.startingAgents,
        ],
      });
    }

    try {
      await this.assertNoActiveWorkers(input.accountId, input.action);
    } catch (error) {
      await this.restoreAfterDestructiveRefusal(input.accountId, {
        status: input.previousStatus,
        enabled: input.previousEnabled,
      });
      throw error;
    }
    return startedAt;
  }

  async logout(accountId: string) {
    const existing = await this.requireAccount(accountId);
    if (existing.cliType !== "claude" || existing.authMode !== "isolated_cli_home") {
      throw new RuntimeHttpError(400, "Only isolated Claude accounts can be logged out here.");
    }
    let preflight: ClaudeAuthStatus;
    try {
      preflight = await this.deps.probeStatus(resolveClaudeConfigDir(accountId, this.deps.instanceRoot));
    } catch (error) {
      const message = publicError(error);
      emitNamedEvent({
        kind: "account.logout_refused",
        accountId,
        operationId: null,
        workerType: "claude",
        reason: "status_unknown",
        blockingWorkerCount: 0,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "account.auth.status_invalid",
        message,
        surface: "banner",
        accountId,
        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
      });
      throw new RuntimeHttpError(409, "Claude login status could not be verified, so logout was not started.");
    }
    if (!preflight.loggedIn) {
      const checkedAt = this.deps.now();
      await db.update(accounts).set({
        enabled: false,
        status: "login_required",
        statusCheckedAt: checkedAt,
        updatedAt: checkedAt,
      }).where(eq(accounts.id, accountId));
      emitNamedEvent({
        kind: "account.status_checked",
        accountId,
        workerType: "claude",
        previousStatus: existing.status,
        status: "login_required",
        source: "logout_preflight",
        reason: "already_logged_out",
      });
      return { account: toAccountDto(await this.requireAccount(accountId)) };
    }
    const operationId = this.deps.uuid();
    const now = this.deps.now();
    await this.beginDestructiveOperation({
      accountId,
      action: "logout",
      operationId,
      status: "logging_out",
      previousStatus: existing.status,
      previousEnabled: existing.enabled,
      deadlineAt: new Date(now.getTime() + COMMAND_TIMEOUT_MS),
    });
    emitNamedEvent({ kind: "account.logout_started", accountId, operationId, workerType: "claude" });
    try {
      await this.deps.runCommand(CLAUDE_LOGOUT_ARGS, resolveClaudeConfigDir(accountId, this.deps.instanceRoot));
      const completedAt = this.deps.now();
      await db.update(accounts).set({
        enabled: false,
        status: "login_required",
        statusCheckedAt: completedAt,
        lifecycleOperationId: null,
        lifecycleOperationKind: null,
        lifecycleOperationOwner: null,
        lifecycleOperationStartedAt: null,
        lifecycleOperationDeadlineAt: null,
        lifecycleOperationErrorCode: null,
        lifecyclePreviousStatus: null,
        lifecyclePreviousEnabled: null,
        updatedAt: completedAt,
      }).where(eq(accounts.id, accountId));
      await this.deps.resumeAccount(accountId);
      emitNamedEvent({ kind: "account.logout_completed", accountId, operationId, workerType: "claude" });
      return { account: toAccountDto(await this.requireAccount(accountId)) };
    } catch (error) {
      const message = publicError(error);
      const failedAt = this.deps.now();
      let nextStatus = "auth_failed";
      let nextEnabled = false;
      try {
        const scopedStatus = await this.deps.probeStatus(resolveClaudeConfigDir(accountId, this.deps.instanceRoot));
        nextStatus = scopedStatus.loggedIn ? existing.status ?? "available" : "login_required";
        nextEnabled = scopedStatus.loggedIn ? existing.enabled : false;
      } catch (probeError) {
        emitNamedEvent({
          kind: "error.surfaced",
          code: "account.auth.status_invalid",
          message: publicError(probeError),
          surface: "log",
          accountId,
          cause: probeError instanceof Error ? { name: probeError.name, message: probeError.message } : null,
        });
      }
      await db.update(accounts).set({
        enabled: nextEnabled,
        status: nextStatus,
        lifecycleOperationId: null,
        lifecycleOperationKind: null,
        lifecycleOperationOwner: null,
        lifecycleOperationStartedAt: null,
        lifecycleOperationDeadlineAt: null,
        lifecycleOperationErrorCode: "account.logout.failed",
        updatedAt: failedAt,
      }).where(eq(accounts.id, accountId));
      await this.deps.resumeAccount(accountId);
      emitNamedEvent({ kind: "account.logout_failed", accountId, operationId, workerType: "claude", reason: message });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "account.logout.failed",
        message,
        surface: "banner",
        accountId,
        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
      });
      throw new RuntimeHttpError(500, message);
    }
  }

  async remove(accountId: string) {
    const existing = await this.requireAccount(accountId);
    const operationId = this.deps.uuid();
    await this.beginDestructiveOperation({
      accountId,
      action: "remove",
      operationId,
      status: "removing",
      previousStatus: existing.status,
      previousEnabled: existing.enabled,
    });
    emitNamedEvent({ kind: "account.remove_started", accountId, operationId, workerType: existing.cliType });
    try {
      await this.deleteAccountRows(accountId);
      await this.deps.resumeAccount(accountId);
      emitNamedEvent({
        kind: "account.remove_completed",
        accountId,
        operationId,
        workerType: existing.cliType,
        profileDataPreserved: true,
      });
      return { ok: true as const, accountId, profileDataPreserved: true as const };
    } catch (error) {
      const message = publicError(error);
      if (await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).get()) {
        await this.restoreAfterDestructiveRefusal(accountId, {
          status: existing.status,
          enabled: existing.enabled,
        });
      } else {
        await this.deps.resumeAccount(accountId);
      }
      emitNamedEvent({ kind: "account.remove_failed", accountId, operationId, workerType: existing.cliType, reason: message });
      emitNamedEvent({ kind: "error.surfaced", code: "account.remove.failed", message, surface: "toast", accountId, cause: null });
      throw error;
    }
  }

  async purge(accountId: string, confirmation: { purge: boolean; confirmAccountId: string }) {
    if (!confirmation.purge || confirmation.confirmAccountId !== accountId) {
      throw new RuntimeHttpError(400, "Type the exact account id to confirm local-data purge.");
    }
    const existing = await this.requireAccount(accountId);
    if (existing.cliType !== "claude" || existing.authMode !== "isolated_cli_home") {
      throw new RuntimeHttpError(400, "Only isolated Claude accounts have managed profile data to purge.");
    }
    const recoveringDurablePurge = existing.status === "purging" && existing.lifecycleOperationKind === "purge";
    const operationId = this.deps.uuid();
    await this.beginDestructiveOperation({
      accountId,
      action: "purge",
      operationId,
      status: "purging",
      previousStatus: existing.status,
      previousEnabled: existing.enabled,
    });
    emitNamedEvent({ kind: "account.purge_started", accountId, operationId, workerType: "claude" });
    let target: string | null = null;
    try {
      target = await assertSafePurgeTarget(accountId, this.deps.instanceRoot);
    } catch (error) {
      if (recoveringDurablePurge && (error as NodeJS.ErrnoException)?.code === "ENOENT") {
        // The persisted purging lease proves the missing directory can be the
        // result of our earlier filesystem delete winning before DB cleanup.
        resolveAccountCliHome("claude", accountId, this.deps.instanceRoot);
      } else {
        const message = publicError(error);
        emitNamedEvent({ kind: "account.purge_refused", accountId, operationId, workerType: "claude", reason: "unsafe_path" });
        emitNamedEvent({ kind: "error.surfaced", code: "account.purge.unsafe_path", message, surface: "banner", accountId, cause: null });
        await this.restoreAfterDestructiveRefusal(accountId, {
          status: existing.status,
          enabled: existing.enabled,
        });
        throw new RuntimeHttpError(409, message);
      }
    }
    try {
      if (target) await rm(target, { recursive: true, force: false });
      await this.deleteAccountRows(accountId);
      await this.deps.resumeAccount(accountId);
      emitNamedEvent({ kind: "account.purge_completed", accountId, operationId, workerType: "claude" });
      return { ok: true as const, accountId, profileDataPurged: true as const };
    } catch (error) {
      const message = publicError(error);
      emitNamedEvent({ kind: "account.purge_failed", accountId, operationId, workerType: "claude", reason: message });
      emitNamedEvent({ kind: "error.surfaced", code: "account.purge.failed", message, surface: "banner", accountId, cause: null });
      throw error;
    }
  }

  private async assertNoActiveWorkers(accountId: string, action: "logout" | "remove" | "purge") {
    const allocations = await db.select().from(workerCredentialAllocations)
      .where(eq(workerCredentialAllocations.accountId, accountId));
    if (allocations.length === 0) return;
    const allocationRows = allocations as Array<{ workerId: unknown }>;
    const ids: string[] = [...new Set<string>(allocationRows
      .map((allocation) => String(allocation.workerId ?? ""))
      .filter((workerId) => workerId.length > 0))];
    if (ids.length === 0) return;
    const allocatedWorkers = await db.select().from(workers).where(inArray(workers.id, ids));
    const terminalStatuses = new Set(["completed", "failed", "cancelled", "canceled", "error", "stopped", "done"]);
    const blocking = allocatedWorkers.filter((worker) => !terminalStatuses.has(worker.status.trim().toLowerCase()));
    if (blocking.length === 0) return;
    const kind = action === "logout"
      ? "account.logout_refused"
      : action === "remove"
        ? "account.remove_refused"
        : "account.purge_refused";
    emitNamedEvent({
      kind,
      accountId,
      operationId: null,
      workerType: "claude",
      reason: "active_workers",
      blockingWorkerCount: blocking.length,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "account.action.active_workers",
      message: `Account action refused because ${blocking.length} worker${blocking.length === 1 ? " is" : "s are"} still active.`,
      surface: "banner",
      accountId,
      cause: null,
    });
    throw new RuntimeHttpError(409, "Stop workers using this account before continuing.", {
      blockingWorkerIds: blocking.map((worker) => worker.id),
    });
  }

  private async deleteAccountRows(accountId: string) {
    const now = this.deps.now();
    const deletedKey = deletedAccountSettingKey(accountId);
    await db.batch([
      db.update(runs).set({ preferredWorkerAccountId: null }).where(eq(runs.preferredWorkerAccountId, accountId)),
      db.delete(creditEvents).where(eq(creditEvents.accountId, accountId)),
      db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.accountId, accountId)),
      db.delete(workerTokenUsage).where(eq(workerTokenUsage.accountId, accountId)),
      db.delete(accountUsageSnapshots).where(eq(accountUsageSnapshots.accountId, accountId)),
      db.delete(accountSecrets).where(eq(accountSecrets.accountId, accountId)),
      db.delete(accounts).where(eq(accounts.id, accountId)),
      db.insert(settings).values({ key: deletedKey, value: accountId, updatedAt: now }).onConflictDoUpdate({
        target: settings.key,
        set: { value: accountId, updatedAt: now },
      }),
    ]);
    this.operations.delete(accountId);
  }

  async reconcileAtStartup() {
    await repairAccountsFromCredentialVerificationHistory(this.deps.now());
    const rows = await db.select().from(accounts);
    for (const account of rows) {
      if (!account.lifecycleOperationId) continue;
      if (account.lifecycleOperationKind === "login") {
        const now = this.deps.now();
        let status: ClaudeAuthStatus | null = null;
        try {
          status = await this.deps.probeStatus((await this.ensureAuthTarget(account)).configDir);
        } catch (error) {
          emitNamedEvent({
            kind: "error.surfaced",
            code: "account.auth.status_invalid",
            message: publicError(error),
            surface: "log",
            accountId: account.id,
            cause: error instanceof Error ? { name: error.name, message: error.message } : null,
          });
        }
        const loggedIn = status?.loggedIn === true;
        await db.update(accounts).set({
          enabled: loggedIn,
          status: loggedIn ? "available" : "login_required",
          statusCheckedAt: now,
          metadataJson: loggedIn && status
            ? serializeMetadata(account.metadataJson, claudeSafeIdentity(status, now))
            : account.metadataJson,
          lifecycleOperationId: null,
          lifecycleOperationKind: null,
          lifecycleOperationOwner: null,
          lifecycleOperationStartedAt: null,
          lifecycleOperationDeadlineAt: null,
          lifecycleOperationErrorCode: loggedIn ? null : "account.auth.interrupted",
          updatedAt: now,
        }).where(eq(accounts.id, account.id));
        emitNamedEvent({
          kind: "account.auth_interrupted",
          accountId: account.id,
          operationId: account.lifecycleOperationId,
          workerType: "claude",
          recovered: loggedIn,
        });
        continue;
      }

      if (account.lifecycleOperationKind === "purge" && account.status === "purging") {
        const operationId = account.lifecycleOperationId;
        try {
          const bridge = await this.deps.quiesceAccount(account.id);
          const blockingWorkerCount = bridge.startingCount + bridge.liveAgents.length;
          if (blockingWorkerCount > 0) {
            emitNamedEvent({
              kind: "account.purge_refused",
              accountId: account.id,
              operationId,
              workerType: "claude",
              reason: "active_workers_during_recovery",
              blockingWorkerCount,
            });
            continue;
          }
          let target: string;
          try {
            target = await assertSafePurgeTarget(account.id, this.deps.instanceRoot);
            await rm(target, { recursive: true, force: false });
          } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
            // A durable purging lease is the only state in which a missing
            // directory proves an earlier OmniHarness delete may have won.
            target = resolveAccountCliHome("claude", account.id, this.deps.instanceRoot);
            void target;
          }
          await this.deleteAccountRows(account.id);
          await this.deps.resumeAccount(account.id);
          emitNamedEvent({ kind: "account.purge_completed", accountId: account.id, operationId, workerType: "claude" });
        } catch (error) {
          const message = publicError(error);
          emitNamedEvent({ kind: "account.purge_failed", accountId: account.id, operationId, workerType: "claude", reason: message });
          emitNamedEvent({
            kind: "error.surfaced",
            code: "account.purge.failed",
            message,
            surface: "log",
            accountId: account.id,
            cause: error instanceof Error ? { name: error.name, message: error.message } : null,
          });
        }
        continue;
      }

      if (account.lifecycleOperationKind === "logout" || account.lifecycleOperationKind === "remove") {
        const now = this.deps.now();
        const operationKind = account.lifecycleOperationKind;
        let nextStatus = account.lifecyclePreviousStatus ?? "unknown";
        let nextEnabled = account.lifecyclePreviousEnabled ?? false;
        if (operationKind === "logout") {
          try {
            const status = await this.deps.probeStatus(resolveClaudeConfigDir(account.id, this.deps.instanceRoot));
            if (!status.loggedIn) {
              nextStatus = "login_required";
              nextEnabled = false;
            }
          } catch (error) {
            nextStatus = "auth_failed";
            nextEnabled = false;
            emitNamedEvent({
              kind: "error.surfaced",
              code: "account.auth.status_invalid",
              message: publicError(error),
              surface: "log",
              accountId: account.id,
              cause: error instanceof Error ? { name: error.name, message: error.message } : null,
            });
          }
        }
        await db.update(accounts).set({
          enabled: nextEnabled,
          status: nextStatus,
          lifecycleOperationId: null,
          lifecycleOperationKind: null,
          lifecycleOperationOwner: null,
          lifecycleOperationStartedAt: null,
          lifecycleOperationDeadlineAt: null,
          lifecycleOperationErrorCode: `account.${operationKind}.interrupted`,
          lifecyclePreviousStatus: null,
          lifecyclePreviousEnabled: null,
          updatedAt: now,
        }).where(eq(accounts.id, account.id));
        await this.deps.resumeAccount(account.id);
        if (operationKind === "logout") {
          emitNamedEvent({ kind: "account.logout_failed", accountId: account.id, operationId: account.lifecycleOperationId, workerType: "claude", reason: "runner_restarted" });
        } else {
          emitNamedEvent({ kind: "account.remove_failed", accountId: account.id, operationId: account.lifecycleOperationId, workerType: account.cliType, reason: "runner_restarted" });
        }
      }
    }
  }

  shutdown() {
    for (const operation of this.operations.values()) {
      if (operation.terminalId) {
        this.deps.terminalManager.releaseLifecycleOwner(operation.terminalId);
        this.deps.terminalManager.kill(operation.terminalId);
      }
      operation.timeout?.cancel();
    }
    this.operations.clear();
  }

  private async requireAccount(accountId: string) {
    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!account) throw new RuntimeHttpError(404, "Account not found.");
    return account;
  }

  private async ensureAuthTarget(account: typeof accounts.$inferSelect) {
    if (account.authMode === "isolated_cli_home") {
      return {
        ...(await ensurePrivateClaudeConfigDir(account.id, this.deps.instanceRoot)),
        requireIsolation: true,
      };
    }
    if (account.authMode === "local_session") {
      const accountHome = this.deps.env.HOME?.trim() || homedir();
      const configDir = join(accountHome, ".claude");
      await mkdir(configDir, { recursive: true, mode: 0o700 });
      return { accountHome, configDir, requireIsolation: false };
    }
    throw new RuntimeHttpError(400, "This account does not support Claude sign-in.");
  }

  private toOperationDto(operation: OperationRecord | null, ownerSessionId: string): ClaudeAccountAuthOperationDto | null {
    if (!operation) return null;
    return {
      id: operation.id,
      accountId: operation.accountId,
      phase: operation.phase,
      startedAt: operation.startedAt,
      deadlineAt: operation.deadlineAt,
      error: operation.error,
      terminal: operation.ownerSessionId === ownerSessionId && operation.terminalId
        ? { id: operation.terminalId }
        : null,
    };
  }
}

let servicePromise: Promise<ClaudeAccountAuthService> | null = null;

export function getClaudeAccountAuthService(options: Pick<Partial<ClaudeAccountAuthServiceDependencies>, "instanceRoot"> = {}) {
  servicePromise ??= ensureRunnerIdentity().then((identity) => new ClaudeAccountAuthService({
    runnerInstanceId: identity.runnerInstanceId,
    ...options,
  }));
  return servicePromise;
}

export type ClaudeAccountAuthResult = {
  account: AccountDto;
  operation: ClaudeAccountAuthOperationDto | null;
};
