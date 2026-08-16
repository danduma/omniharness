// Single source of truth for "is this provider failure the account's fault?".
//
// This used to live as four independent regexes — the frontend auto-resume
// gate, the recover-run route, the supervisor retry gate, and the git
// auto-commit gate — which drifted apart. "403 Account suspended" matched the
// frontend one but not the other three, so the same failure was simultaneously
// permanent and retryable depending on who asked.
//
// The harder problem the split hid: these patterns read provider error TEXT and
// treated a match as proof the credential is dead. Anthropic intermittently
// answers a single prompt with "403 Account suspended" or "401 OAuth access
// token has been revoked" while the credential is perfectly alive — the very
// next request succeeds. Text alone cannot tell a dead credential from a blip,
// so every text-only fix latched live accounts into an unrecoverable failed
// run. Permanence is now decided by probing the credential (see
// `verifyAccountCredentialLiveness`), and the verdict is carried in the message
// with the marker below.

export const CREDENTIAL_VERIFIED_LIVE_MARKER = "[credential_verified_live]";

// The mirror image: the probe was rejected too, so the credential really is
// dead. Recovery already treats unmarked auth wording as permanent, so this
// marker changes no gate — it exists so the UI can stop telling the user to
// "send a message to reconnect" (which can only fail again) and say
// "re-authenticate this account" instead. The optional payload is the account
// id the worker was using, so the notice can name it.
export const CREDENTIAL_VERIFIED_DEAD_MARKER = "[credential_verified_dead]";

const CREDENTIAL_VERIFIED_DEAD_PATTERN = /\[credential_verified_dead(?::([^\]\s]+))?\]/;

// Auth-shaped wording. Matching this means "the provider blamed the
// credential", NOT "the credential is dead" — callers must verify before
// treating it as permanent.
const AUTH_FAILURE_PATTERN = /\b(?:api key not valid|invalid[ _]api[ _]key|api key|authentication required|auth(?:entication)? failed|failed to auth(?:enticate)?|authentication[ _]failed|account suspended|account (?:is )?(?:disabled|banned|deactivated)|(?:access |refresh )?token (?:has been |was )?revoked|token expired|unauthorized)\b/i;

// Billing, quota and capacity limits. These are genuinely not retryable by
// spinning: the account has to be topped up or has to wait for a reset.
const BILLING_FAILURE_PATTERN = /\b(?:billing required|api billing|cap_exceeded|insufficient quota|quota exceeded)\b/i;

const RESOURCE_FAILURE_PATTERN = /\b(?:resource exhausted|system resources are low|worker\.spawn\.resource_exhausted)\b/i;

const DIAGNOSTIC_FAILURE_PATTERN = /\[?\bede_diagnostic\b\]?/i;

export type ProviderAccountFailureKind = "auth" | "billing" | "resource" | "diagnostic" | "none";

export function hasVerifiedLiveCredentialMarker(message: string | null | undefined) {
  return (message ?? "").includes(CREDENTIAL_VERIFIED_LIVE_MARKER);
}

/**
 * Stamp a failure whose credential was probed and found working. The provider
 * text is preserved verbatim so the user still sees what the API actually said;
 * the marker only tells the recovery machinery not to treat it as permanent.
 */
export function annotateVerifiedLiveCredential(message: string | null | undefined) {
  const text = (message ?? "").trim();
  if (hasVerifiedLiveCredentialMarker(text)) {
    return text;
  }
  return text.length > 0 ? `${text} ${CREDENTIAL_VERIFIED_LIVE_MARKER}` : CREDENTIAL_VERIFIED_LIVE_MARKER;
}

export function hasVerifiedDeadCredentialMarker(message: string | null | undefined) {
  return CREDENTIAL_VERIFIED_DEAD_PATTERN.test(message ?? "");
}

/**
 * Which account was proven dead, when the marker carried an id. Null both when
 * the failure is not marked and when the worker had no account allocated.
 */
export function readVerifiedDeadCredentialAccountId(message: string | null | undefined) {
  return CREDENTIAL_VERIFIED_DEAD_PATTERN.exec(message ?? "")?.[1] ?? null;
}

/**
 * Stamp a failure whose credential was probed and rejected a second time. The
 * provider text is preserved verbatim; the marker only tells the UI that
 * re-authentication — not another send — is what fixes this.
 */
export function annotateVerifiedDeadCredential(message: string | null | undefined, accountId?: string | null) {
  const text = (message ?? "").trim();
  if (hasVerifiedDeadCredentialMarker(text)) {
    return text;
  }
  // An id with a bracket or whitespace in it would not survive the round trip,
  // so drop it and keep the generic marker rather than emit an unparseable one.
  const id = (accountId ?? "").trim();
  const marker = id && /^[^\][\s]+$/.test(id)
    ? `[credential_verified_dead:${id}]`
    : CREDENTIAL_VERIFIED_DEAD_MARKER;
  return text.length > 0 ? `${text} ${marker}` : marker;
}

/** Strip internal markers before showing a failure to a human. */
export function stripProviderFailureMarkers(message: string | null | undefined) {
  return (message ?? "")
    .split(CREDENTIAL_VERIFIED_LIVE_MARKER).join("")
    .replace(CREDENTIAL_VERIFIED_DEAD_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Does the provider's wording blame the credential? Says nothing about permanence. */
export function isAuthShapedProviderFailure(message: string | null | undefined) {
  return AUTH_FAILURE_PATTERN.test(message ?? "");
}

export function classifyProviderAccountFailure(message: string | null | undefined): ProviderAccountFailureKind {
  const text = message ?? "";
  if (BILLING_FAILURE_PATTERN.test(text)) return "billing";
  if (RESOURCE_FAILURE_PATTERN.test(text)) return "resource";
  if (DIAGNOSTIC_FAILURE_PATTERN.test(text)) return "diagnostic";
  if (AUTH_FAILURE_PATTERN.test(text)) return "auth";
  return "none";
}

/**
 * Is this failure the account's own fault — dead credential, exhausted billing,
 * or exhausted capacity? These cannot be fixed by retrying the same request.
 *
 * An auth-shaped failure whose credential was probed and found alive is a
 * provider blip, so it stays recoverable. Billing, quota and resource failures
 * are permanent regardless of the marker — a working credential does not refill
 * an exhausted cap.
 */
export function isPermanentAccountFailure(message: string | null | undefined) {
  const kind = classifyProviderAccountFailure(message);
  if (kind === "auth") {
    return !hasVerifiedLiveCredentialMarker(message);
  }
  return kind === "billing" || kind === "resource";
}

/**
 * A resumed ACP session stuck at an interrupted tool/permission boundary.
 *
 * Deliberately NOT part of `isPermanentAccountFailure`: the account is fine, so
 * the recover-run route must still allow a retry — that retry is exactly what
 * replaces the poisoned session. Callers that would re-ask the *same* session
 * (the supervisor retry loop, the frontend auto-resume timer) have to treat it
 * as permanent, because replaying it just repeats the broken state.
 */
export function isPoisonedSessionFailure(message: string | null | undefined) {
  return classifyProviderAccountFailure(message) === "diagnostic";
}
