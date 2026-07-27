import { describe, expect, test } from "vitest";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";

describe("worker launch selection", () => {
  test("prefers the worker reservation over a later run preference", () => {
    expect(resolveWorkerLaunchSelection({
      effectiveLaunchModel: "cliproxyapi:gpt-5.6-sol",
      effectiveLaunchEffort: "high",
      launchCredentialSource: "gateway",
    }, {
      preferredWorkerModel: "claude-sonnet-5",
      preferredWorkerEffort: "medium",
      preferredWorkerAccountId: "claude-account",
    })).toEqual({
      model: "cliproxyapi:gpt-5.6-sol",
      effort: "high",
      accountId: null,
      credentialSource: "gateway",
    });
  });

  test("falls back to run preferences for legacy workers", () => {
    expect(resolveWorkerLaunchSelection({}, {
      preferredWorkerModel: "claude-sonnet-5",
      preferredWorkerEffort: "medium",
      preferredWorkerAccountId: "claude-account",
    })).toEqual({
      model: "claude-sonnet-5",
      effort: "medium",
      accountId: "claude-account",
      credentialSource: "account",
    });
  });
});
