import type { EventStreamState, MessageRecord } from "./types";
import { EventStreamSnapshotCacheManager } from "./EventStreamSnapshotCacheManager";
import { isTerminalRunStatus } from "@/lib/run-status";
import { parseGoalSnapshot } from "@/shared/goal-plan";

type EventStreamStateListener = (state: EventStreamState) => void;
type EventStreamStateAction = EventStreamState | ((current: EventStreamState) => EventStreamState);
type EventStreamSnapshotSource = NonNullable<EventStreamState["snapshotSource"]>;

function messageTimestampMs(message: MessageRecord) {
  const value = new Date(message.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortMessages(messages: MessageRecord[]) {
  return [...messages].sort((a, b) => {
    const timeDelta = messageTimestampMs(a) - messageTimestampMs(b);
    return timeDelta !== 0 ? timeDelta : a.id.localeCompare(b.id);
  });
}

type RunRecord = EventStreamState["runs"][number];

/**
 * True when a rebuilt state carries nothing the current one does not already
 * have, so the incoming copy can be dropped and the existing object identity
 * kept.
 *
 * The server stamps every snapshot with `snapshotChecksum` over the whole
 * payload (`server/events/payload-checksum.ts`), so an equal checksum means an
 * identical server-side view. Comparing the merged arrays by identity would be
 * useless here — a re-delivered payload is a fresh `JSON.parse`, so every array
 * is a new object even when byte-identical. The checksum is the only cheap
 * signal that actually distinguishes "same data" from "new data".
 *
 * Scope-defining fields are still compared, because a frame that only switches
 * `snapshotRunId` must not be swallowed just because the catalog hashed the
 * same.
 *
 * Dropping the duplicate also protects optimistic state: after a local
 * mutation, `snapshotChecksum` still reflects the last *server* view, so a poll
 * that re-delivers that same view would otherwise revert the optimistic change
 * and flicker until the server caught up.
 */
function isNoOpSnapshotUpdate(current: EventStreamState, next: EventStreamState) {
  const checksum = next.snapshotChecksum;
  if (!checksum || checksum !== current.snapshotChecksum) {
    return false;
  }

  return next.snapshotRunId === current.snapshotRunId
    && next.snapshotSource === current.snapshotSource
    && next.messageScope?.complete === current.messageScope?.complete;
}

function mergeByKey<T>(current: T[] | undefined, incoming: T[] | undefined, getKey: (item: T) => string | null | undefined) {
  const incomingItems = incoming ?? [];
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of incomingItems) {
    const key = getKey(item);
    if (key) {
      seen.add(key);
    }
    merged.push(item);
  }

  for (const item of current ?? []) {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function runUpdatedTimestampMs(run: RunRecord) {
  const value = new Date(run.updatedAt || run.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeReadMarkersForVisibleRuns(current: EventStreamState, incoming: EventStreamState) {
  const visibleRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const merged: Record<string, string> = {};

  for (const [runId, readAt] of Object.entries(current.readMarkers ?? {})) {
    if (visibleRunIds.has(runId)) {
      merged[runId] = readAt;
    }
  }

  for (const [runId, readAt] of Object.entries(incoming.readMarkers ?? {})) {
    if (!visibleRunIds.has(runId)) {
      continue;
    }
    if (timestampMs(readAt) >= timestampMs(merged[runId])) {
      merged[runId] = readAt;
    }
  }

  return merged;
}

function mergeGoalSnapshots(
  current: EventStreamState,
  incoming: EventStreamState,
  serverAuthoritative: boolean,
) {
  const merged = { ...(current.goalsByRunId ?? {}) };
  const incomingGoals = incoming.goalsByRunId ?? {};
  for (const [runId, rawSnapshot] of Object.entries(incomingGoals)) {
    const snapshot = parseGoalSnapshot(rawSnapshot);
    const existing = merged[runId];
    if (!existing || snapshot.revision > existing.revision || (
      snapshot.revision === existing.revision
      && snapshot.provenance.source === "server"
      && existing.provenance.source !== "server"
    )) {
      merged[runId] = snapshot;
    }
  }

  const scopedRunId = incoming.snapshotRunId?.trim();
  if (serverAuthoritative && scopedRunId && !(scopedRunId in incomingGoals)) {
    delete merged[scopedRunId];
  }
  const visibleRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  if (serverAuthoritative && incoming.snapshotScope?.catalog?.complete === true) {
    for (const runId of Object.keys(merged)) {
      if (!visibleRunIds.has(runId)) delete merged[runId];
    }
  }
  return merged;
}

function mergeScopedCatalog(current: EventStreamState, incoming: EventStreamState) {
  const isSelectedRunScoped = Boolean(incoming.snapshotRunId?.trim());
  const catalogIsPartial = incoming.snapshotScope?.catalog?.complete === false;
  if (!isSelectedRunScoped && !catalogIsPartial) {
    return {
      ...incoming,
      readMarkers: mergeReadMarkersForVisibleRuns(current, incoming),
    };
  }

  const mergedRuns = mergeByKey(current.runs, incoming.runs, (run) => run.id);
  return {
    ...incoming,
    runs: mergedRuns,
    plans: mergeByKey(current.plans, incoming.plans, (plan) => plan.id),
    workers: mergeByKey(current.workers, incoming.workers, (worker) => worker.id),
    sessions: mergeByKey(current.sessions, incoming.sessions, (session) => session.runId),
    readMarkers: mergeReadMarkersForVisibleRuns(current, {
      ...incoming,
      runs: mergedRuns,
    }),
  };
}

function mergeScopedRuns(current: EventStreamState, incoming: EventStreamState, options: {
  serverAuthoritative: boolean;
}) {
  const catalogMergedIncoming = mergeScopedCatalog(current, incoming);
  if (options.serverAuthoritative) {
    return catalogMergedIncoming;
  }

  const incomingRuns = catalogMergedIncoming.runs ?? [];
  if (incomingRuns.length === 0 || !current.runs?.length) {
    return catalogMergedIncoming;
  }

  const currentRunsById = new Map(current.runs.map((run) => [run.id, run]));
  let changed = false;
  const mergedRuns = incomingRuns.map((incomingRun) => {
    const currentRun = currentRunsById.get(incomingRun.id);
    if (!currentRun || runUpdatedTimestampMs(currentRun) <= runUpdatedTimestampMs(incomingRun)) {
      return incomingRun;
    }

    changed = true;
    return {
      ...incomingRun,
      ...currentRun,
    };
  });

  return changed ? { ...catalogMergedIncoming, runs: mergedRuns } : catalogMergedIncoming;
}

/**
 * Supervisor-conversation messages still flow through the `messages`
 * table (worker-attributed messages moved to the unified worker
 * stream). Snapshots declare whether their message run scope is
 * complete; partial updates are additive and must not erase durable
 * conversation messages the client already knows about.
 */
function mergeScopedMessages(current: EventStreamState, incoming: EventStreamState) {
  const incomingMessages = incoming.messages ?? [];
  const incomingMessageIds = new Set(incomingMessages.map((message) => message.id));
  const completeMessageRunIds = new Set(
    incoming.messageScope?.complete ? incoming.messageScope.runIds : [],
  );
  const liveRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const retainedCurrentMessages = (current.messages ?? []).filter((message) => (
    liveRunIds.has(message.runId)
    && !incomingMessageIds.has(message.id)
    && !completeMessageRunIds.has(message.runId)
  ));
  const mergedMessages = sortMessages([
    ...retainedCurrentMessages,
    ...incomingMessages,
  ]);

  if (
    mergedMessages.length === incomingMessages.length
    && mergedMessages.every((message, index) => message === incomingMessages[index])
  ) {
    return incoming;
  }

  return {
    ...incoming,
    messages: mergedMessages,
  };
}

/**
 * `bridgeMissing` agent snapshots are built without any live agent record,
 * so their `pendingPermissions`/`pendingElicitations` are hardcoded empty —
 * they mean "we could not reach the runtime", NOT "nothing is pending".
 * Letting them overwrite live values tore an open permission prompt or
 * elicitation form off the screen mid-answer whenever a degraded frame
 * landed between two live ones. A request may only be cleared by a frame
 * that actually talked to the runtime.
 */
function mergeDegradedAgentHumanInput(current: EventStreamState, incoming: EventStreamState) {
  const incomingAgents = incoming.agents ?? [];
  if (incomingAgents.length === 0 || !current.agents?.length) {
    return incoming;
  }

  const currentAgentsByName = new Map(current.agents.map((agent) => [agent.name, agent]));
  let changed = false;
  const mergedAgents = incomingAgents.map((incomingAgent) => {
    if (!incomingAgent.bridgeMissing) {
      return incomingAgent;
    }

    // Deliberately not gated on `currentAgent.bridgeMissing`: a run of
    // consecutive degraded frames must keep carrying the request forward, or
    // the second one re-opens the exact flicker the first one avoided. The
    // only things that may clear a pending request are a frame that reached
    // the runtime and the local optimistic update the answer path applies
    // (which goes through updateLocal, bypassing this merge).
    const currentAgent = currentAgentsByName.get(incomingAgent.name);
    if (!currentAgent) {
      return incomingAgent;
    }

    const pendingPermissions = currentAgent.pendingPermissions ?? [];
    const pendingElicitations = currentAgent.pendingElicitations ?? [];
    if (pendingPermissions.length === 0 && pendingElicitations.length === 0) {
      return incomingAgent;
    }

    changed = true;
    return {
      ...incomingAgent,
      pendingPermissions,
      pendingElicitations,
    };
  });

  return changed ? { ...incoming, agents: mergedAgents } : incoming;
}

function mergeScopedCachedState(current: EventStreamState, cached: EventStreamState): EventStreamState {
  // hydrateFromCacheScope swaps scopes (e.g. on session switch). The cached
  // payload for the newly-selected scope only contains data that was
  // observed while THAT scope was active — its messages/workers/agents/
  // queuedMessages/executionEvents are a strict subset of what we already
  // know across all runs. Replacing current collections with that subset
  // briefly empties any cross-run sidebar view (notably the Active tab,
  // whose filter is driven by messages+workers+agents+queuedMessages).
  //
  // Initial-mount cache hydration takes a different path (hydrateFromCaches
  // → snapshotCache.hydrateState) that already prefers current values when
  // present and falls back to cached when empty, so the only consumers of
  // this merge are scope transitions where current is server-authoritative.
  // Preserve current state and only adopt the scope-pointer metadata so
  // consumers gating on snapshotRunId still recognize the switch.
  return {
    ...current,
    snapshotRunId: cached.snapshotRunId ?? current.snapshotRunId,
    snapshotChecksum: cached.snapshotChecksum ?? current.snapshotChecksum,
    snapshotScope: cached.snapshotScope ?? current.snapshotScope,
    frontendErrors: [],
  };
}

function authoritativeCatalogExcludesScope(state: EventStreamState, scope: string | null | undefined) {
  const scopedRunId = scope?.trim();
  if (!scopedRunId || state.snapshotSource !== "server" || state.snapshotScope?.catalog?.complete !== true) {
    return false;
  }

  return !(state.runs ?? []).some((run) => run.id === scopedRunId);
}

/**
 * State manager for the global event snapshot stream. Worker
 * conversation content (bridge entries, user/supervisor inputs,
 * lifecycle markers) is NOT managed here — it lives in
 * `WorkerEntriesManager` and is fetched per-worker via
 * the typed worker-entry API. This manager owns runs, plans,
 * workers metadata, supervisor messages, planning artifacts, queued
 * messages, recovery state, and review records.
 */
export class EventStreamStateManager {
  private state: EventStreamState;
  private readonly listeners = new Set<EventStreamStateListener>();
  // A stop click is immediately terminal in the local UI. Keep that owned
  // result until the server confirms a terminal state; otherwise an in-flight
  // quota_waiting snapshot can reopen the recovery notice for one frame.
  private readonly pendingOptimisticStopRunIds = new Set<string>();
  private readonly snapshotCache: EventStreamSnapshotCacheManager;
  private snapshotCacheScope: string | null;

  constructor(initialState: EventStreamState, options: {
    snapshotCache?: EventStreamSnapshotCacheManager;
    snapshotCacheScope?: string | null;
    deferCacheHydration?: boolean;
    initialSnapshotSource?: EventStreamSnapshotSource;
  } = {}) {
    this.snapshotCache = options.snapshotCache ?? new EventStreamSnapshotCacheManager();
    this.snapshotCacheScope = options.snapshotCacheScope?.trim() || null;
    const source = options.initialSnapshotSource;
    const initialWithSource = source ? { ...initialState, snapshotSource: source } : initialState;
    if (options.deferCacheHydration) {
      this.state = initialWithSource;
    } else {
      this.state = {
        ...this.snapshotCache.hydrateState(initialWithSource, this.snapshotCacheScope),
        snapshotSource: "cache",
      };
    }
  }

  hydrateFromCaches() {
    if (authoritativeCatalogExcludesScope(this.state, this.snapshotCacheScope)) {
      return;
    }
    if (
      this.state.snapshotSource === "server"
      && (!this.snapshotCacheScope || this.state.snapshotRunId === this.snapshotCacheScope)
    ) {
      return;
    }
    const cached = this.snapshotCache.hydrateState(this.state, this.snapshotCacheScope);
    if (cached === this.state) {
      return;
    }
    this.state = { ...cached, snapshotSource: "cache" };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  hydrateFromCacheScope(scope: string | null | undefined) {
    this.snapshotCacheScope = scope?.trim() || null;
    if (authoritativeCatalogExcludesScope(this.state, this.snapshotCacheScope)) {
      return false;
    }
    if (
      this.state.snapshotSource === "server"
      && this.snapshotCacheScope
      && this.state.snapshotRunId === this.snapshotCacheScope
    ) {
      return false;
    }
    const cached = this.snapshotCache.getCachedState(this.snapshotCacheScope);
    if (!cached || Object.is(cached, this.state)) {
      return false;
    }

    this.state = {
      ...mergeScopedCachedState(this.state, cached),
      snapshotSource: this.state.snapshotSource === "server" ? "server" : "cache",
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }
    return true;
  }

  getSnapshot() {
    return this.state;
  }

  subscribe(listener: EventStreamStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setSnapshotCacheScope(scope: string | null | undefined) {
    this.snapshotCacheScope = scope?.trim() || null;
  }

  update(action: EventStreamStateAction, options: { snapshotSource?: EventStreamSnapshotSource } = {}) {
    const incoming = typeof action === "function" ? action(this.state) : action;
    const isServerUpdate = options.snapshotSource === "server";
    const snapshotSource = options.snapshotSource
      ?? incoming.snapshotSource
      ?? this.state.snapshotSource;
    let incomingWithRuns = mergeScopedRuns(this.state, incoming, {
      serverAuthoritative: snapshotSource === "server",
    });
    if (isServerUpdate && this.pendingOptimisticStopRunIds.size > 0) {
      const currentRunsById = new Map(this.state.runs.map((run) => [run.id, run]));
      const incomingRunsById = new Map(incoming.runs.map((run) => [run.id, run]));
      const protectedRunIds = new Set<string>();

      for (const runId of this.pendingOptimisticStopRunIds) {
        const serverRun = incomingRunsById.get(runId);
        // Terminal server truth acknowledges the stop and retires the overlay.
        if (isTerminalRunStatus(serverRun?.status)) {
          this.pendingOptimisticStopRunIds.delete(runId);
          continue;
        }
        if (!serverRun) {
          const catalogIsComplete = !incoming.snapshotRunId
            && incoming.snapshotScope?.catalog?.complete === true;
          if (catalogIsComplete) {
            this.pendingOptimisticStopRunIds.delete(runId);
          }
          continue;
        }

        const currentRun = currentRunsById.get(runId);
        if (currentRun?.status === "cancelled") {
          protectedRunIds.add(runId);
        }
      }

      if (protectedRunIds.size > 0) {
        incomingWithRuns = {
          ...incomingWithRuns,
          runs: incomingWithRuns.runs.map((run) => (
            protectedRunIds.has(run.id) ? currentRunsById.get(run.id) ?? run : run
          )),
        };
      }
    }
    const incomingWithAgents = mergeDegradedAgentHumanInput(this.state, incomingWithRuns);
    const nextState = {
      ...mergeScopedMessages(this.state, incomingWithAgents),
      goalsByRunId: mergeGoalSnapshots(this.state, incomingWithAgents, snapshotSource === "server"),
      snapshotSource,
    };

    // `nextState` is always a fresh literal, so the old `Object.is` guard here
    // could never fire — every frame took a new identity and re-rendered the
    // whole shell, even for a byte-identical payload. Polls (the 5s snapshot
    // validation and the 15s SSE fallback) re-deliver unchanged snapshots
    // routinely, so this was a guaranteed floor of full-tree cascades while
    // idle. The server-computed checksum covers the whole payload, so an equal
    // checksum plus an unchanged merge result means genuinely nothing moved.
    if (isNoOpSnapshotUpdate(this.state, nextState)) {
      return this.state;
    }

    this.state = nextState;
    this.snapshotCache.rememberState(nextState, this.snapshotCacheScope);
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  /**
   * Apply an explicit local mutation without treating its intentionally
   * removed records as a partial server catalog that needs merging.
   */
  updateLocal(action: EventStreamStateAction) {
    const incoming = typeof action === "function" ? action(this.state) : action;
    const currentRunsById = new Map(this.state.runs.map((run) => [run.id, run]));
    const incomingRunIds = new Set(incoming.runs.map((run) => run.id));
    for (const run of incoming.runs) {
      const currentRun = currentRunsById.get(run.id);
      if (run.status === "cancelled" && currentRun && currentRun.status !== "cancelled") {
        this.pendingOptimisticStopRunIds.add(run.id);
      } else if (run.status !== "cancelled") {
        // Mutation error handlers restore their captured pre-stop state through
        // updateLocal, which explicitly releases the optimistic ownership.
        this.pendingOptimisticStopRunIds.delete(run.id);
      }
    }
    for (const runId of this.pendingOptimisticStopRunIds) {
      if (!incomingRunIds.has(runId)) {
        this.pendingOptimisticStopRunIds.delete(runId);
      }
    }
    const nextState = {
      ...incoming,
      snapshotSource: this.state.snapshotSource,
    };
    if (Object.is(nextState, this.state)) {
      return this.state;
    }
    this.state = nextState;
    this.snapshotCache.rememberState(nextState, this.snapshotCacheScope);
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  updateFromServer(action: EventStreamStateAction) {
    return this.update(action, { snapshotSource: "server" });
  }

  applyGoalEvent(rawSnapshot: unknown, eventKey?: string | null) {
    const snapshot = parseGoalSnapshot(rawSnapshot);
    const current = this.state.goalsByRunId?.[snapshot.runId];
    if (current && current.revision >= snapshot.revision) return false;
    this.state = {
      ...this.state,
      goalsByRunId: {
        ...(this.state.goalsByRunId ?? {}),
        [snapshot.runId]: {
          ...snapshot,
          provenance: { ...snapshot.provenance, source: "server" },
        },
      },
    };
    this.snapshotCache.rememberState(this.state, this.snapshotCacheScope);
    this.listeners.forEach((listener) => listener(this.state));
    void eventKey;
    return true;
  }
}
