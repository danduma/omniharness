import { describe, expect, it } from "vitest";
import {
  buildLaunchPreferenceBody,
  resolveComposerLaunchSelection,
} from "@/interface/home/composer-launch-selection";

const CLAUDE_MODELS = ["claude-opus-5", "claude-fable-5-1", "claude-sonnet-5"];

function resolve(overrides: Partial<Parameters<typeof resolveComposerLaunchSelection>[0]> = {}) {
  return resolveComposerLaunchSelection({
    selectedCliAgent: "claude",
    selectedModel: "claude-fable-5-1",
    selectedEffort: "High",
    selectedWorkerAccountId: "auto",
    autoSelectedWorkerType: "claude",
    activeAllowedWorkerTypes: ["claude"],
    activeWorkerModelValues: CLAUDE_MODELS,
    ...overrides,
  });
}

describe("composer launch selection", () => {
  it("carries the model the composer is showing", () => {
    expect(resolve()).toMatchObject({
      workerType: "claude",
      model: "claude-fable-5-1",
      effort: "high",
      accountId: null,
      allowedWorkerTypes: ["claude"],
    });
  });

  it("keeps the picked model when the worker is resolved automatically", () => {
    expect(resolve({
      selectedCliAgent: "auto",
      autoSelectedWorkerType: "claude",
      activeAllowedWorkerTypes: ["claude", "codex"],
    })).toMatchObject({
      workerType: "claude",
      isAutoWorkerSelection: true,
      model: "claude-fable-5-1",
      allowedWorkerTypes: ["claude", "codex"],
    });
  });

  it("asserts no model when an automatic worker inherits another worker's leftover choice", () => {
    expect(resolve({
      selectedCliAgent: "auto",
      selectedModel: "gpt-5.6-sol",
      autoSelectedWorkerType: "claude",
    }).model).toBeNull();
  });

  it("never emits a model reset, so a conversation keeps the model its last message ran on", () => {
    const body = buildLaunchPreferenceBody(resolve({
      selectedCliAgent: "auto",
      selectedModel: "gpt-5.6-sol",
      autoSelectedWorkerType: "claude",
    }));

    expect(body).not.toHaveProperty("preferredWorkerModel");
    expect(Object.keys(body)).toEqual([
      "preferredWorkerType",
      "preferredWorkerEffort",
      "preferredWorkerAccountId",
      "allowedWorkerTypes",
      "preferredWorkerPermissionMode",
    ]);
  });

  it("sends a permission mode only when the launching CLI offers it", () => {
    const claudeBypass = buildLaunchPreferenceBody(resolve({
      selectedCliAgent: "claude",
      selectedModel: "claude-opus-5-5",
      selectedPermissionMode: "full-access",
    }));
    expect(claudeBypass.preferredWorkerPermissionMode).toBe("full-access");

    const followDefault = buildLaunchPreferenceBody(resolve({
      selectedCliAgent: "claude",
      selectedModel: "claude-opus-5-5",
      selectedPermissionMode: "",
    }));
    expect(followDefault.preferredWorkerPermissionMode).toBe("");

    // A Claude-only mode left over when "auto" resolves to Codex is not sent,
    // so it neither applies nor clears the conversation's mode.
    const leftover = buildLaunchPreferenceBody(resolve({
      selectedCliAgent: "auto",
      selectedModel: "gpt-5.6-sol",
      autoSelectedWorkerType: "codex",
      selectedPermissionMode: "acceptEdits",
    }));
    expect(leftover).not.toHaveProperty("preferredWorkerPermissionMode");
  });

  it("sends the selected model when there is one to assert", () => {
    expect(buildLaunchPreferenceBody(resolve())).toMatchObject({
      preferredWorkerType: "claude",
      preferredWorkerModel: "claude-fable-5-1",
      preferredWorkerEffort: "high",
    });
  });

  it("passes an explicit account through and normalizes opencode model ids", () => {
    expect(resolve({
      selectedCliAgent: "opencode",
      selectedModel: "claude-sonnet-5",
      selectedWorkerAccountId: "account-7",
      activeWorkerModelValues: ["anthropic/claude-sonnet-5"],
    })).toMatchObject({
      workerType: "opencode",
      model: "anthropic/claude-sonnet-5",
      accountId: "account-7",
    });
  });
});
