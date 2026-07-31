import type {
  AuthSessionResponse,
  EventStreamState,
  SettingsResponse,
} from "@/shared/home-types";
import type { ApiRevisionWindow, RunnerCapabilityId } from "@/shared/api-revision";

export type RunnerBridgeState = "ready" | "degraded";

export type RunnerReadinessState =
  | "starting"
  | "ready"
  | "degraded"
  | "stopping"
  | "stopped";

export type RunnerBootstrapIdentity = {
  runnerInstanceId: string;
  name: string;
  version: string;
  apiRevision: ApiRevisionWindow;
  capabilities: RunnerCapabilityId[];
  bridgeState: RunnerBridgeState;
  readinessState: RunnerReadinessState;
  streamEpoch: string;
};

export type HomeBootstrapPayload = {
  id: string;
  route: {
    selectedRunId: string | null;
    draftProjectPath: string | null;
    pairTokenFromUrl: string | null;
  };
  initialEventState: EventStreamState | null;
  initialLastEventId: string;
  initialQueries: {
    session: AuthSessionResponse | null;
    settings: SettingsResponse | null;
  };
  features: {
    unifiedWorkerStream: boolean;
  };
  runner: RunnerBootstrapIdentity;
};
