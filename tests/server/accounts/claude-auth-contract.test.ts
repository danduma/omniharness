import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  buildClaudeAuthChildEnv,
  buildClaudeLoginArgs,
  CLAUDE_LOGOUT_ARGS,
  CLAUDE_STATUS_ARGS,
  parseClaudeAuthStatus,
  stripClaudeCredentialRoutingEnv,
} from "@/server/accounts/claude-auth-contract";
import {
  resolveAccountCliHome,
  resolveClaudeConfigDir,
  validateManagedAccountPath,
} from "@/server/accounts/cli-home";

describe("Claude authentication contract", () => {
  it("computes an isolated config directory from a server-owned account id", () => {
    const root = path.join(path.sep, "tmp", "omniharness-auth-root");
    expect(resolveAccountCliHome("claude", "account-123", root)).toBe(
      path.join(root, "account-cli-homes", "claude", "account-123"),
    );
    expect(resolveClaudeConfigDir("account-123", root)).toBe(
      path.join(root, "account-cli-homes", "claude", "account-123", "config"),
    );
  });

  it("rejects traversal-shaped account ids and paths outside the managed root", () => {
    const root = path.join(path.sep, "tmp", "omniharness-auth-root");
    for (const accountId of ["../escape", "a/b", "a\\b", "", ".", ".."] ) {
      expect(() => resolveClaudeConfigDir(accountId, root)).toThrow(/account id/i);
    }
    expect(() => validateManagedAccountPath(path.join(path.sep, "tmp", "escape"), root)).toThrow(/managed account/i);
  });

  it("strips every ambient Claude credential-routing variable", () => {
    const env = stripClaudeCredentialRoutingEnv({
      PATH: "/usr/bin",
      ANTHROPIC_API_KEY: "secret",
      ANTHROPIC_AUTH_TOKEN: "secret",
      ANTHROPIC_BASE_URL: "https://gateway.invalid",
      ANTHROPIC_CUSTOM_HEADER: "secret",
      CLAUDE_CODE_OAUTH_TOKEN: "secret",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_USE_VERTEX: "1",
      CLAUDE_CODE_USE_FOUNDRY: "1",
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      CLAUDE_CODE_ACCOUNT_UUID: "secret",
      CLAUDE_CODE_USER_EMAIL: "secret@example.invalid",
      CLAUDE_CODE_ORGANIZATION_UUID: "secret",
      KEEP_ME: "yes",
    });

    expect(env).toEqual({ PATH: "/usr/bin", KEEP_ME: "yes" });
  });

  it("builds a minimal auth environment after stripping ambient credentials", () => {
    const child = buildClaudeAuthChildEnv({
      PATH: "/usr/bin",
      HOME: "/Users/tester",
      LANG: "C",
      LC_ALL: "C",
      HTTPS_PROXY: "http://proxy.invalid",
      ANTHROPIC_API_KEY: "secret",
      UNRELATED_SECRET: "secret",
    }, "/tmp/claude-config");

    expect(child).toMatchObject({
      PATH: "/usr/bin",
      HOME: "/Users/tester",
      LANG: "C",
      LC_ALL: "C",
      HTTPS_PROXY: "http://proxy.invalid",
      CLAUDE_CONFIG_DIR: "/tmp/claude-config",
      TERM: "xterm-256color",
    });
    expect(child).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(child).not.toHaveProperty("UNRELATED_SECRET");
  });

  it("constructs official Claude auth arguments without a shell", () => {
    expect(buildClaudeLoginArgs({})).toEqual(["auth", "login", "--claudeai"]);
    expect(buildClaudeLoginArgs({ email: "person@example.com", sso: true })).toEqual([
      "auth", "login", "--claudeai", "--email", "person@example.com", "--sso",
    ]);
    expect(CLAUDE_STATUS_ARGS).toEqual(["auth", "status", "--json"]);
    expect(CLAUDE_LOGOUT_ARGS).toEqual(["auth", "logout"]);
  });

  it("projects only safe fields from Claude auth status JSON", () => {
    expect(parseClaudeAuthStatus(JSON.stringify({
      loggedIn: true,
      authMethod: "claude.ai",
      apiProvider: "firstParty",
      email: "person@example.com",
      subscriptionType: "max",
      accessToken: "must-not-escape",
      nested: { secret: "must-not-escape" },
    }))).toEqual({
      loggedIn: true,
      authMethod: "claude.ai",
      apiProvider: "firstParty",
      email: "person@example.com",
      subscriptionType: "max",
    });
    expect(parseClaudeAuthStatus('{"loggedIn":false}')).toEqual({ loggedIn: false });
    expect(() => parseClaudeAuthStatus('{"loggedIn":"yes"}')).toThrow(/loggedIn/i);
    expect(() => parseClaudeAuthStatus('not-json')).toThrow(/status/i);
  });
});
