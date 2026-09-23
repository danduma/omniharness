import { describe, expect, it } from "vitest";
import { EventStreamSnapshotCacheManager } from "@/interface/home/EventStreamSnapshotCacheManager";
import { EventStreamStateManager } from "@/interface/home/EventStreamStateManager";
import { applyStopSupervisorOptimisticUpdate } from "@/interface/home/mutations/optimistic-state";
import { resolveSelectedRecoveryState } from "@/interface/home/useRunRecoveryState";
import { buildConversationGroups } from "@/lib/conversations";
import type { EventStreamState } from "@/interface/home/types";

function state(runId: string, message: string, checksum: string): EventStreamState {
  return {
    messages: [{
      id: `${runId}-message`,
      runId,
      role: "user",
      content: message,
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    }],
    plans: [],
    runs: [{
      id: runId,
      planId: "plan-1",
      status: "done",
      createdAt: new Date(0).toISOString(),
      projectPath: null,
      title: runId,
      mode: "direct",
    }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    snapshotRunId: runId,
    snapshotChecksum: checksum,
  };
}

function run(id: string): EventStreamState["runs"][number] {
  return {
    id,
    planId: `${id}-plan`,
    status: "done",
    createdAt: new Date(0).toISOString(),
    projectPath: null,
    title: id,
    mode: "direct",
  };
}

function awaitingUserState(args: {
  messages: EventStreamState["messages"];
  checksum: string;
  messageScope?: { runIds: string[]; complete: boolean };
}): EventStreamState {
  return {
    messages: args.messages,
    plans: [{ id: "plan-1", path: "plan.md" }],
    runs: [{
      id: "run-awaiting",
      planId: "plan-1",
      status: "awaiting_user",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(1_000).toISOString(),
      projectPath: null,
      title: "Awaiting run",
      mode: "implementation",
    }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    snapshotRunId: "run-awaiting",
    snapshotChecksum: args.checksum,
    ...(args.messageScope ? { messageScope: args.messageScope } : {}),
  };
}

function multiRunState(args: {
  runs: string[];
  messageRunId: string;
  message: string;
  checksum: string;
  catalogComplete?: boolean;
}): EventStreamState {
  return {
    messages: [{
      id: `${args.messageRunId}-message`,
      runId: args.messageRunId,
      role: "user",
      content: args.message,
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    }],
    plans: args.runs.map((id) => ({ id: `${id}-plan`, path: `${id}.md` })),
    runs: args.runs.map(run),
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    snapshotRunId: args.messageRunId,
    snapshotChecksum: args.checksum,
    snapshotScope: args.catalogComplete === undefined
      ? undefined
      : { catalog: { complete: args.catalogComplete } },
  };
}

// A complete catalog in one project, ordered by the sidebar's activity sort.
function catalogWithActivity(
  lastActivityAtByRunId: Record<string, string>,
  checksum: string,
): EventStreamState {
  const runIds = Object.keys(lastActivityAtByRunId);
  return {
    ...multiRunState({
      runs: runIds,
      messageRunId: runIds[0]!,
      message: "conversation",
      checksum,
      catalogComplete: true,
    }),
    runs: runIds.map((id) => ({
      ...run(id),
      projectPath: "/project",
      createdAt: "2026-09-21T23:00:00.000Z",
      lastActivityAt: lastActivityAtByRunId[id]!,
    })),
    snapshotRunId: null,
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("EventStreamStateManager", () => {
  it("removes an obsolete worker from a run whose scoped catalog is declared complete", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"], messageRunId: "run-a", message: "selected", checksum: "before", catalogComplete: false,
    });
    initial.workers = [
      { id: "stale-a", runId: "run-a" },
      { id: "keep-b", runId: "run-b" },
    ] as EventStreamState["workers"];
    const manager = new EventStreamStateManager(initial, { deferCacheHydration: true });
    const scoped = multiRunState({
      runs: ["run-a"], messageRunId: "run-a", message: "selected", checksum: "after", catalogComplete: false,
    });
    scoped.snapshotScope = { catalog: { complete: false, completeRunIds: ["run-a"] } };
    scoped.workers = [{ id: "current-a", runId: "run-a" }] as EventStreamState["workers"];

    manager.updateFromServer(scoped);

    expect(manager.getSnapshot().workers.map((worker) => worker.id).sort()).toEqual(["current-a", "keep-b"]);
  });

  it("does not merge a locally deleted run back into a scoped catalog", () => {
    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "selected",
        checksum: "sha256:before-delete",
        catalogComplete: false,
      }),
      { deferCacheHydration: true, initialSnapshotSource: "server" },
    );

    manager.updateLocal((current) => ({
      ...current,
      runs: current.runs.filter((candidate) => candidate.id !== "run-b"),
    }));

    expect(manager.getSnapshot().runs.map((candidate) => candidate.id)).toEqual(["run-a"]);
  });

  it("keeps supervisor confirmation messages when a partial live update only includes the user checkpoint", () => {
    const userMessage: EventStreamState["messages"][number] = {
      id: "user-message",
      runId: "run-awaiting",
      role: "user",
      content: "Implement the plan.",
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    };
    const supervisorMessage: EventStreamState["messages"][number] = {
      id: "supervisor-confirmation",
      runId: "run-awaiting",
      role: "supervisor",
      content: "Before I start implementation, please confirm this is the intended job.",
      createdAt: new Date(1_000).toISOString(),
      kind: "implementation_confirmation",
      attachments: [],
    };
    const manager = new EventStreamStateManager(
      awaitingUserState({
        messages: [userMessage, supervisorMessage],
        checksum: "sha256:with-confirmation",
      }),
      { deferCacheHydration: true },
    );

    manager.update(awaitingUserState({
      messages: [userMessage],
      checksum: "sha256:user-only-live-update",
      messageScope: { runIds: ["run-awaiting"], complete: false },
    }));

    expect(manager.getSnapshot().messages.map((message) => message.id)).toEqual([
      "user-message",
      "supervisor-confirmation",
    ]);
  });

  it("removes absent run messages when the incoming message scope is complete", () => {
    const userMessage: EventStreamState["messages"][number] = {
      id: "user-message",
      runId: "run-awaiting",
      role: "user",
      content: "Implement the plan.",
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    };
    const staleSupervisorMessage: EventStreamState["messages"][number] = {
      id: "stale-supervisor-confirmation",
      runId: "run-awaiting",
      role: "supervisor",
      content: "Before I start implementation, please confirm this is the intended job.",
      createdAt: new Date(1_000).toISOString(),
      kind: "implementation_confirmation",
      attachments: [],
    };
    const manager = new EventStreamStateManager(
      awaitingUserState({
        messages: [userMessage, staleSupervisorMessage],
        checksum: "sha256:with-stale-confirmation",
      }),
      { deferCacheHydration: true },
    );

    manager.update(awaitingUserState({
      messages: [userMessage],
      checksum: "sha256:complete-user-only-snapshot",
      messageScope: { runIds: ["run-awaiting"], complete: true },
    }));

    expect(manager.getSnapshot().messages.map((message) => message.id)).toEqual([
      "user-message",
    ]);
  });

  it("adopts the new scope pointer when switching but preserves current cross-run state", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-a", "cached first conversation", "sha256:a"), "run-a");
    cache.rememberState(state("run-b", "cached second conversation", "sha256:b"), "run-b");

    const manager = new EventStreamStateManager(state("run-a", "current conversation", "sha256:a"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
    });

    const hydrated = manager.hydrateFromCacheScope("run-b");

    expect(hydrated).toBe(true);
    // Scope pointer follows the new selection so isSelectedConversationPreviewAvailable etc. flip.
    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotChecksum).toBe("sha256:b");
    // Cross-run state (messages, workers, agents, queuedMessages, etc.) is preserved so the
    // sidebar — especially the Active tab whose filter spans all runs — does not briefly empty.
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["current conversation"]);
  });

  it("marks scoped frontend cache hydration as a preview instead of authoritative server state", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-b", "cached second conversation", "sha256:b"), "run-b");

    const manager = new EventStreamStateManager(state("run-a", "current conversation", "sha256:a"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
    });

    manager.hydrateFromCacheScope("run-b");

    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotSource).toBe("cache");

    manager.updateFromServer(state("run-b", "fresh server conversation", "sha256:fresh"));

    expect(manager.getSnapshot().snapshotSource).toBe("server");
    // Fresh server data for run-b lands alongside run-a's preserved message — the scope
    // switch is not a cross-run wipe.
    const contents = manager.getSnapshot().messages.map((message) => message.content);
    expect(contents).toContain("fresh server conversation");
    expect(contents).toContain("current conversation");
  });

  it("does not demote selected server bootstrap state to a cached preview for the same run", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-b", "cached second conversation", "sha256:cached"), "run-b");
    const manager = new EventStreamStateManager(state("run-b", "fresh server conversation", "sha256:server"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-b",
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    expect(manager.hydrateFromCacheScope("run-b")).toBe(false);

    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotSource).toBe("server");
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["fresh server conversation"]);
  });

  it("does not resurrect cached queued messages when the server snapshot has an empty queue", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState({
      ...state("run-b", "cached second conversation", "sha256:cached-queue"),
      queuedMessages: [{
        id: "queued-stale",
        runId: "run-b",
        targetWorkerId: "run-b-worker-1",
        action: "steer",
        content: "This was already delivered.",
        status: "pending",
        lastError: null,
        attachments: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        deliveredAt: null,
      }],
    }, "run-b");

    const serverState = {
      ...state("run-b", "fresh server conversation", "sha256:fresh-empty-queue"),
      queuedMessages: [],
      snapshotSource: "server" as const,
    };
    const hydrated = cache.hydrateState(serverState, "run-b");

    expect(hydrated.queuedMessages).toEqual([]);
  });

  it("lets authoritative server run state retire a newer optimistic running row", () => {
    const optimistic = state("run-b", "follow-up", "sha256:optimistic");
    optimistic.runs = [{
      ...optimistic.runs[0],
      status: "running",
      updatedAt: "2026-05-20T10:00:00.000Z",
    }];
    const serverDone = state("run-b", "follow-up", "sha256:server-done");
    serverDone.runs = [{
      ...serverDone.runs[0],
      status: "done",
      updatedAt: "2026-05-20T09:59:59.000Z",
    }];
    const manager = new EventStreamStateManager(optimistic, {
      deferCacheHydration: true,
      initialSnapshotSource: "cache",
    });

    manager.updateFromServer(serverDone);

    expect(manager.getSnapshot().runs[0]?.status).toBe("done");
    expect(manager.getSnapshot().runs[0]?.updatedAt).toBe("2026-05-20T09:59:59.000Z");
    expect(manager.getSnapshot().snapshotSource).toBe("server");
  });

  it("does not reopen quota recovery while an optimistic stop awaits server confirmation", () => {
    const quotaWaiting = state("run-quota", "waiting for quota", "sha256:quota-waiting");
    quotaWaiting.runs = [{
      ...quotaWaiting.runs[0],
      status: "quota_waiting",
      updatedAt: "2026-08-10T10:00:00.000Z",
    }];
    quotaWaiting.recoveryState = {
      kind: "quota_waiting",
      status: "open",
      workerId: "worker-quota",
      recommendedAction: "wait_for_quota_reset",
      resumeAt: "2026-08-10T11:00:00.000Z",
    };
    const manager = new EventStreamStateManager(quotaWaiting, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    manager.updateLocal((current) => applyStopSupervisorOptimisticUpdate(current, "run-quota"));
    expect(resolveSelectedRecoveryState(manager.getSnapshot(), "run-quota")).toBeNull();

    manager.updateFromServer({
      ...quotaWaiting,
      snapshotChecksum: "sha256:stale-quota-waiting-1",
    });
    expect(manager.getSnapshot().runs[0]?.status).toBe("cancelled");
    expect(resolveSelectedRecoveryState(manager.getSnapshot(), "run-quota")).toBeNull();

    manager.updateFromServer({
      ...quotaWaiting,
      snapshotChecksum: "sha256:stale-quota-waiting-2",
    });
    expect(manager.getSnapshot().runs[0]?.status).toBe("cancelled");
    expect(resolveSelectedRecoveryState(manager.getSnapshot(), "run-quota")).toBeNull();

    manager.updateFromServer({
      ...quotaWaiting,
      runs: [{
        ...quotaWaiting.runs[0],
        status: "cancelled",
        updatedAt: "2026-08-10T10:00:01.000Z",
      }],
      recoveryState: null,
      snapshotChecksum: "sha256:quota-stop-confirmed",
    });
    expect(manager.getSnapshot().runs[0]?.status).toBe("cancelled");
    expect(resolveSelectedRecoveryState(manager.getSnapshot(), "run-quota")).toBeNull();

    manager.updateFromServer({
      ...quotaWaiting,
      runs: [{
        ...quotaWaiting.runs[0],
        status: "running",
        updatedAt: "2026-08-10T10:00:02.000Z",
      }],
      recoveryState: null,
      snapshotChecksum: "sha256:later-authoritative-state",
    });
    expect(manager.getSnapshot().runs[0]?.status).toBe("running");
  });

  it("releases optimistic stop ownership when the mutation rolls back", () => {
    const quotaWaiting = state("run-quota", "waiting for quota", "sha256:quota-waiting");
    quotaWaiting.runs = [{
      ...quotaWaiting.runs[0],
      status: "quota_waiting",
      updatedAt: "2026-08-10T10:00:00.000Z",
    }];
    quotaWaiting.recoveryState = {
      kind: "quota_waiting",
      status: "open",
      workerId: "worker-quota",
      recommendedAction: "wait_for_quota_reset",
      resumeAt: "2026-08-10T11:00:00.000Z",
    };
    const manager = new EventStreamStateManager(quotaWaiting, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    manager.updateLocal((current) => applyStopSupervisorOptimisticUpdate(current, "run-quota"));
    manager.updateLocal(quotaWaiting);
    manager.updateFromServer({
      ...quotaWaiting,
      snapshotChecksum: "sha256:quota-after-rollback",
    });

    expect(manager.getSnapshot().runs[0]?.status).toBe("quota_waiting");
    expect(resolveSelectedRecoveryState(manager.getSnapshot(), "run-quota")).toBe(quotaWaiting.recoveryState);
  });

  it("does not let selected-run snapshots erase the sidebar run catalog", () => {
    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:current",
      }),
      {
        deferCacheHydration: true,
        initialSnapshotSource: "server",
      },
    );

    manager.updateFromServer(
      multiRunState({
        runs: ["run-b"],
        messageRunId: "run-b",
        message: "selected second conversation",
        checksum: "sha256:selected",
        catalogComplete: false,
      }),
    );

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b", "run-a"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan", "run-a-plan"]);
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual([
      "current first conversation",
      "selected second conversation",
    ]);
  });

  it("keeps the last complete-catalog checksum after a partial selected-run update", () => {
    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:complete-catalog",
        catalogComplete: true,
      }),
      { deferCacheHydration: true, initialSnapshotSource: "server" },
    );
    const partial = multiRunState({
      runs: ["run-a"],
      messageRunId: "run-a",
      message: "selected update",
      checksum: "sha256:must-not-advance",
      catalogComplete: false,
    });

    manager.updateFromServer({ ...partial, snapshotChecksum: undefined });

    expect(manager.getSnapshot().snapshotChecksum).toBe("sha256:complete-catalog");
  });

  it("removes a missing selected run and its catalog records from a partial server update", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:complete-catalog",
      catalogComplete: true,
    });
    initial.workers = [
      { id: "worker-a", runId: "run-a" },
      { id: "worker-b", runId: "run-b" },
    ] as EventStreamState["workers"];
    initial.sessions = [
      { runId: "run-a" },
      { runId: "run-b" },
    ] as EventStreamState["sessions"];
    initial.readMarkers = { "run-a": new Date(0).toISOString(), "run-b": new Date(0).toISOString() };
    const manager = new EventStreamStateManager(initial, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    manager.updateFromServer({
      ...multiRunState({
        runs: [],
        messageRunId: "run-a",
        message: "selected update",
        checksum: "sha256:ignored",
        catalogComplete: false,
      }),
      snapshotChecksum: undefined,
      workers: [],
      sessions: [],
      readMarkers: {},
    });

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan"]);
    expect(manager.getSnapshot().workers.map((item) => item.id)).toEqual(["worker-b"]);
    expect(manager.getSnapshot().sessions?.map((item) => item.runId)).toEqual(["run-b"]);
    expect(manager.getSnapshot().readMarkers).toEqual({ "run-b": new Date(0).toISOString() });
    expect(manager.getSnapshot().snapshotChecksum).toBe("sha256:complete-catalog");
  });

  it("lets a complete selected-run validation remove absent sidebar runs", () => {
    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:current",
        catalogComplete: true,
      }),
      {
        deferCacheHydration: true,
        initialSnapshotSource: "server",
      },
    );

    manager.updateFromServer(
      multiRunState({
        runs: ["run-b"],
        messageRunId: "run-b",
        message: "selected second conversation",
        checksum: "sha256:selected",
        catalogComplete: true,
      }),
    );

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan"]);
  });

  it("lets unscoped complete server catalog snapshots remove absent runs", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:current",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager(initial, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });
    const incoming = multiRunState({
      runs: ["run-b"],
      messageRunId: "run-b",
      message: "selected second conversation",
      checksum: "sha256:selected",
      catalogComplete: true,
    });

    manager.updateFromServer({
      ...incoming,
      snapshotRunId: null,
    });

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan"]);
  });

  it("does not let transient snapshots clear read markers for visible runs", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:current",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager({
      ...initial,
      readMarkers: {
        "run-a": "2026-05-20T10:00:00.000Z",
        "run-b": "2026-05-20T10:01:00.000Z",
      },
    }, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });
    const incoming = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-b",
      message: "selected second conversation",
      checksum: "sha256:missing-read-markers",
      catalogComplete: true,
    });

    manager.updateFromServer({
      ...incoming,
      readMarkers: {},
    });

    expect(manager.getSnapshot().readMarkers).toEqual({
      "run-a": "2026-05-20T10:00:00.000Z",
      "run-b": "2026-05-20T10:01:00.000Z",
    });
  });

  it("drops read markers for runs absent from an unscoped catalog snapshot", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:current",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager({
      ...initial,
      readMarkers: {
        "run-a": "2026-05-20T10:00:00.000Z",
        "run-b": "2026-05-20T10:01:00.000Z",
      },
    }, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });
    const incoming = multiRunState({
      runs: ["run-a"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:archived",
      catalogComplete: true,
    });

    manager.updateFromServer({
      ...incoming,
      snapshotRunId: null,
      readMarkers: {},
    });

    expect(manager.getSnapshot().readMarkers).toEqual({
      "run-a": "2026-05-20T10:00:00.000Z",
    });
  });

  it("does not resurrect deleted runs from stale scoped frontend caches", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(
      multiRunState({
        runs: ["run-a", "run-b", "deleted-run"],
        messageRunId: "run-b",
        message: "cached second conversation",
        checksum: "sha256:stale-b",
      }),
      "run-b",
    );

    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:current",
      }),
      {
        snapshotCache: cache,
        snapshotCacheScope: "run-a",
        deferCacheHydration: true,
      },
    );

    const hydrated = manager.hydrateFromCacheScope("run-b");

    expect(hydrated).toBe(true);
    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-a", "run-b"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-a-plan", "run-b-plan"]);
    // Cross-run state is preserved on scope switch so the sidebar's Active tab does not flicker.
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["current first conversation"]);
  });

  it("preserves cross-run sidebar signals (workers, agents, queued messages, foreign messages) on scope switch", () => {
    // Regression: switching the selected session used to wipe all the
    // cross-run collections that drive the sidebar Active tab, making
    // every session briefly disappear from the list until the next SSE
    // frame restored them. The cached payload for the newly-selected
    // scope only contains that scope's data, so a wholesale replace
    // strips away every other run's signals.
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState({
      ...state("run-b", "cached second conversation", "sha256:b"),
      // The cache for scope "run-b" only knows about run-b's workers /
      // agents / queue; if hydration blindly trusts this, run-a's
      // sidebar signals vanish.
      workers: [],
      agents: [],
      queuedMessages: [],
    }, "run-b");

    const currentWorkers = [
      { id: "worker-a", runId: "run-a", status: "working", updatedAt: new Date(0).toISOString(), type: "claude" },
      { id: "worker-c", runId: "run-c", status: "idle", updatedAt: new Date(0).toISOString(), type: "claude" },
    ];
    const currentAgents = [
      { name: "worker-a", state: "working", updatedAt: new Date(0).toISOString(), lastText: "", currentText: "thinking…" },
    ];
    const currentQueued = [{
      id: "queued-a",
      runId: "run-a",
      targetWorkerId: "worker-a",
      action: "steer" as const,
      content: "queued for a",
      status: "pending" as const,
      lastError: null,
      attachments: [],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      deliveredAt: null,
    }];
    const currentMessages = [
      ...state("run-a", "current message in run-a", "sha256:current").messages,
      { id: "extra-c", runId: "run-c", role: "user", content: "current message in run-c", createdAt: new Date(0).toISOString(), kind: "checkpoint", attachments: [] },
    ];

    const manager = new EventStreamStateManager({
      ...state("run-a", "current message in run-a", "sha256:current"),
      messages: currentMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workers: currentWorkers as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agents: currentAgents as any,
      queuedMessages: currentQueued,
    }, {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    manager.hydrateFromCacheScope("run-b");

    const snap = manager.getSnapshot();
    expect(snap.snapshotRunId).toBe("run-b");
    expect(snap.workers.map((w) => w.id)).toEqual(["worker-a", "worker-c"]);
    expect(snap.agents.map((a) => a.name)).toEqual(["worker-a"]);
    expect((snap.queuedMessages ?? []).map((q) => q.id)).toEqual(["queued-a"]);
    expect(snap.messages.map((m) => m.content)).toEqual([
      "current message in run-a",
      "current message in run-c",
    ]);
  });

  it("does not hydrate a stale scoped cache when an authoritative catalog excludes that run", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(
      multiRunState({
        runs: ["archived-run"],
        messageRunId: "archived-run",
        message: "archived conversation body",
        checksum: "sha256:archived-cache",
      }),
      "archived-run",
    );

    const authoritative = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:server",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager({
      ...authoritative,
      snapshotRunId: null,
      messages: [],
    }, {
      snapshotCache: cache,
      snapshotCacheScope: "archived-run",
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    expect(manager.hydrateFromCacheScope("archived-run")).toBe(false);
    manager.hydrateFromCaches();

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-a", "run-b"]);
    expect(manager.getSnapshot().messages).toEqual([]);
    expect(manager.getSnapshot().snapshotSource).toBe("server");
  });

  // The SSE loop can emit a persisted-only frame when the runtime-enriched
  // payload is slow to build. Those frames have no live agent record at all,
  // so their empty pendingElicitations/pendingPermissions are "unknown", not
  // "resolved". Letting them through made an open elicitation form flash on
  // and off for as long as an agent kept producing output.
  const agentWithElicitation = (bridgeMissing: boolean) => ({
    name: "worker-a",
    state: "working",
    lastText: "",
    currentText: "",
    bridgeMissing,
    pendingElicitations: bridgeMissing ? [] : [{
      requestId: 7,
      requestedAt: new Date(0).toISOString(),
      message: "Pick an option",
    }],
    pendingPermissions: [],
  });

  it("keeps a pending elicitation when a bridge-missing snapshot cannot see the runtime", () => {
    const manager = new EventStreamStateManager({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [agentWithElicitation(false)] as any,
    }, { snapshotCache: new EventStreamSnapshotCacheManager({ storage: null }) });

    manager.updateFromServer({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [agentWithElicitation(true)] as any,
    });

    expect(manager.getSnapshot().agents[0]?.pendingElicitations?.map((item) => item.requestId)).toEqual([7]);

    // A run of degraded frames must keep carrying the request forward — if
    // only the first one preserved it, the second re-opens the same flicker.
    manager.updateFromServer({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [agentWithElicitation(true)] as any,
    });

    expect(manager.getSnapshot().agents[0]?.pendingElicitations?.map((item) => item.requestId)).toEqual([7]);
  });

  it("does not resurrect an elicitation the answer path optimistically cleared", () => {
    const manager = new EventStreamStateManager({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [agentWithElicitation(false)] as any,
    }, { snapshotCache: new EventStreamSnapshotCacheManager({ storage: null }) });

    // The answer mutation clears optimistically through updateLocal.
    manager.updateLocal((current) => ({
      ...current,
      agents: current.agents.map((agent) => ({ ...agent, pendingElicitations: [] })),
    }));

    manager.updateFromServer({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [agentWithElicitation(true)] as any,
    });

    expect(manager.getSnapshot().agents[0]?.pendingElicitations).toEqual([]);
  });

  it("clears a pending elicitation when a live snapshot reports it resolved", () => {
    const manager = new EventStreamStateManager({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [agentWithElicitation(false)] as any,
    }, { snapshotCache: new EventStreamSnapshotCacheManager({ storage: null }) });

    manager.updateFromServer({
      ...state("run-a", "conversation", "sha256:a"),
      agents: [{ ...agentWithElicitation(false), pendingElicitations: [] }] as any,
    });

    expect(manager.getSnapshot().agents[0]?.pendingElicitations).toEqual([]);
  });

  it("does not rewind a run's activity stamp when a late snapshot body lands after a newer frame", () => {
    const manager = new EventStreamStateManager(
      catalogWithActivity({ "run-finished": "2026-09-21T23:30:53.000Z" }, "sha256:live"),
      { deferCacheHydration: true, initialSnapshotSource: "server" },
    );

    // Built from SQLite before the run's last turn ended, delivered after it.
    manager.updateFromServer(
      catalogWithActivity({ "run-finished": "2026-09-21T23:27:03.000Z" }, "sha256:late-body"),
    );

    expect(manager.getSnapshot().runs[0]?.lastActivityAt).toBe("2026-09-21T23:30:53.000Z");
  });

  it("holds a finished conversation's sidebar position against a late snapshot body", () => {
    const activity = {
      "run-streaming": "2026-09-21T23:38:20.000Z",
      "run-finished": "2026-09-21T23:30:53.000Z",
      "run-older": "2026-09-21T23:30:26.000Z",
    };
    const manager = new EventStreamStateManager(
      catalogWithActivity(activity, "sha256:live"),
      { deferCacheHydration: true, initialSnapshotSource: "server" },
    );
    const sidebarOrder = () => buildConversationGroups({
      explicitProjects: ["/project"],
      plans: manager.getSnapshot().plans,
      runs: manager.getSnapshot().runs as Parameters<typeof buildConversationGroups>[0]["runs"],
    })[0]!.runs.map((item) => item.id);

    expect(sidebarOrder()).toEqual(["run-streaming", "run-finished", "run-older"]);

    manager.updateFromServer(catalogWithActivity({
      ...activity,
      // The late body predates the finished run's last turn, which used to drop
      // it below a sibling that had not moved in SQLite for hours.
      "run-finished": "2026-09-21T23:27:03.000Z",
    }, "sha256:late-body"));

    expect(sidebarOrder()).toEqual(["run-streaming", "run-finished", "run-older"]);
  });

  it("still adopts a newer activity stamp from the server", () => {
    const manager = new EventStreamStateManager(
      catalogWithActivity({ "run-finished": "2026-09-21T23:30:53.000Z" }, "sha256:live"),
      { deferCacheHydration: true, initialSnapshotSource: "server" },
    );

    manager.updateFromServer(
      catalogWithActivity({ "run-finished": "2026-09-21T23:41:00.000Z" }, "sha256:newer"),
    );

    expect(manager.getSnapshot().runs[0]?.lastActivityAt).toBe("2026-09-21T23:41:00.000Z");
  });

  it("reconciles a finished run from an overtaken catalog snapshot without touching the selected scope", () => {
    const base: EventStreamState = {
      ...state("run-selected", "hello", "sha256:live"),
      snapshotScope: { catalog: { complete: true, completeRunIds: [] } },
    };
    const manager = new EventStreamStateManager({
      ...base,
      runs: [
        { ...run("run-selected"), status: "running", updatedAt: "2026-09-22T11:40:00.000Z" },
        // Finished during a stream blip; the stream will never re-send it.
        { ...run("run-finished"), status: "running", updatedAt: "2026-09-22T11:20:00.000Z" },
        { ...run("run-local"), status: "running", updatedAt: "2026-09-22T11:50:00.000Z" },
      ],
      sessions: [
        { id: "run-finished", runId: "run-finished", sessionType: "omni", status: "running", capabilities: [], primaryActorId: null, title: "run-finished", projectPath: null, providerMetadata: null },
      ] as unknown as EventStreamState["sessions"],
    }, { deferCacheHydration: true, initialSnapshotSource: "server" });

    const applied = manager.reconcileServerCatalog({
      ...base,
      messages: [],
      snapshotRunId: null,
      snapshotChecksum: "sha256:overtaken",
      runs: [
        // Older than the live frame that overtook this body: must not rewind.
        { ...run("run-selected"), status: "done", updatedAt: "2026-09-22T11:39:00.000Z" },
        { ...run("run-finished"), status: "done", updatedAt: "2026-09-22T11:32:22.000Z" },
        // Locally newer (optimistic) row wins over the older server copy.
        { ...run("run-local"), status: "done", updatedAt: "2026-09-22T11:45:00.000Z" },
        { ...run("run-new"), status: "done", updatedAt: "2026-09-22T11:33:00.000Z" },
      ],
      sessions: [
        { id: "run-finished", runId: "run-finished", sessionType: "omni", status: "done", capabilities: [], primaryActorId: null, title: "run-finished", projectPath: null, providerMetadata: null },
      ] as unknown as EventStreamState["sessions"],
    });

    expect(applied).toBe(true);
    const snapshot = manager.getSnapshot();
    const statusOf = (id: string) => snapshot.runs.find((item) => item.id === id)?.status;
    expect(statusOf("run-selected")).toBe("running");
    expect(statusOf("run-finished")).toBe("done");
    expect(statusOf("run-local")).toBe("running");
    expect(statusOf("run-new")).toBe("done");
    expect(snapshot.sessions?.find((session) => session.runId === "run-finished")?.status).toBe("done");
    // The selected conversation's transcript and checksum are not the body's.
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.snapshotChecksum).toBe("sha256:live");
    expect(snapshot.snapshotRunId).toBe("run-selected");
  });

  it("ignores partial catalogs and unchanged rows when reconciling", () => {
    const base = state("run-selected", "hello", "sha256:live");
    const manager = new EventStreamStateManager(base, { deferCacheHydration: true, initialSnapshotSource: "server" });
    const before = manager.getSnapshot();

    expect(manager.reconcileServerCatalog({
      ...base,
      snapshotScope: { catalog: { complete: false, completeRunIds: ["run-selected"] } },
      runs: [{ ...run("run-selected"), status: "running" }],
    })).toBe(false);
    expect(manager.reconcileServerCatalog({
      ...base,
      snapshotScope: { catalog: { complete: true, completeRunIds: [] } },
    })).toBe(false);
    expect(manager.getSnapshot()).toBe(before);
  });
});
