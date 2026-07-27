import { describe, expect, test } from "vitest";
import {
  CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX,
  DEFAULT_CLAUDE_GATEWAY_MODELS,
  decodeClaudeGatewayModel,
  encodeClaudeGatewayModel,
  mergeClaudeGatewayModels,
  normalizeClaudeGatewayBaseUrl,
  parseClaudeModelGatewayStatus,
  validateClaudeGatewayModel,
} from "@/lib/claude-model-gateway";

describe("Claude model gateway identity", () => {
  test("requires HTTPS for remote gateway URLs while allowing loopback HTTP", () => {
    expect(normalizeClaudeGatewayBaseUrl("http://127.0.0.1:8317/")).toBe("http://127.0.0.1:8317");
    expect(normalizeClaudeGatewayBaseUrl("http://localhost:8317")).toBe("http://localhost:8317");
    expect(normalizeClaudeGatewayBaseUrl("https://gateway.example/v1/")).toBe("https://gateway.example/v1");
    expect(() => normalizeClaudeGatewayBaseUrl("http://gateway.example:8317")).toThrow(/https/i);
  });
  test("encodes and decodes a routed model without changing native Claude ids", () => {
    expect(encodeClaudeGatewayModel("gpt-5.6-sol")).toBe("cliproxyapi:gpt-5.6-sol");
    expect(decodeClaudeGatewayModel("cliproxyapi:gpt-5.6-sol")).toBe("gpt-5.6-sol");
    expect(decodeClaudeGatewayModel("claude-sonnet-5")).toBeNull();
    expect(CLAUDE_MODEL_GATEWAY_ROUTE_PREFIX).toBe("cliproxyapi:");
  });

  test.each([
    "",
    "   ",
    "cliproxyapi:",
    "cliproxyapi:   ",
    "cliproxyapi:gpt-5.6-sol",
    "contains\u0000control",
    "x".repeat(257),
  ])("rejects invalid raw model id %j", (rawId) => {
    expect(() => validateClaudeGatewayModel({ id: rawId })).toThrow();
  });

  test("normalizes an optional label and rejects control characters", () => {
    expect(validateClaudeGatewayModel({ id: "  gpt-5.6-sol  ", label: "  GPT 5.6 SOL  " })).toEqual({
      id: "gpt-5.6-sol",
      label: "GPT 5.6 SOL",
    });
    expect(() => validateClaudeGatewayModel({ id: "gpt-5.6-sol", label: "bad\nlabel" })).toThrow();
  });

  test("merges defaults, custom entries, and discoveries deterministically by raw id", () => {
    expect(DEFAULT_CLAUDE_GATEWAY_MODELS).toContainEqual({ id: "gpt-5.6-sol", label: "GPT-5.6 SOL" });

    const merged = mergeClaudeGatewayModels({
      custom: [
        { id: "gpt-5.6-sol", label: "Preferred SOL" },
        { id: "team/custom", label: "Team Custom" },
      ],
      discovered: [
        { id: "gpt-5.6-sol", label: "Discovered SOL" },
        { id: "alpha" },
        { id: "team/custom", label: "Discovered Custom" },
      ],
    });

    expect(merged).toEqual([
      {
        rawId: "gpt-5.6-sol",
        value: "cliproxyapi:gpt-5.6-sol",
        label: "Preferred SOL",
        source: "custom",
      },
      {
        rawId: "team/custom",
        value: "cliproxyapi:team/custom",
        label: "Team Custom",
        source: "custom",
      },
      {
        rawId: "alpha",
        value: "cliproxyapi:alpha",
        label: "alpha",
        source: "discovered",
      },
    ]);
  });
});

describe("Claude model gateway public status", () => {
  test("accepts a complete status and strips secret-shaped unknown fields", () => {
    const parsed = parseClaudeModelGatewayStatus({
      revision: 7,
      mode: "managed",
      enabled: true,
      installation: "installed",
      service: "running",
      oauth: "connected",
      connection: { baseUrl: "http://127.0.0.1:8317", apiTokenConfigured: true, managementTokenConfigured: true },
      installedVersion: "7.2.71",
      installedSource: "managed",
      operation: null,
      models: {
        custom: [{ id: "gpt-5.6-sol", label: "GPT-5.6 SOL" }],
        discovered: [{ id: "alpha" }],
        updatedAt: "2026-07-13T00:00:00.000Z",
        stale: false,
      },
      apiToken: "must-not-survive",
      managementSecret: "must-not-survive",
    });

    expect(parsed).toEqual({
      revision: 7,
      mode: "managed",
      enabled: true,
      installation: "installed",
      service: "running",
      oauth: "connected",
      connection: { baseUrl: "http://127.0.0.1:8317", apiTokenConfigured: true, managementTokenConfigured: true },
      installedVersion: "7.2.71",
      installedSource: "managed",
      operation: null,
      models: {
        custom: [{ id: "gpt-5.6-sol", label: "GPT-5.6 SOL" }],
        discovered: [{ id: "alpha" }],
        updatedAt: "2026-07-13T00:00:00.000Z",
        stale: false,
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("must-not-survive");
  });

  test.each([
    ["installation", "unknown"],
    ["service", "booting-forever"],
    ["oauth", "maybe"],
    ["mode", "other"],
  ])("rejects invalid %s state", (key, value) => {
    expect(() => parseClaudeModelGatewayStatus({
      revision: 1,
      mode: "managed",
      enabled: false,
      installation: "absent",
      service: "stopped",
      oauth: "disconnected",
      connection: { baseUrl: "http://127.0.0.1:8317", apiTokenConfigured: false, managementTokenConfigured: false },
      installedVersion: null,
      installedSource: null,
      operation: null,
      models: { custom: [], discovered: [], updatedAt: null, stale: false },
      [key]: value,
    })).toThrow();
  });
});
