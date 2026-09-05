import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  accountAuthOperationRouteModule,
  accountDetailRouteModule,
  accountStatusRouteModule,
  claudeAccountConnectRouteModule,
  claudeAccountLogoutRouteModule,
  claudeAccountPurgeRouteModule,
  terminalInputRouteModule,
} from "@/../tests/helpers/runtime-routes";
import { getClaudeAccountAuthService } from "@/server/accounts/claude-account-auth-service";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";

import { Chaos, NO_CHAOS } from "../harness/chaos";
import { LifecycleClient } from "../harness/client";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    quiesceAccount: vi.fn(async (accountId: string) => ({
      ok: true as const,
      accountId,
      fenced: true as const,
      startingCount: 0,
      startingAgents: [],
      liveAgents: [],
    })),
    resumeAccount: vi.fn(async (accountId: string) => ({
      ok: true as const,
      accountId,
      fenced: false as const,
    })),
  };
});

type AccountDto = {
  id: string;
  enabled: boolean;
  status: string | null;
};

type OperationDto = {
  phase: string;
  terminal: { id: string } | null;
};

type AuthResponse = {
  account: AccountDto;
  operation: OperationDto;
};

let server: LifecycleServer;
let client: LifecycleClient;
let originalPath: string | undefined;
let originalHome: string | undefined;
const createdAccountIds: string[] = [];

async function postJson<T>(path: string, body: Record<string, unknown> = {}) {
  const response = await client.fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as T;
  expect(response.status, JSON.stringify(payload)).toBe(200);
  return payload;
}

async function waitForOperation(accountId: string, phase: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const { res, body } = await client.getJson<AuthResponse>(
      `/api/accounts/${encodeURIComponent(accountId)}/auth-operation`,
    );
    expect(res.status, JSON.stringify(body)).toBe(200);
    if (body.operation.phase === phase) return body;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Claude auth operation ${accountId} did not reach ${phase}.`);
}

async function installFakeClaude(root: string) {
  const binDir = join(root, "bin");
  const binary = join(binDir, "claude");
  await mkdir(binDir, { recursive: true });
  await writeFile(binary, `#!/usr/bin/env node
const { existsSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const args = process.argv.slice(2);
const configDir = process.env.CLAUDE_CONFIG_DIR;
const marker = join(configDir, "logged-in.json");

if (args[0] === "--version") {
  process.stdout.write("2.1.238 (Claude Code)\\n");
  process.exit(0);
}
if (args.join(" ") === "auth login --help") {
  process.stdout.write("--claudeai --email --sso\\n");
  process.exit(0);
}
if (args.join(" ") === "auth status --help") {
  process.stdout.write("--json\\n");
  process.exit(0);
}
if (args.join(" ") === "auth status --json") {
  process.stdout.write(JSON.stringify({
    loggedIn: existsSync(marker),
    email: "fake@example.invalid",
    subscriptionType: "max",
    authMethod: "claude.ai",
  }) + "\\n");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "login") {
  process.stdout.write("Open https://auth.example.invalid/login\\n");
  process.stdin.setEncoding("utf8");
  process.stdin.once("data", () => {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(marker, "signed in\\n", { mode: 0o600 });
    process.stdout.write("Authentication complete\\n");
    process.exit(0);
  });
  process.stdin.resume();
  return;
}
if (args.join(" ") === "auth logout") {
  rmSync(marker, { force: true });
  process.stdout.write("Logged out\\n");
  process.exit(0);
}
process.stderr.write("Unsupported fake Claude command: " + args.join(" ") + "\\n");
process.exit(2);
`, { mode: 0o700 });
  await chmod(binary, 0o700);
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  originalPath = process.env.PATH;
  originalHome = process.env.HOME;
  createdAccountIds.length = 0;
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/accounts/claude/connect", module: claudeAccountConnectRouteModule },
      { pattern: "/api/accounts/:id/auth-operation", module: accountAuthOperationRouteModule },
      { pattern: "/api/accounts/:id/status", module: accountStatusRouteModule },
      { pattern: "/api/accounts/:id/logout", module: claudeAccountLogoutRouteModule },
      { pattern: "/api/accounts/:id/purge", module: claudeAccountPurgeRouteModule },
      { pattern: "/api/accounts/:id", module: accountDetailRouteModule },
      { pattern: "/api/terminals/:id/input", module: terminalInputRouteModule },
    ],
  });
  process.env.HOME = server.omniRoot;
  await installFakeClaude(server.omniRoot);
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(2_026_082_1, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  (await getClaudeAccountAuthService()).shutdown();
  if (createdAccountIds.length > 0) {
    await db.delete(accounts).where(inArray(accounts.id, createdAccountIds));
  }
  await server.stop();
  process.env.PATH = originalPath;
  process.env.HOME = originalHome;
  vi.clearAllMocks();
});

describe("lifecycle — in-app Claude account authentication", () => {
  it("signs in through the managed PTY, verifies status, logs out, removes, and purges", async () => {
    const localLogin = await postJson<AuthResponse>("/api/accounts/claude/connect", { localSession: true });
    const localAccountId = localLogin.account.id;
    createdAccountIds.push(localAccountId);
    await postJson(`/api/terminals/${localLogin.operation.terminal!.id}/input`, {
      data: "continue\r",
    });
    const localCompleted = await waitForOperation(localAccountId, "completed");
    expect(localCompleted.account).toMatchObject({ enabled: true, status: "available" });

    const removeLocalResponse = await client.fetch(`/api/accounts/${localAccountId}`, {
      method: "DELETE",
    });
    expect(removeLocalResponse.status, await removeLocalResponse.text()).toBe(200);

    const connected = await postJson<AuthResponse>("/api/accounts/claude/connect", {
      label: "Lifecycle Claude",
      email: "fake@example.invalid",
      sso: true,
    });
    createdAccountIds.push(connected.account.id);
    expect(connected.account).toMatchObject({ enabled: false, status: "authenticating" });
    expect(connected.operation).toMatchObject({ phase: "authenticating" });
    expect(connected.operation.terminal?.id).toMatch(/^term-/);

    await postJson(`/api/terminals/${connected.operation.terminal!.id}/input`, {
      data: "continue\r",
    });
    const completed = await waitForOperation(connected.account.id, "completed");
    expect(completed.account).toMatchObject({ enabled: true, status: "available" });

    const refreshed = await postJson<AccountDto>(
      `/api/accounts/${connected.account.id}/status`,
    );
    expect(refreshed).toMatchObject({ enabled: true, status: "available" });

    const loggedOut = await postJson<{ account: AccountDto }>(
      `/api/accounts/${connected.account.id}/logout`,
    );
    expect(loggedOut.account).toMatchObject({ enabled: false, status: "login_required" });

    const removeResponse = await client.fetch(`/api/accounts/${connected.account.id}`, {
      method: "DELETE",
    });
    const removed = await removeResponse.json() as {
      ok: boolean;
      accountId: string;
      profileDataPreserved: boolean;
    };
    expect(removeResponse.status, JSON.stringify(removed)).toBe(200);
    expect(removed).toEqual({
      ok: true,
      accountId: connected.account.id,
      profileDataPreserved: true,
    });
    expect(await db.select().from(accounts).where(eq(accounts.id, connected.account.id)).get())
      .toBeUndefined();

    const purgeCandidate = await postJson<AuthResponse>("/api/accounts/claude/connect", {
      label: "Lifecycle Claude purge",
    });
    createdAccountIds.push(purgeCandidate.account.id);
    await postJson(`/api/accounts/${purgeCandidate.account.id}/auth-operation`, {
      action: "cancel",
    });
    const purged = await postJson<{
      ok: boolean;
      accountId: string;
      profileDataPurged: boolean;
    }>(`/api/accounts/${purgeCandidate.account.id}/purge`, {
      purge: true,
      confirmAccountId: purgeCandidate.account.id,
    });
    expect(purged).toEqual({
      ok: true,
      accountId: purgeCandidate.account.id,
      profileDataPurged: true,
    });

    const eventKinds = getNamedEventsSince(null).events.map((entry) => entry.event.kind);
    expect(eventKinds).toEqual(expect.arrayContaining([
      "account.created",
      "account.auth_started",
      "account.auth_terminal_ready",
      "account.auth_verifying",
      "account.auth_completed",
      "account.status_checked",
      "account.logout_started",
      "account.logout_completed",
      "account.remove_started",
      "account.remove_completed",
      "account.auth_cancelled",
      "account.purge_started",
      "account.purge_completed",
    ]));
  });
});
