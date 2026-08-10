import { describe, expect, it } from "vitest";
import {
  annotateVerifiedLiveCredential,
  classifyProviderAccountFailure,
  isAuthShapedProviderFailure,
  isPermanentAccountFailure,
  isPoisonedSessionFailure,
  stripProviderFailureMarkers,
} from "@/lib/provider-account-failures";

const SUSPENDED = "Internal error: Failed to authenticate. API Error: 403 Account suspended";
const REVOKED = "Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";

describe("provider account failure classification", () => {
  it("treats unverified auth wording as permanent", () => {
    // Nothing has probed the credential, so we must assume the account really
    // is dead rather than spinning recovery against it.
    for (const message of [
      SUSPENDED,
      REVOKED,
      "Spawn failed: authentication_failed",
      "Ask failed: Internal error: invalid_api_key",
      "Ask failed: Internal error: refresh token was revoked",
    ]) {
      expect(isAuthShapedProviderFailure(message)).toBe(true);
      expect(isPermanentAccountFailure(message)).toBe(true);
    }
  });

  it("stops treating auth wording as permanent once the credential is verified live", () => {
    // The regression this whole module exists for: Anthropic intermittently
    // answers a healthy Max subscription with "403 Account suspended". The
    // credential probe proves the account can still answer, so the run must
    // stay recoverable instead of latching forever.
    for (const message of [SUSPENDED, REVOKED]) {
      const verified = annotateVerifiedLiveCredential(message);
      expect(isPermanentAccountFailure(message)).toBe(true);
      expect(isPermanentAccountFailure(verified)).toBe(false);
    }
  });

  it("keeps billing, quota and resource failures permanent even when the credential works", () => {
    // A live credential does not refill an exhausted cap, so the marker must
    // not resurrect these.
    for (const message of [
      "The run cannot continue due to an API billing error (402 Runner billing required: cap_exceeded).",
      "Model request failed: resource exhausted due to insufficient quota",
      "Cannot spawn worker because system resources are low (disk free 6912 MB, below 8192 MB).",
    ]) {
      expect(isPermanentAccountFailure(message)).toBe(true);
      expect(isPermanentAccountFailure(annotateVerifiedLiveCredential(message))).toBe(true);
    }
  });

  it("keeps a poisoned session out of the account gate so the retry that replaces it is allowed", () => {
    // The recover-run route blocks retries on account failures. An ACP
    // diagnostic is not one: the account is healthy and the retry is precisely
    // what swaps the poisoned session out.
    const diagnostic = "Ask failed: Internal error: [ede_diagnostic] result_type=user stop_reason=null";
    expect(isPoisonedSessionFailure(diagnostic)).toBe(true);
    expect(isPermanentAccountFailure(diagnostic)).toBe(false);
  });

  it("leaves transient failures alone", () => {
    for (const message of [
      "Ask failed: read ECONNRESET",
      "Ask failed: API Error: 429 rate limit reached for this account",
    ]) {
      expect(classifyProviderAccountFailure(message)).toBe("none");
      expect(isPermanentAccountFailure(message)).toBe(false);
    }
  });

  it("hides the internal marker from user-facing text", () => {
    expect(stripProviderFailureMarkers(annotateVerifiedLiveCredential(SUSPENDED))).toBe(SUSPENDED);
    expect(annotateVerifiedLiveCredential(annotateVerifiedLiveCredential(SUSPENDED)))
      .toBe(annotateVerifiedLiveCredential(SUSPENDED));
  });
});
