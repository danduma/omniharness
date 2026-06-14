import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFileSync: mockExecFileSync,
}));

describe("selectSpawnableWorkerType", () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  it("uses the requested worker type when it is spawnable", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "gemini") {
        return Buffer.from("/usr/local/bin/gemini\n");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("gemini", { GEMINI_API_KEY: "key" })).toEqual({
      type: "gemini",
      requestedType: "gemini",
      fallbackReason: null,
    });
  });

  it("falls back when the requested worker binary is unavailable", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "opencode") {
        return Buffer.from("/usr/local/bin/opencode\n");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("claude-code", { OPENAI_API_KEY: "key" })).toEqual({
      type: "opencode",
      requestedType: "claude",
      fallbackReason: "claude worker binary is not installed.",
    });
  });

  it("uses the configured allowed-worker order when choosing a fallback", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "opencode" || args[0] === "gemini") {
        return Buffer.from(`/usr/local/bin/${args[0]}\n`);
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("codex", {}, ["opencode", "gemini", "codex"])).toEqual({
      type: "opencode",
      requestedType: "codex",
      fallbackReason: "codex ACP adapter is not installed.",
    });
  });

  it("accepts codex when the ACP adapter is available even without OPENAI_API_KEY", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp") {
        return Buffer.from("/usr/local/bin/codex-acp\n");
      }
      if (command === "codex" && args[0] === "login" && args[1] === "status") {
        return Buffer.from("Logged in using ChatGPT\n");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("codex", {})).toEqual({
      type: "codex",
      requestedType: "codex",
      fallbackReason: null,
    });
  });

  it("falls back from codex when only the MCP-only codex binary is installed", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex" || args[0] === "opencode") {
        return Buffer.from(`/usr/local/bin/${args[0]}\n`);
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("codex", {})).toEqual({
      type: "opencode",
      requestedType: "codex",
      fallbackReason: "codex ACP adapter is not installed.",
    });
  });

  it("accepts claude when the ACP adapter is available even without Anthropic env vars", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "claude-agent-acp") {
        return Buffer.from("/usr/local/bin/claude-agent-acp\n");
      }
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: true, authMethod: "claude.ai" }));
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("claude", {})).toEqual({
      type: "claude",
      requestedType: "claude",
      fallbackReason: null,
    });
  });

  it("checks Claude auth using the managed runtime PATH", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[], options: { env?: Record<string, string> } = {}) => {
      if (command === "claude" && args[0] === "auth" && args[1] === "status" && options.env?.PATH?.includes("/Users/tester/.local/bin")) {
        return Buffer.from(JSON.stringify({ loggedIn: true, authMethod: "claude.ai" }));
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: { HOME: "/Users/tester", PATH: "/usr/bin:/bin" },
      // Isolate from any ambient credential-profile dir under the test cwd so
      // this case exercises the CLI status probe, not profile detection.
      fileExists: () => false,
    })).toMatchObject({
      status: "authenticated",
      method: "status_command",
    });
  });

  it("detects claude login from the macOS Keychain when auth status lies", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: false, authMethod: "none" }));
      }
      if (command === "security" && args[0] === "find-generic-password" && args[2] === "Claude Code-credentials") {
        return Buffer.from("keychain: ...\nattributes: ...\n");
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: { HOME: "/Users/tester", PATH: "/usr/bin:/bin" },
      homeDir: "/Users/tester",
      fileExists: () => false,
      platform: "darwin",
    })).toMatchObject({
      status: "authenticated",
      method: "session_file",
    });
  });

  it("detects claude keychain credentials even when the caller refuses CLI probes", async () => {
    // The frontend catalog route injects a commandRunner that throws to avoid
    // blocking on slow CLI probes. The macOS Keychain lookup is a fast native
    // call and must still be performed via the real execFileSync.
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === "security" && args[0] === "find-generic-password" && args[2] === "Claude Code-credentials") {
        return Buffer.from("keychain: ...\nattributes: ...\n");
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    const refusingRunner = (() => {
      throw new Error("Frontend catalog requests skip blocking CLI probes.");
    }) as unknown as NonNullable<Parameters<typeof getWorkerAuthenticationInfo>[1]>["commandRunner"];

    expect(getWorkerAuthenticationInfo("claude", {
      env: { HOME: "/Users/tester", PATH: "/usr/bin:/bin" },
      homeDir: "/Users/tester",
      fileExists: () => false,
      platform: "darwin",
      commandRunner: refusingRunner,
    })).toMatchObject({
      status: "authenticated",
      method: "session_file",
    });
  });

  it("detects claude login from the legacy credentials file", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: false, authMethod: "none" }));
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: {},
      homeDir: "/Users/tester",
      fileExists: (filePath) => filePath === "/Users/tester/.claude/.credentials.json",
      platform: "linux",
    })).toMatchObject({
      status: "authenticated",
      method: "session_file",
    });
  });

  it("reports claude as not authenticated when no credentials exist anywhere", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: false, authMethod: "none" }));
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: {},
      homeDir: "/Users/tester",
      fileExists: () => false,
      platform: "darwin",
    })).toMatchObject({
      status: "not_authenticated",
      method: "missing",
    });
  });

  it("treats a command-backed credential profile as authenticated without login", async () => {
    // No CLI login, no API key, no session files — only a configured provider
    // script. The agent gets its credentials at spawn time, so the wizard must
    // not demand an interactive login.
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: {
        HOME: "/Users/tester",
        PATH: "/usr/bin:/bin",
        OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE: "/Users/tester/.local/bin/baton",
        OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_CLAUDE: '["credential-profile"]',
      },
      homeDir: "/Users/tester",
      fileExists: () => false,
      platform: "darwin",
    })).toMatchObject({
      status: "authenticated",
      method: "credential_profile",
    });
  });

  it("treats a credential profile directory as authenticated without login", async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: { HOME: "/Users/tester", PATH: "/usr/bin:/bin" },
      homeDir: "/Users/tester",
      // Simulate a `.omniharness/credential-profiles/claude` profile dir.
      fileExists: (filePath) => filePath.endsWith("/credential-profiles/claude"),
      platform: "linux",
    })).toMatchObject({
      status: "authenticated",
      method: "credential_profile",
    });
  });

  it("ignores credential profiles when OMNIHARNESS_CREDENTIAL_PROFILES=0", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: false, authMethod: "none" }));
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("claude", {
      env: {
        OMNIHARNESS_CREDENTIAL_PROFILES: "0",
        OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE: "/Users/tester/.local/bin/baton",
      },
      homeDir: "/Users/tester",
      fileExists: () => false,
      platform: "darwin",
    })).toMatchObject({
      status: "not_authenticated",
      method: "missing",
    });
  });

  it("accepts gemini when the CLI is available even without GEMINI_API_KEY", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "gemini") {
        return Buffer.from("/usr/local/bin/gemini\n");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("gemini", {})).toEqual({
      type: "gemini",
      requestedType: "gemini",
      fallbackReason: null,
    });
  });

  it("detects installed workers from the managed runtime PATH", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[], options: { env?: Record<string, string> } = {}) => {
      if (command === "which" && args[0] === "opencode" && options.env?.PATH?.includes("/Users/tester/.opencode/bin")) {
        return Buffer.from("/Users/tester/.opencode/bin/opencode\n");
      }
      throw new Error("not found");
    });

    const { getWorkerInstallationInfo, isSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");
    const env = { HOME: "/Users/tester", PATH: "/usr/bin:/bin" };

    expect(getWorkerInstallationInfo("opencode", { env })).toEqual({
      command: "opencode",
      path: "/Users/tester/.opencode/bin/opencode",
      dir: "/Users/tester/.opencode/bin",
    });
    expect(isSpawnableWorkerType("opencode", { env })).toEqual({
      ok: true,
      type: "opencode",
    });
  });

  it("throws an actionable error when nothing spawnable is available", async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(() => selectSpawnableWorkerType("claude-code", {})).toThrow(/No spawnable worker is available/i);
  });

  it("reports codex as not authenticated when login status fails", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp") {
        return Buffer.from("/usr/local/bin/codex-acp\n");
      }
      if (command === "codex" && args[0] === "login" && args[1] === "status") {
        throw new Error("not logged in");
      }
      throw new Error("not found");
    });

    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("codex", { fileExists: () => false })).toMatchObject({
      status: "not_authenticated",
      setupCommand: "codex login",
    });
  });

  it("detects gemini login from local oauth state without reading credentials", async () => {
    const { getWorkerAuthenticationInfo } = await import("@/server/supervisor/worker-availability");

    expect(getWorkerAuthenticationInfo("gemini", {
      env: {},
      homeDir: "/Users/tester",
      fileExists: (filePath) => filePath === "/Users/tester/.gemini/oauth_creds.json",
    })).toMatchObject({
      status: "authenticated",
      method: "session_file",
    });
  });

  it("parses reported monthly token quota text when a CLI exposes it", async () => {
    const { parseWorkerTokenQuotaOutput } = await import("@/server/supervisor/worker-availability");

    expect(parseWorkerTokenQuotaOutput("Monthly tokens remaining: 1,234,567 of 2,000,000", "test cli")).toMatchObject({
      status: "reported",
      remainingTokens: 1234567,
      monthlyLimitTokens: 2000000,
      source: "test cli",
    });
  });

  it("reports usage-only token stats when remaining quota is not exposed", async () => {
    const { parseWorkerTokenQuotaOutput } = await import("@/server/supervisor/worker-availability");

    expect(parseWorkerTokenQuotaOutput("Input 100\nOutput 250\nCache Read 50\nCache Write 25", "opencode stats")).toMatchObject({
      status: "usage_only",
      usedTokens: 425,
      source: "opencode stats",
    });
  });

  it("treats quota-blocked types as not spawnable when passed in options", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp" || args[0] === "claude-agent-acp") {
        return Buffer.from(`/usr/local/bin/${args[0]}\n`);
      }
      if (command === "codex" && args[0] === "login" && args[1] === "status") {
        return Buffer.from("Logged in using ChatGPT\n");
      }
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: true }));
      }
      throw new Error("not found");
    });

    const { isSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(isSpawnableWorkerType("codex", { quotaBlocked: new Set(["codex"]) })).toMatchObject({
      ok: false,
      type: "codex",
    });
    expect(isSpawnableWorkerType("codex", { quotaBlocked: new Set() })).toMatchObject({
      ok: true,
      type: "codex",
    });
  });

  it("selectSpawnableWorkerType honours the quotaBlocked set and walks the allowed list", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp" || args[0] === "claude-agent-acp") {
        return Buffer.from(`/usr/local/bin/${args[0]}\n`);
      }
      if (command === "codex" && args[0] === "login" && args[1] === "status") {
        return Buffer.from("Logged in using ChatGPT\n");
      }
      if (command === "claude" && args[0] === "auth" && args[1] === "status") {
        return Buffer.from(JSON.stringify({ loggedIn: true }));
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("codex", {}, ["codex", "claude"], {
      quotaBlocked: new Set(["codex"]),
    })).toMatchObject({
      type: "claude",
      requestedType: "codex",
    });
  });
});
