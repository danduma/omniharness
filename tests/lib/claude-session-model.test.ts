import { describe, expect, it } from "vitest";
import { isOneMillionContextModel, resolveClaudeSessionModel } from "@/lib/claude-session-model";

// Mirrors what the Claude ACP adapter reports for a subscription-only account:
// Fable is offered exclusively as its 1M-context variant, and `opus` is a bare
// alias whose actual version only shows up in the description.
const SUBSCRIPTION_OPTIONS = [
  { value: "default", name: "Default (recommended)", description: "Sonnet 4.6 · Efficient for routine tasks" },
  { value: "claude-fable-5[1m]", name: "Fable", description: "Fable 5 · Most capable for your hardest tasks" },
  { value: "opus", name: "Opus", description: "Opus 4.8 · Best for everyday, complex tasks" },
  { value: "haiku", name: "Haiku", description: "Haiku 4.5 · Fastest for quick answers" },
];

describe("claude session model pinning", () => {
  it("detects 1M-context variants", () => {
    expect(isOneMillionContextModel("claude-fable-5[1m]")).toBe(true);
    expect(isOneMillionContextModel("opus[1m]")).toBe(true);
    expect(isOneMillionContextModel("opus")).toBe(false);
  });

  it("refuses to answer an Opus 5 request with the Opus 4.8 alias", () => {
    // Regression: this used to resolve to { value: "opus", reason: "requested" }.
    // The adapter's `opus` alias runs 4.8, so a run the user launched — and the
    // database recorded — as Opus 5 silently executed on Opus 4.8.
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "claude-opus-5",
      current: "default",
    })).toEqual({
      status: "unavailable",
      requested: "claude-opus-5",
      requestedVersion: "5",
      offeredVersion: "4.8",
      available: ["default", "claude-fable-5[1m]", "opus", "haiku"],
    });
  });

  it("pins the family alias when the requested version does match it", () => {
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "claude-opus-4-8",
      current: "default",
    })).toEqual({ status: "pin", value: "opus", reason: "requested" });
  });

  it("pins an unversioned family request without complaint", () => {
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "opus",
      current: "default",
    })).toEqual({ status: "pin", value: "opus", reason: "requested" });
  });

  it("flags a family alias whose version cannot be verified", () => {
    expect(resolveClaudeSessionModel({
      options: [
        { value: "default", name: "Default", description: "Efficient for routine tasks" },
        { value: "opus", name: "Opus", description: "Best for complex tasks" },
      ],
      requested: "claude-opus-5",
      current: "default",
    })).toEqual({ status: "pin", value: "opus", reason: "family_alias_unverified" });
  });

  it("never lands on a 1M variant when the request did not ask for one", () => {
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "claude-fable-5",
      current: "default",
    })).toEqual({ status: "keep" });

    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "claude-fable-5",
      current: "claude-fable-5[1m]",
    })).toEqual({ status: "pin", value: "default", reason: "standard_context_fallback" });
  });

  it("honors an explicit 1M request", () => {
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "claude-fable-5[1m]",
      current: "default",
    })).toEqual({ status: "pin", value: "claude-fable-5[1m]", reason: "requested" });
  });

  it("rescues a session that inherited a 1M model with nothing requested", () => {
    expect(resolveClaudeSessionModel({
      options: [
        { value: "default", name: "Default (recommended)", description: "Sonnet 4.6" },
        { value: "opus[1m]", name: "Opus (1M context)", description: "Opus 4.8" },
      ],
      requested: null,
      current: "opus[1m]",
    })).toEqual({ status: "pin", value: "default", reason: "avoid_1m_default" });
  });

  it("leaves a healthy session alone", () => {
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: null,
      current: "opus",
    })).toEqual({ status: "keep" });

    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "opus",
      current: "opus",
    })).toEqual({ status: "keep" });
  });

  it("reports a sonnet 5 request as unavailable when only sonnet 4.6 is offered", () => {
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "claude-sonnet-5",
      current: "opus",
    })).toEqual({
      status: "unavailable",
      requested: "claude-sonnet-5",
      requestedVersion: "5",
      offeredVersion: "4.6",
      available: ["default", "claude-fable-5[1m]", "opus", "haiku"],
    });
  });

  it("does nothing without a model option list", () => {
    expect(resolveClaudeSessionModel({ options: [], requested: "claude-opus-5", current: null }))
      .toEqual({ status: "keep" });
  });
});
