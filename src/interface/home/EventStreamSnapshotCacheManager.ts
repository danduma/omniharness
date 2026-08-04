import type { AgentSnapshot, EventStreamState } from "./types";

const DEFAULT_STORAGE_KEY = "omni-event-stream-snapshot-cache:v1";
const DEFAULT_MAX_SNAPSHOTS = 8;
const DEFAULT_MAX_SERIALIZED_BYTES = 4_000_000;
const GLOBAL_SCOPE_KEY = "__global__";
// The event stream pushes a fresh snapshot for every agent output change,
// which on a chatty run is many frames per second. Serializing and writing
// the whole multi-megabyte envelope on each one blocked the main thread long
// enough to drop keystrokes in the composer — the worse the agent's output
// rate, the worse the typing lag, on any session. Reads are served from the
// in-memory envelope; the storage write is coalesced onto a trailing timer.
const DEFAULT_FLUSH_INTERVAL_MS = 1_000;

type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface CachedSnapshot {
  updatedAt: number;
  state: EventStreamState;
}

interface SnapshotEnvelope {
  version: 1;
  snapshots: Record<string, CachedSnapshot>;
}

interface EventStreamSnapshotCacheManagerOptions {
  storage?: SnapshotStorage | null;
  storageKey?: string;
  maxSnapshots?: number;
  maxSerializedBytes?: number;
  now?: () => number;
  flushIntervalMs?: number;
}

function getDefaultStorage(): SnapshotStorage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }

  return window.localStorage;
}

function scopeKey(scope: string | null | undefined) {
  return scope?.trim() || GLOBAL_SCOPE_KEY;
}

function emptyEnvelope(): SnapshotEnvelope {
  return {
    version: 1,
    snapshots: {},
  };
}

function compactAgent(agent: AgentSnapshot): AgentSnapshot {
  return {
    ...agent,
    outputEntries: agent.outputEntries?.map((entry) => ({
      ...entry,
      raw: undefined,
    })),
  };
}

function compactStateForCache(state: EventStreamState): EventStreamState {
  return {
    ...state,
    agents: (state.agents ?? []).map(compactAgent),
    frontendErrors: [],
  };
}

function preferInitialArray<T>(
  initial: T[] | undefined,
  cached: T[] | undefined,
  options: { serverAuthoritative: boolean },
) {
  if (options.serverAuthoritative && initial) {
    return initial;
  }

  return initial && initial.length > 0 ? initial : cached ?? [];
}

function isEventStreamState(value: unknown): value is EventStreamState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EventStreamState>;
  return Array.isArray(record.runs) && Array.isArray(record.messages);
}

export class EventStreamSnapshotCacheManager {
  private readonly storage: SnapshotStorage | null;
  private readonly storageKey: string;
  private readonly maxSnapshots: number;
  private readonly maxSerializedBytes: number;
  private readonly now: () => number;
  private readonly flushIntervalMs: number;
  private envelope: SnapshotEnvelope | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: EventStreamSnapshotCacheManagerOptions = {}) {
    const usesDefaultStorage = options.storage === undefined;
    this.storage = usesDefaultStorage ? getDefaultStorage() : options.storage ?? null;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxSnapshots = options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
    this.maxSerializedBytes = options.maxSerializedBytes ?? DEFAULT_MAX_SERIALIZED_BYTES;
    this.now = options.now ?? Date.now;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;

    // A coalesced write must not lose the last snapshot when the tab is
    // backgrounded or killed — on mobile PWAs `pagehide` is frequently the
    // only teardown signal that fires.
    if (usesDefaultStorage && this.storage && typeof window !== "undefined") {
      const flushNow = () => this.flush();
      window.addEventListener("pagehide", flushNow);
      window.addEventListener("visibilitychange", flushNow);
    }
  }

  hydrateState(initialState: EventStreamState, scope: string | null | undefined = null) {
    const cachedState = this.getCachedState(scope);
    if (!cachedState) {
      return initialState;
    }
    const arrayMergeOptions = {
      serverAuthoritative: initialState.snapshotSource === "server",
    };

    return {
      ...cachedState,
      ...initialState,
      messages: preferInitialArray(initialState.messages, cachedState.messages, arrayMergeOptions),
      plans: preferInitialArray(initialState.plans, cachedState.plans, arrayMergeOptions),
      runs: preferInitialArray(initialState.runs, cachedState.runs, arrayMergeOptions),
      accounts: preferInitialArray(initialState.accounts, cachedState.accounts, arrayMergeOptions),
      agents: preferInitialArray(initialState.agents, cachedState.agents, arrayMergeOptions),
      workers: preferInitialArray(initialState.workers, cachedState.workers, arrayMergeOptions),
      planItems: preferInitialArray(initialState.planItems, cachedState.planItems, arrayMergeOptions),
      clarifications: preferInitialArray(initialState.clarifications, cachedState.clarifications, arrayMergeOptions),
      executionEvents: preferInitialArray(initialState.executionEvents, cachedState.executionEvents, arrayMergeOptions),
      supervisorInterventions: preferInitialArray(initialState.supervisorInterventions, cachedState.supervisorInterventions, arrayMergeOptions),
      queuedMessages: preferInitialArray(initialState.queuedMessages, cachedState.queuedMessages, arrayMergeOptions),
      recoveryIncidents: preferInitialArray(initialState.recoveryIncidents, cachedState.recoveryIncidents, arrayMergeOptions),
      frontendErrors: [],
    };
  }

  getCachedState(scope: string | null | undefined = null): EventStreamState | null {
    const snapshot = this.readEnvelope().snapshots[scopeKey(scope)];
    if (!snapshot || !isEventStreamState(snapshot.state)) {
      return null;
    }

    return {
      ...snapshot.state,
      frontendErrors: [],
    };
  }

  /**
   * O(1) on the hot path: the envelope is mutated in memory and the
   * expensive part (compaction, serialization, the synchronous storage
   * write) is deferred to a single trailing flush. Reads go through the same
   * in-memory envelope, so a `rememberState` is observable immediately.
   */
  rememberState(state: EventStreamState, scope: string | null | undefined = null) {
    if (!this.storage) {
      return;
    }

    const currentEnvelope = this.readEnvelope();
    this.envelope = this.pruneEnvelope({
      ...currentEnvelope,
      snapshots: {
        ...currentEnvelope.snapshots,
        [scopeKey(scope)]: {
          updatedAt: this.now(),
          state,
        },
      },
    });

    this.scheduleFlush();
  }

  /** Write the pending envelope to storage now, cancelling any scheduled flush. */
  flush() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const envelope = this.envelope;
    if (!this.storage || !envelope) {
      return;
    }

    const serialized = JSON.stringify({
      version: 1,
      snapshots: Object.fromEntries(
        Object.entries(envelope.snapshots).map(([key, snapshot]) => [key, {
          updatedAt: snapshot.updatedAt,
          state: compactStateForCache(snapshot.state),
        }]),
      ),
    } satisfies SnapshotEnvelope);
    if (serialized.length > this.maxSerializedBytes) {
      return;
    }

    try {
      this.storage.setItem(this.storageKey, serialized);
    } catch {
      // localStorage can be unavailable or full. The live stream remains the source of truth.
    }
  }

  private scheduleFlush() {
    if (this.flushTimer !== null) {
      return;
    }

    if (this.flushIntervalMs <= 0) {
      this.flush();
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.flushIntervalMs);
    // Never hold the process open for a preview cache.
    (this.flushTimer as { unref?: () => void }).unref?.();
  }

  private readEnvelope(): SnapshotEnvelope {
    if (!this.storage) {
      return emptyEnvelope();
    }

    if (this.envelope) {
      return this.envelope;
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        this.envelope = emptyEnvelope();
        return this.envelope;
      }

      const parsed = JSON.parse(raw) as Partial<SnapshotEnvelope>;
      if (parsed.version !== 1 || typeof parsed.snapshots !== "object" || parsed.snapshots === null) {
        this.envelope = emptyEnvelope();
        return this.envelope;
      }

      this.envelope = {
        version: 1,
        snapshots: parsed.snapshots as Record<string, CachedSnapshot>,
      };
      return this.envelope;
    } catch {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore cleanup failures.
      }
      this.envelope = emptyEnvelope();
      return this.envelope;
    }
  }

  private pruneEnvelope(envelope: SnapshotEnvelope): SnapshotEnvelope {
    const snapshots = Object.fromEntries(
      Object.entries(envelope.snapshots)
        .sort((left, right) => {
          const updatedDelta = right[1].updatedAt - left[1].updatedAt;
          return updatedDelta !== 0 ? updatedDelta : left[0].localeCompare(right[0]);
        })
        .slice(0, this.maxSnapshots),
    );

    return {
      version: 1,
      snapshots,
    };
  }
}
