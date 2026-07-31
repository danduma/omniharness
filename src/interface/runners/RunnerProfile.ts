export const RUNNER_PROFILE_SCHEMA_VERSION = 1 as const;
export const RUNNER_REGISTRY_SCHEMA_VERSION = 1 as const;

export type RunnerAuthTransport = "cookie" | "bearer";

export type RunnerProfile = {
  id: string;
  runnerInstanceId: string | null;
  label: string;
  baseUrl: string;
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
