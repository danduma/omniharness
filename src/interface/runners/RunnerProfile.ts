export const RUNNER_PROFILE_SCHEMA_VERSION = 1 as const;
export const RUNNER_REGISTRY_SCHEMA_VERSION = 1 as const;

export type RunnerAuthTransport = "cookie" | "bearer";

export type RunnerProfile = {
  id: string;
  runnerInstanceId: string | null;
  label: string;
  baseUrl: string;
  savedPassword: string | null;
  authTransport: RunnerAuthTransport;
  credentialRef: string | null;
  schemaVersion: typeof RUNNER_PROFILE_SCHEMA_VERSION;
  createdAt: string;
  lastConnectedAt: string | null;
  isSameOrigin: boolean;
};

export type RunnerScopedState = {
  preferences: Record<string, unknown>;
  drafts: Record<string, string>;
  cursors: Record<string, string>;
};

export type RunnerProfileStoreSnapshot = {
  schemaVersion: typeof RUNNER_REGISTRY_SCHEMA_VERSION;
  hydrated: boolean;
  activeRunnerId: string;
  profiles: RunnerProfile[];
  scopedState: Record<string, RunnerScopedState>;
  recoveryNoticeCode: string | null;
};

export type RunnerIdentityLearningResult =
  | { status: "accepted"; profileId: string }
  | { status: "merged"; profileId: string }
  | {
      status: "identity_mismatch";
      profileId: string;
      expectedRunnerInstanceId: string;
      observedRunnerInstanceId: string;
    };

export function emptyRunnerScopedState(): RunnerScopedState {
  return {
    preferences: {},
    drafts: {},
    cursors: {},
  };
}

/**
 * Is this page served over HTTPS while the server speaks plain HTTP?
 *
 * The browser owns this decision, not the page and not the server: an HTTPS
 * document may not issue requests to an `http://` origin, and no header, flag
 * or fetch option opts back in. Only the page origin decides, so the native
 * surfaces stay exempt by passing their own `http://127.0.0.1` origin.
 */
export function isInsecureServerFromSecurePage(
  pageOrigin: string,
  baseUrl: string,
) {
  try {
    return new URL(pageOrigin).protocol === "https:"
      && new URL(baseUrl).protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Loopback addresses are potentially trustworthy origins, so browsers exempt
 * them from mixed-content blocking and `http://localhost` can still answer an
 * HTTPS page. Every other `http://` address is refused before the request is
 * ever sent, which is knowable up front rather than only after it fails.
 */
export function isMixedContentBlocked(pageOrigin: string, baseUrl: string) {
  if (!isInsecureServerFromSecurePage(pageOrigin, baseUrl)) {
    return false;
  }
  const host = new URL(baseUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const loopback = host === "localhost"
    || host.endsWith(".localhost")
    || host === "::1"
    || /^127(?:\.\d{1,3}){3}$/.test(host);
  return !loopback;
}
