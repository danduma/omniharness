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

  test("keeps an auto-selected account across respawns", () => {
    // preferredWorkerAccountId is only set when the user pins an account, so an
    // auto-allocated subscription used to be dropped on every recreate. The
    // resulting accountId=null launch skipped the credential unset step, letting
    // a stale ANTHROPIC_API_KEY from settings outrank the OAuth subscription —
    // which the provider reports as "403 Account suspended".
    expect(resolveWorkerLaunchSelection({
      effectiveLaunchModel: "claude-opus-5",
      effectiveLaunchEffort: "high",
      launchCredentialSource: "account",
    }, {
      preferredWorkerModel: "claude-opus-5",
      preferredWorkerEffort: "high",
      preferredWorkerAccountId: null,
    }, { accountId: "claude-sub-1" })).toEqual({
      model: "claude-opus-5",
      effort: "high",
      accountId: "claude-sub-1",
      credentialSource: "account",
    });
  });

  test("lets an explicit run preference override the existing allocation", () => {
    expect(resolveWorkerLaunchSelection({ launchCredentialSource: "account" }, {
      preferredWorkerModel: "claude-opus-5",
      preferredWorkerAccountId: "claude-sub-2",
    }, { accountId: "claude-sub-1" }).accountId).toBe("claude-sub-2");
  });

  test("never attaches an account to a gateway launch", () => {
    expect(resolveWorkerLaunchSelection({
      launchCredentialSource: "gateway",
    }, {
      preferredWorkerModel: "cliproxyapi:gpt-5.6-sol",
      preferredWorkerAccountId: null,
    }, { accountId: "claude-sub-1" }).accountId).toBeNull();
  });
});
