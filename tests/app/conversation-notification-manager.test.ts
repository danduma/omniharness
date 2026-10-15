import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationNotificationManager } from "@/interface/home/ConversationNotificationManager";
import type { EventStreamState } from "@/interface/home/types";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function createState(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    ...overrides,
  };
}

function buildRun(id: string, status: string, title = "Implement notifications") {
  return {
    id,
    planId: `plan-${id}`,
    mode: "implementation" as const,
    status,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    projectPath: "/repo",
    title,
  };
}

describe("ConversationNotificationManager", () => {
  let storage: MemoryStorage;
  let notify: ReturnType<typeof vi.fn>;
  let requestPermission: ReturnType<typeof vi.fn>;
  let subscribe: ReturnType<typeof vi.fn>;
  let saveSubscription: ReturnType<typeof vi.fn>;
  let loadConfig: ReturnType<typeof vi.fn>;
  let manager: ConversationNotificationManager;
  let permission: NotificationPermission;

  beforeEach(() => {
    storage = new MemoryStorage();
    notify = vi.fn().mockResolvedValue(undefined);
    subscribe = vi.fn().mockResolvedValue({
      endpoint: "https://push.example.test/subscription/abc123",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-secret",
      },
    });
    saveSubscription = vi.fn().mockResolvedValue(undefined);
    loadConfig = vi.fn().mockResolvedValue({
      supported: true,
      publicKey: "public-key",
    });
    permission = "granted";
    requestPermission = vi.fn().mockImplementation(async () => {
      permission = "granted";
      return permission;
    });
    manager = new ConversationNotificationManager({
      storage,
      notifier: { notify },
      permissionProvider: {
        getPermission: () => permission,
        requestPermission,
        isSupported: () => true,
      },
      visibilityProvider: () => "hidden",
      pushClient: {
        isSupported: () => true,
        subscribe,
        unsubscribe: vi.fn().mockResolvedValue("https://push.example.test/subscription/abc123"),
      },
      subscriptionApi: {
        loadConfig,
        saveSubscription,
        removeSubscription: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("requests permission from a user gesture and persists enabled notifications", async () => {
    permission = "default";

    await manager.requestEnable();

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(storage.getItem("omni-notifications-enabled")).toBe("true");
    expect(manager.getSnapshot()).toMatchObject({
      enabled: true,
      permission: "granted",
    });
    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith("public-key");
    expect(saveSubscription).toHaveBeenCalledWith({
      endpoint: "https://push.example.test/subscription/abc123",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-secret",
      },
    });
  });

  it("removes the server push subscription when notifications are disabled", async () => {
    const unsubscribe = vi.fn().mockResolvedValue("https://push.example.test/subscription/abc123");
    const removeSubscription = vi.fn().mockResolvedValue(undefined);
    manager = new ConversationNotificationManager({
      storage,
      notifier: { notify },
      permissionProvider: {
        getPermission: () => permission,
        requestPermission,
        isSupported: () => true,
      },
      visibilityProvider: () => "hidden",
      pushClient: {
        isSupported: () => true,
        subscribe,
        unsubscribe,
      },
      subscriptionApi: {
        loadConfig,
        saveSubscription,
        removeSubscription,
      },
    });
    await manager.requestEnable();

    manager.disable();
    await Promise.resolve();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(removeSubscription).toHaveBeenCalledWith("https://push.example.test/subscription/abc123");
    expect(storage.getItem("omni-notifications-enabled")).toBe("false");
  });

  it("does not notify for the initial snapshot, then notifies when a conversation starts awaiting input", async () => {
    await manager.requestEnable();

    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "running")],
    }));
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "awaiting_user")],
      clarifications: [{
        id: "clarification-1",
        runId: "run-1",
        question: "Which deployment target?",
        answer: null,
        status: "pending",
      }],
    }));

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Implement notifications — answer needed",
      body: "Which deployment target?",
      url: "/session/run-1",
      tag: "omniharness-run-1-input",
    }));
  });

  it("notifies when a conversation completes after being observed running", async () => {
    await manager.requestEnable();

    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "running")],
    }));
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "done")],
      executionEvents: [{
        id: "event-1",
        runId: "run-1",
        eventType: "run_completed",
        createdAt: "2026-05-10T00:00:01.000Z",
      }],
    }));

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Implement notifications — completed",
      body: "The workflow has finished. Open the conversation to review the result.",
      url: "/session/run-1",
      tag: "omniharness-run-1-complete",
    }));
  });

  it("ignores historical completion events while a new turn is running", async () => {
    await manager.requestEnable();
    manager.handleEventStreamState(createState({ runs: [buildRun("run-1", "running")] }));
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "running")],
      executionEvents: [{ id: "old", runId: "run-1", eventType: "run_completed", createdAt: "2026-05-09T00:00:00.000Z" }],
    }));
    expect(notify).not.toHaveBeenCalled();
  });

  it("waits for the worker and queued follow-ups before announcing completion", async () => {
    await manager.requestEnable();
    manager.handleEventStreamState(createState({ runs: [buildRun("run-1", "running")] }));
    const worker = { id: "worker-1", runId: "run-1", type: "codex", status: "working" };
    manager.handleEventStreamState(createState({ runs: [buildRun("run-1", "done")], workers: [worker] }));
    expect(notify).not.toHaveBeenCalled();
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "done")], workers: [{ ...worker, status: "idle" }],
      queuedMessages: [{ id: "q", runId: "run-1", action: "queue", content: "Push too", status: "pending", createdAt: "2026-05-10T00:00:00.000Z", updatedAt: "2026-05-10T00:00:00.000Z" }],
    }));
    expect(notify).not.toHaveBeenCalled();
    manager.handleEventStreamState(createState({ runs: [buildRun("run-1", "done")], workers: [{ ...worker, status: "idle" }] }));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("shows the conversation title and actual final response for a direct turn", async () => {
    await manager.requestEnable();
    const run = { ...buildRun("run-1", "running", "Commit and push"), mode: "commit" as const };
    manager.handleEventStreamState(createState({ runs: [run] }));
    manager.handleEventStreamState(createState({
      runs: [{ ...run, status: "done" }],
      workers: [{ id: "worker-1", runId: run.id, type: "codex", status: "idle" }],
      agents: [{ name: "worker-1", state: "idle", outputEntries: [
        { id: "intro", type: "message",  text: "I’ll inspect the branch.", timestamp: "2026-05-10T00:00:00.000Z" },
        { id: "final", type: "message",  text: "**Pushed** 10 commits to `origin/master`.", timestamp: "2026-05-10T00:01:00.000Z" },
      ] }],
    }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Commit and push — response ready", body: "Pushed 10 commits to origin/master." }));
  });

  it("keeps notification history separate per runner and names inactive runner alerts", async () => {
    await manager.requestEnable();

    manager.handleRunnerEventStreamState({
      profileId: "studio",
      runnerInstanceId: "runner-studio",
      runnerName: "Studio",
    }, createState({
      runs: [buildRun("shared-run", "running")],
    }));
    manager.handleRunnerEventStreamState({
      profileId: "laptop",
      runnerInstanceId: "runner-laptop",
      runnerName: "Laptop",
    }, createState({
      runs: [buildRun("shared-run", "running")],
    }));
    manager.handleRunnerEventStreamState({
      profileId: "laptop",
      runnerInstanceId: "runner-laptop",
      runnerName: "Laptop",
    }, createState({
      runs: [buildRun("shared-run", "awaiting_user")],
    }));

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Laptop: Implement notifications — answer needed",
      url: "/session/shared-run?runner=laptop",
      tag: "omniharness-runner-laptop-shared-run-input",
    }));
  });

  it("notifies when a worker permission prompt needs input", async () => {
    await manager.requestEnable();

    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "running")],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
      }],
    }));
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "running")],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        pendingPermissions: [{
          requestId: 7,
          requestedAt: "2026-05-10T00:00:01.000Z",
        }],
      }],
    }));

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Implement notifications — approval needed",
      body: "A tool needs your approval. Open the conversation to review the request.",
      url: "/session/run-1",
      tag: "omniharness-run-1-permission-run-1-worker-1-7",
    }));
  });

  it("discards a completion preview if a new turn starts while the stream is loading", async () => {
    let release: (value: unknown) => void = () => {};
    const loading = new Promise<unknown>((resolve) => { release = resolve; });
    const delayedManager = new ConversationNotificationManager({
      storage, notifier: { notify }, listEntries: () => loading,
      permissionProvider: { isSupported: () => true, getPermission: () => "granted", requestPermission: async () => "granted" },
      visibilityProvider: () => "hidden",
      pushClient: { isSupported: () => false, subscribe, unsubscribe: vi.fn() },
    });
    await delayedManager.requestEnable();
    const run = { ...buildRun("run-1", "running"), mode: "direct" as const };
    delayedManager.handleEventStreamState(createState({ runs: [run] }));
    delayedManager.handleEventStreamState(createState({
      runs: [{ ...run, status: "done" }], workers: [{ id: "worker-1", runId: run.id, type: "codex", status: "idle" }],
    }));
    delayedManager.handleEventStreamState(createState({ runs: [run] }));
    release({ entries: [], latestSeq: 0 });
    await loading;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(notify).not.toHaveBeenCalled();
  });

  it("reports failures with the actual error and does not repeat unchanged snapshots", async () => {
    await manager.requestEnable();
    manager.handleEventStreamState(createState({ runs: [buildRun("run-1", "running")] }));
    const failed = createState({ runs: [{ ...buildRun("run-1", "failed"), lastError: "Push rejected: remote contains new commits." }] });
    manager.handleEventStreamState(failed);
    manager.handleEventStreamState(failed);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Implement notifications — failed", body: "Push rejected: remote contains new commits.",
    }));
  });

  it("skips notifications while disabled or while the app is visible", async () => {
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "running")],
    }));
    manager.handleEventStreamState(createState({
      runs: [buildRun("run-1", "done")],
    }));
    expect(notify).not.toHaveBeenCalled();

    const visibleManager = new ConversationNotificationManager({
      storage,
      notifier: { notify },
      permissionProvider: {
        getPermission: () => "granted",
        requestPermission,
        isSupported: () => true,
      },
      visibilityProvider: () => "visible",
    });
    await visibleManager.requestEnable();
    visibleManager.handleEventStreamState(createState({
      runs: [buildRun("run-2", "running")],
    }));
    visibleManager.handleEventStreamState(createState({
      runs: [buildRun("run-2", "awaiting_user")],
    }));

    expect(notify).not.toHaveBeenCalled();
  });
});
