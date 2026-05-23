import { describe, expect, it } from "vitest";
import { EventStreamSnapshotCacheManager } from "@/app/home/EventStreamSnapshotCacheManager";
import { EventStreamStateManager } from "@/app/home/EventStreamStateManager";
import type { EventStreamState } from "@/app/home/types";

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

  it("can switch to a selected conversation from the scoped frontend cache", () => {
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
    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotChecksum).toBe("sha256:b");
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["cached second conversation"]);
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
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["fresh server conversation"]);
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
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["cached second conversation"]);
  });
});
