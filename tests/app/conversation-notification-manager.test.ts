import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationNotificationManager } from "@/app/home/ConversationNotificationManager";
import type { EventStreamState } from "@/app/home/types";

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
  let manager: ConversationNotificationManager;
  let permission: NotificationPermission;

  beforeEach(() => {
    storage = new MemoryStorage();
    notify = vi.fn().mockResolvedValue(undefined);
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
      title: "OmniHarness needs input",
      body: "Implement notifications is waiting for your input.",
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
      title: "Conversation complete",
      body: "Implement notifications is complete.",
      url: "/session/run-1",
      tag: "omniharness-run-1-complete",
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
      title: "OmniHarness needs input",
      body: "Implement notifications has a permission request waiting.",
      url: "/session/run-1",
      tag: "omniharness-run-1-permission-run-1-worker-1-7",
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
