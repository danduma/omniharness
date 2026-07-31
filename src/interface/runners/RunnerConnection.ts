import { QueryClient } from "@tanstack/react-query";
import { StateManager } from "@/lib/state-manager";
import { assessApiCompatibility } from "@/shared/api-revision";
import type { RunnerBootstrapIdentity } from "@/shared/bootstrap";
import type {
  RuntimeAPIs,
  RuntimeApiError,
  RuntimeSubscription,
} from "@/runtime-api/types";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import type {
  RunnerIdentityLearningResult,
  RunnerProfile,
  RunnerScopedState,
} from "./RunnerProfile";

export type RunnerConnectionStatus =
  | "connecting"
  | "online"
  | "offline"
  | "deferred"
  | "needs-reauth"
  | "tls-untrusted"
  | "identity-mismatch"
  | "incompatible"
  | "resync"
  | "degraded"
  | "runner-stopping";

export type RunnerConnectionSnapshot = {
  profileId: string;
  status: RunnerConnectionStatus;
  active: boolean;
  runnerInstanceId: string | null;
  runnerName: string;
  observedRunnerInstanceId: string | null;
  lastError: RuntimeApiError | null;
  retryAt: number | null;
  resyncCount: number;
  snapshot: Record<string, unknown> | null;
  bootstrap?: HomeBootstrapPayload | null;
};

export type RunnerStreamHandlers = {
  onOpen?(): void;
  onEvent?(event: unknown): void;
  onError?(error: RuntimeApiError): void;
};

export type RunnerConnectionRuntime = {
  apis?: RuntimeAPIs;
  bootstrap: {
    load(input: {
      selectedRunId?: string | null;
      draftProjectPath?: string | null;
      pairToken?: string | null;
    }): Promise<unknown>;
  };
  events: {
    snapshot(input: {
      runId?: string | null;
      persisted?: boolean;
      checksum?: string | null;
    }): Promise<{ data: unknown; lastEventId: string | null }>;
    open(input: {
      snapshot: boolean;
      runId?: string | null;
      lastEventId?: string | null;
    }, handlers: RunnerStreamHandlers): RuntimeSubscription;
  };
  terminals: {
    openStream(input: {
      terminalId: string;
      lastEventId?: string | null;
    }, handlers: RunnerStreamHandlers): RuntimeSubscription;
  };
};

export type RunnerConnectionPersistence = {
  getProfile(profileId: string): RunnerProfile | null;
  scopeKey(profileId: string): string;
  getScopedState(profileId: string): RunnerScopedState;
  updateScopedState(
    profileId: string,
    patch: Partial<RunnerScopedState>,
  ): Promise<void>;
  learnIdentity(
    profileId: string,
    runnerInstanceId: string,
    options?: {
      confirmIdentityChange?: boolean;
      validSameOriginSession?: boolean;
    },
  ): Promise<RunnerIdentityLearningResult>;
};

type ScheduleHandle = unknown;

export function calculateRunnerReconnectDelay(attempt: number, random = Math.random()) {
  const exponential = 1_000 * 2 ** Math.max(0, Math.floor(attempt));
  const jittered = exponential * (0.5 + Math.max(0, Math.min(1, random)));
  return Math.min(300_000, Math.max(250, Math.round(jittered)));
}

function normalizeRuntimeError(error: unknown): RuntimeApiError {
  if (error && typeof error === "object") {
    const candidate = error as Partial<RuntimeApiError> & { status?: unknown };
    const status = typeof candidate.status === "number" ? candidate.status : null;
    return {
      code: typeof candidate.code === "string"
        ? candidate.code
        : status
          ? `runtime.http_${status}`
          : "runtime.connection_failed",
      message: typeof candidate.message === "string"
        ? candidate.message
        : "Runner connection failed.",
      ...(candidate.details !== undefined ? { details: candidate.details } : {}),
    };
  }
  return {
    code: "runtime.connection_failed",
    message: String(error),
  };
}

function statusForError(error: RuntimeApiError): RunnerConnectionStatus {
  const code = error.code.toLowerCase();
  if (code.includes("401") || code.includes("unauthorized") || code.includes("auth")) {
    return "needs-reauth";
  }
  if (code.includes("tls") || code.includes("certificate")) {
    return "tls-untrusted";
  }
  if (code.includes("deferred")) {
    return "deferred";
  }
  return "offline";
}

function isBootstrapPayload(value: unknown): value is {
  runner: RunnerBootstrapIdentity;
  initialEventState?: Record<string, unknown> | null;
  initialLastEventId?: string | null;
  initialQueries?: {
    session?: {
      enabled?: boolean;
      authenticated?: boolean;
    } | null;
  };
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const runner = (value as { runner?: unknown }).runner;
  return Boolean(
    runner
    && typeof runner === "object"
    && typeof (runner as { runnerInstanceId?: unknown }).runnerInstanceId === "string"
    && typeof (runner as { name?: unknown }).name === "string",
  );
}

export class BoundedRunnerPreviewCache<T> {
  private readonly entries = new Map<string, T>();
  constructor(private readonly maximumEntries = 100) {}

  get(key: string) {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.maximumEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}

export class RunnerConnection extends StateManager<RunnerConnectionSnapshot> {
  private profile: RunnerProfile;
  private readonly runtimeFactory: (profile: RunnerProfile) => Promise<RunnerConnectionRuntime>;
  private readonly persistence: RunnerConnectionPersistence;
  private readonly queryClient: QueryClient;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delay: number) => ScheduleHandle;
  private readonly cancelSchedule: (handle: ScheduleHandle) => void;
  private readonly random: () => number;
  private readonly onIdentity?: (connection: RunnerConnection) => void;
  private runtime: RunnerConnectionRuntime | null = null;
  private mainStream: RuntimeSubscription | null = null;
  private readonly terminalStreams = new Map<string, RuntimeSubscription>();
  private retryTimer: ScheduleHandle | null = null;
  private retryAttempt = 0;
  private generation = 0;
  private started = false;
  private connecting: Promise<void> | null = null;
  private resyncing = false;
  private cursor: string | null;
  private readonly resyncTimes: number[] = [];
  readonly previewCache = new BoundedRunnerPreviewCache<unknown>();

  constructor(options: {
    profile: RunnerProfile;
    runtimeFactory: (profile: RunnerProfile) => Promise<RunnerConnectionRuntime>;
    persistence: RunnerConnectionPersistence;
    queryClient?: QueryClient;
    now?: () => number;
    schedule?: (callback: () => void, delay: number) => ScheduleHandle;
    cancelSchedule?: (handle: ScheduleHandle) => void;
    random?: () => number;
    onIdentity?: (connection: RunnerConnection) => void;
  }) {
    super({
      profileId: options.profile.id,
      status: "offline",
      active: false,
      runnerInstanceId: options.profile.runnerInstanceId,
      runnerName: options.profile.label,
      observedRunnerInstanceId: null,
      lastError: null,
      retryAt: null,
      resyncCount: 0,
      snapshot: null,
      bootstrap: null,
    });
    this.profile = options.profile;
    this.runtimeFactory = options.runtimeFactory;
    this.persistence = options.persistence;
    this.queryClient = options.queryClient ?? new QueryClient();
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancelSchedule = options.cancelSchedule ?? ((handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
    this.random = options.random ?? Math.random;
    this.onIdentity = options.onIdentity;
    this.cursor = options.persistence.getScopedState(options.profile.id).cursors.events || null;
  }

  getQueryClient() {
    return this.queryClient;
  }

  getRuntimeAPIs() {
    return this.runtime?.apis ?? null;
  }

  updateProfile(nextProfile: RunnerProfile) {
    const authenticationChanged = (
      nextProfile.baseUrl !== this.profile.baseUrl
      || nextProfile.credentialRef !== this.profile.credentialRef
      || nextProfile.authTransport !== this.profile.authTransport
    );
    this.profile = nextProfile;
    if (!authenticationChanged || !this.started) {
      return;
    }
    this.generation += 1;
    this.mainStream?.close();
    this.mainStream = null;
    this.closeTerminalStreams();
    this.runtime = null;
    void this.connect();
  }

  queryKey(...parts: readonly unknown[]) {
    return [this.getSnapshot().runnerInstanceId ?? this.profile.id, ...parts] as const;
  }

  async start() {
    if (this.started) {
      return this.connecting ?? Promise.resolve();
    }
    this.started = true;
    return this.connect();
  }

  retry() {
    if (!this.started) {
      return this.start();
    }
    return this.connect();
  }

  private async connect() {
    const generation = ++this.generation;
    this.clearRetry();
    this.patch({
      status: "connecting",
      retryAt: null,
      lastError: null,
    });
    const operation = this.connectGeneration(generation);
    this.connecting = operation;
    try {
      await operation;
    } finally {
      if (this.connecting === operation) {
        this.connecting = null;
      }
    }
  }

  private async connectGeneration(generation: number) {
    try {
      this.profile = this.persistence.getProfile(this.profile.id) ?? this.profile;
      const runtime = await this.runtimeFactory(this.profile);
      const payload = await runtime.bootstrap.load({});
      if (!this.isCurrent(generation)) return;
      if (!isBootstrapPayload(payload)) {
        throw {
          code: "runtime.bootstrap_invalid",
          message: "Runner bootstrap response is invalid.",
        };
      }
      const compatibility = assessApiCompatibility(payload.runner);
      if (!compatibility.compatible) {
        this.patch({
          status: "incompatible",
          observedRunnerInstanceId: payload.runner.runnerInstanceId,
          lastError: {
            code: "runtime.incompatible",
            message: "Runner API revisions are incompatible.",
          },
        });
        return;
      }
      const identity = await this.persistence.learnIdentity(
        this.profile.id,
        payload.runner.runnerInstanceId,
        {
          validSameOriginSession: this.profile.isSameOrigin,
        },
      );
      if (!this.isCurrent(generation)) return;
      if (identity.status === "identity_mismatch") {
        this.patch({
          status: "identity-mismatch",
          observedRunnerInstanceId: identity.observedRunnerInstanceId,
          lastError: {
            code: "runner.identity_mismatch",
            message: "The endpoint reports a different runner identity.",
          },
        });
        return;
      }
      this.profile = this.persistence.getProfile(identity.profileId) ?? {
        ...this.profile,
        runnerInstanceId: payload.runner.runnerInstanceId,
      };
      this.runtime = runtime;
      this.retryAttempt = 0;
      if (payload.initialLastEventId) {
        await this.persistCursor(payload.initialLastEventId);
      }
      this.patch({
        status: payload.runner.readinessState === "stopping"
          ? "runner-stopping"
          : "online",
        runnerInstanceId: payload.runner.runnerInstanceId,
        runnerName: payload.runner.name,
        observedRunnerInstanceId: null,
        snapshot: payload.initialEventState ?? null,
        bootstrap: payload as HomeBootstrapPayload,
        lastError: null,
        retryAt: null,
      });
      this.onIdentity?.(this);
      const session = payload.initialQueries?.session;
      if (session?.enabled && !session.authenticated) {
        this.patch({
          status: "needs-reauth",
          lastError: {
            code: "runtime.http_401",
            message: "Runner authorization is required.",
          },
        });
      } else if (payload.runner.readinessState !== "stopping") {
        this.openMainStream(generation);
      }
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.handleConnectionError(normalizeRuntimeError(error));
    }
  }

  private isCurrent(generation: number) {
    return this.started && generation === this.generation;
  }

  private openMainStream(generation: number) {
    if (!this.runtime || !this.isCurrent(generation)) return;
    this.mainStream?.close();
    this.mainStream = this.runtime.events.open({
      snapshot: false,
      runId: null,
      lastEventId: this.cursor,
    }, {
      onOpen: () => {
        if (!this.isCurrent(generation)) return;
        this.retryAttempt = 0;
        if (this.getSnapshot().status !== "runner-stopping") {
          this.patch({ status: "online", retryAt: null, lastError: null });
        }
      },
      onEvent: (event) => {
        if (this.isCurrent(generation)) {
          void this.handleStreamEvent(event, generation);
        }
      },
      onError: (error) => {
        if (this.isCurrent(generation)) {
          this.handleConnectionError(error);
        }
      },
    });
  }

  private async handleStreamEvent(event: unknown, generation: number) {
    if (!event || typeof event !== "object") return;
    const frame = event as {
      kind?: string;
      payload?: unknown;
      lastEventId?: string | null;
    };
    if (frame.kind === "stream.resync_required") {
      await this.handleResync(generation);
      return;
    }
    if (frame.kind === "runner.stopping") {
      this.patch({ status: "runner-stopping" });
      return;
    }
    if (frame.kind === "auth.session_revoked") {
      this.patch({
        status: "needs-reauth",
        lastError: {
          code: "runtime.http_401",
          message: "Runner authorization is required.",
        },
        retryAt: null,
      });
      this.mainStream?.close();
      this.mainStream = null;
      this.closeTerminalStreams();
      return;
    }
    if (frame.kind === "runner.renamed") {
      const name = (frame as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) {
        this.patch({ runnerName: name.trim() });
      }
      return;
    }
    if (frame.kind === "runner.rekeyed") {
      const observed = (frame as { runnerInstanceId?: unknown }).runnerInstanceId;
      if (
        typeof observed === "string"
        && observed
        && observed !== this.getSnapshot().runnerInstanceId
      ) {
        this.patch({
          status: "identity-mismatch",
          observedRunnerInstanceId: observed,
          lastError: {
            code: "runner.identity_mismatch",
            message: "The runner was rekeyed and needs identity confirmation.",
          },
        });
      }
      return;
    }
    if (frame.lastEventId) {
      await this.persistCursor(frame.lastEventId);
    }
    if (frame.kind === "update" && frame.payload && typeof frame.payload === "object") {
      this.patch({ snapshot: frame.payload as Record<string, unknown> });
    }
  }

  private async persistCursor(cursor: string) {
    this.cursor = cursor || null;
    await this.persistence.updateScopedState(this.profile.id, {
      cursors: { events: cursor },
    });
  }

  private async handleResync(generation: number) {
    if (!this.runtime || !this.isCurrent(generation)) return;
    const now = this.now();
    this.resyncTimes.push(now);
    while (this.resyncTimes[0] !== undefined && now - this.resyncTimes[0] > 5 * 60_000) {
      this.resyncTimes.shift();
    }
    this.patch({ resyncCount: this.resyncTimes.length });
    if (this.resyncTimes.length > 3) {
      this.mainStream?.close();
      this.mainStream = null;
      await this.persistCursor("");
      this.patch({
        status: "degraded",
        lastError: {
          code: "runtime.resync_storm",
          message: "Repeated stream resynchronization entered backoff.",
        },
      });
      this.scheduleReconnect();
      return;
    }
    if (this.resyncing) return;
    this.resyncing = true;
    await this.persistCursor("");
    this.mainStream?.close();
    this.mainStream = null;
    this.patch({ status: "resync" });
    try {
      const result = await this.runtime.events.snapshot({ persisted: true });
      if (!this.isCurrent(generation)) return;
      if (this.getSnapshot().status === "degraded") return;
      if (result.lastEventId) {
        await this.persistCursor(result.lastEventId);
      }
      if (result.data && typeof result.data === "object") {
        this.patch({ snapshot: result.data as Record<string, unknown> });
      }
      this.openMainStream(generation);
      this.patch({ status: "online" });
    } catch (error) {
      if (this.isCurrent(generation)) {
        this.handleConnectionError(normalizeRuntimeError(error));
      }
    } finally {
      this.resyncing = false;
    }
  }

  private handleConnectionError(error: RuntimeApiError) {
    const status = statusForError(error);
    this.patch({ status, lastError: error });
    this.mainStream?.close();
    this.mainStream = null;
    if (status === "offline") {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.started || this.retryTimer) return;
    const delay = calculateRunnerReconnectDelay(this.retryAttempt, this.random());
    this.retryAttempt += 1;
    this.patch({ retryAt: this.now() + delay });
    this.retryTimer = this.schedule(() => {
      this.retryTimer = null;
      if (this.started) {
        void this.connect();
      }
    }, delay);
  }

  private clearRetry() {
    if (!this.retryTimer) return;
    this.cancelSchedule(this.retryTimer);
    this.retryTimer = null;
  }

  stop() {
    this.started = false;
    this.generation += 1;
    this.clearRetry();
    this.mainStream?.close();
    this.mainStream = null;
    this.closeTerminalStreams();
    this.runtime = null;
    this.patch({
      status: "offline",
      retryAt: null,
    });
  }

  setActive(active: boolean) {
    this.patch({ active });
    if (!active) {
      this.closeTerminalStreams();
    }
  }

  openTerminalStream(
    terminalId: string,
    handlers: RunnerStreamHandlers,
    lastEventId?: string | null,
  ) {
    if (!this.getSnapshot().active || !this.runtime) {
      throw new Error("Terminal streams are available only on the active runner.");
    }
    this.terminalStreams.get(terminalId)?.close();
    const subscription = this.runtime.terminals.openStream(
      { terminalId, lastEventId },
      handlers,
    );
    this.terminalStreams.set(terminalId, subscription);
    return {
      close: () => {
        if (this.terminalStreams.get(terminalId) === subscription) {
          this.terminalStreams.delete(terminalId);
        }
        subscription.close();
      },
    };
  }

  private closeTerminalStreams() {
    for (const subscription of this.terminalStreams.values()) {
      subscription.close();
    }
    this.terminalStreams.clear();
  }
}
