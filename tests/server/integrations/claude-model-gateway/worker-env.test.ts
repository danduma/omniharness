import { describe, expect, test, vi } from "vitest";
import {
  buildClaudeGatewayEnvironment,
  parseClaudeCodeVersion,
  prepareClaudeGatewayLaunch,
} from "@/server/integrations/claude-model-gateway/worker-env";

describe("Claude model gateway worker environment", () => {
  test("leaves native Claude selections untouched", () => {
    expect(buildClaudeGatewayEnvironment({
      type: "claude",
      model: "claude-sonnet-5",
      accountId: "account-1",
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "token",
    })).toBeNull();
  });

  test("builds the exact required alias environment for routed models", () => {
    expect(buildClaudeGatewayEnvironment({
      type: "claude",
      model: "cliproxyapi:gpt-5.6-sol",
      accountId: null,
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "token",
    })).toEqual({
      rawModel: "gpt-5.6-sol",
      environment: {
        ANTHROPIC_BASE_URL: "http://127.0.0.1:8317",
        ANTHROPIC_AUTH_TOKEN: "token",
        ANTHROPIC_MODEL: "gpt-5.6-sol",
        CLAUDE_CODE_SUBAGENT_MODEL: "gpt-5.6-sol",
        CLAUDE_CODE_ALWAYS_ENABLE_EFFORT: "1",
        CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "3",
        ENABLE_TOOL_SEARCH: "false",
      },
    });
  });

  test("rejects a routed model for another worker, a non-null account, or a missing token", () => {
    for (const input of [
      { type: "codex", accountId: null, apiToken: "token" },
      { type: "claude", accountId: "account-1", apiToken: "token" },
      { type: "claude", accountId: null, apiToken: "" },
    ]) {
      expect(() => buildClaudeGatewayEnvironment({
        ...input,
        model: "cliproxyapi:gpt-5.6-sol",
        baseUrl: "http://127.0.0.1:8317",
      })).toThrow();
    }
  });

  test("adds gateway discovery variables only for Claude Code 2.1.129 and newer", () => {
    expect(parseClaudeCodeVersion("2.1.129 (Claude Code)")).toEqual([2, 1, 129]);
    const older = buildClaudeGatewayEnvironment({
      type: "claude", model: "cliproxyapi:gpt-5.6-sol", accountId: null,
      baseUrl: "http://127.0.0.1:8317", apiToken: "token", claudeCodeVersion: "2.1.128",
    });
    const supported = buildClaudeGatewayEnvironment({
      type: "claude", model: "cliproxyapi:gpt-5.6-sol", accountId: null,
      baseUrl: "http://127.0.0.1:8317", apiToken: "token", claudeCodeVersion: "2.1.129",
    });
    expect(older?.environment).not.toHaveProperty("ANTHROPIC_CUSTOM_MODEL_OPTION");
    expect(supported?.environment).toMatchObject({
      ANTHROPIC_CUSTOM_MODEL_OPTION: "gpt-5.6-sol",
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
    });
  });

  test("performs a readiness check and returns a fenced runtime request", async () => {
    const ensureReady = vi.fn(async () => ({
      mode: "external" as const,
      enabled: true,
      baseUrl: "http://127.0.0.1:8317",
      apiToken: "token",
      managementToken: "management",
      customModels: [],
      catalog: { models: [], updatedAt: null },
    }));
    await expect(prepareClaudeGatewayLaunch({
      type: "claude",
      model: "cliproxyapi:gpt-5.6-sol",
      accountId: null,
      ensureReady,
      detectVersion: async () => "2.1.129",
    })).resolves.toMatchObject({
      encodedModel: "cliproxyapi:gpt-5.6-sol",
      rawModel: "gpt-5.6-sol",
      credentialSource: "gateway",
    });
    expect(ensureReady).toHaveBeenCalledTimes(1);
    await expect(prepareClaudeGatewayLaunch({
      type: "claude",
      model: "cliproxyapi:gpt-5.6-sol",
      accountId: null,
      ensureReady,
      detectVersion: async () => "2.1.129",
    })).resolves.toMatchObject({
      environment: {
        ANTHROPIC_CUSTOM_MODEL_OPTION: "gpt-5.6-sol",
        CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      },
    });
  });
});
