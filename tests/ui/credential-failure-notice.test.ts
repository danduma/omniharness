import { describe, expect, it } from "vitest";
import { buildCredentialReauthNotice } from "@/interface/home/credential-failure-notice";
import { annotateVerifiedDeadCredential } from "@/lib/provider-account-failures";
import type { AccountRecord } from "@/interface/home/types";

const REVOKED = "Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: "claude-sub-1",
    cliType: "claude",
    provider: "anthropic",
    type: "subscription",
    label: "claude-sub-1",
    authMode: "local_session",
    enabled: true,
    priority: 0,
    capacity: null,
    resetSchedule: null,
    status: null,
    statusCheckedAt: null,
    metadata: null,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

describe("credential re-authentication notice", () => {
  it("ignores failures the server did not prove dead", () => {
    // Auth wording alone is not proof; only a rejected probe earns the marker.
    for (const lastError of [REVOKED, "Ask failed: read ECONNRESET", null]) {
      expect(buildCredentialReauthNotice({
        lastError,
        accounts: [account()],
        workerType: "claude",
        workerLabel: "Claude Code",
      })).toBeNull();
    }
  });

  it("asks for a sign-in instead of a resend, and names the account", () => {
    const notice = buildCredentialReauthNotice({
      lastError: `Run failed: ${annotateVerifiedDeadCredential(REVOKED, "claude-sub-1")}`,
      accounts: [account({ label: "Daniel's Max plan" })],
      workerType: "claude",
      workerLabel: "Claude Code",
    });

    expect(notice?.action).toBe("Sign in again");
    expect(notice?.message).toContain("Daniel's Max plan");
    expect(notice?.suggestion).toBe("Run `claude` in a terminal and sign in with /login, then send your message again.");
    // The bug this fixes: the old copy told the user to send another message,
    // which respawns a worker against the same revoked token.
    expect(notice?.suggestion).not.toContain("respawn");
    // The doctor's spawn-readiness line said "Ready to spawn." next to a
    // revoked token; only the provider's own words are kept.
    expect(notice?.details).toEqual([REVOKED]);
  });

  it("points API-key accounts at settings rather than a terminal login", () => {
    const notice = buildCredentialReauthNotice({
      lastError: annotateVerifiedDeadCredential(REVOKED, "claude-api"),
      accounts: [account({ id: "claude-api", label: "Claude API key", authMode: "api_key", type: "api" })],
      workerType: "claude",
      workerLabel: "Claude Code",
    });

    expect(notice?.suggestion).toContain("API key");
    expect(notice?.suggestion).toContain("Claude API key");
  });

  it("falls back to generic wording when the account and CLI are unknown", () => {
    const notice = buildCredentialReauthNotice({
      lastError: annotateVerifiedDeadCredential(REVOKED, null),
      accounts: [],
      workerType: "opencode",
      workerLabel: "OpenCode",
    });

    expect(notice?.message).toContain("this account");
    expect(notice?.suggestion).toBe("Sign in to OpenCode in a terminal, then send your message again.");
  });
});
