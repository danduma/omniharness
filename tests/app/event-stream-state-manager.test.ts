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
});
