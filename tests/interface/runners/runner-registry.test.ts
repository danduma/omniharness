import { describe, expect, it, vi } from "vitest";
import { StateManager } from "@/lib/state-manager";
import { RunnerRegistry } from "@/interface/runners/RunnerRegistry";
import type {
  RunnerConnection,
  RunnerConnectionSnapshot,
} from "@/interface/runners/RunnerConnection";
import type { RunnerProfile } from "@/interface/runners/RunnerProfile";

function profile(id: string): RunnerProfile {
  return {
    id,
    runnerInstanceId: `runner-${id}`,
    label: id,
    baseUrl: `https://${id}.example`,
    savedPassword: null,
    authTransport: "bearer",
    credentialRef: `credential-${id}`,
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastConnectedAt: null,
    isSameOrigin: false,
  };
}

class FakeConnection extends StateManager<RunnerConnectionSnapshot> {
  start = vi.fn(async () => {});
  stop = vi.fn();
  updateProfile = vi.fn();
  setActive = vi.fn((active: boolean) => {
    this.patch({ active });
  });
  constructor(readonly profileId: string, runs: string[]) {
    super({
      profileId,
      status: "online",
      active: false,
      runnerInstanceId: `runner-${profileId}`,
      runnerName: profileId,
      observedRunnerInstanceId: null,
      lastError: null,
      retryAt: null,
      resyncCount: 0,
      snapshot: { runs: runs.map((id) => ({ id })) },
    });
  }
  getQueryClient() { return null; }
}

function profileStore(profiles: RunnerProfile[], activeRunnerId = profiles[0]!.id) {
  return {
    getSnapshot: () => ({
      profiles,
      activeRunnerId,
      hydrated: true,
      schemaVersion: 1 as const,
      scopedState: {},
      recoveryNoticeCode: null,
    }),
    subscribe: () => () => {},
  };
}

describe("RunnerRegistry", () => {
  it("starts every profile and switching keeps inactive main connections alive", async () => {
    const connections = new Map<string, FakeConnection>();
    const registry = new RunnerRegistry({
      profileStore: profileStore([profile("one"), profile("two")]),
      connectionFactory: (item) => {
        const connection = new FakeConnection(item.id, []);
        connections.set(item.id, connection);
        return connection as unknown as RunnerConnection;
      },
    });
    await registry.start();

    expect(connections.get("one")?.start).toHaveBeenCalledOnce();
    expect(connections.get("two")?.start).toHaveBeenCalledOnce();
    registry.switchActive("two");
    expect(connections.get("one")?.setActive).toHaveBeenLastCalledWith(false);
    expect(connections.get("one")?.stop).not.toHaveBeenCalled();
    expect(connections.get("two")?.setActive).toHaveBeenLastCalledWith(true);
  });

  it("resolves deep links against only the active runner", async () => {
    const registry = new RunnerRegistry({
      profileStore: profileStore([profile("one"), profile("two")]),
      connectionFactory: (item) => new FakeConnection(
        item.id,
        item.id === "two" ? ["run-on-two"] : [],
      ) as unknown as RunnerConnection,
    });
    await registry.start();

    expect(registry.resolveActiveRun("run-on-two")).toEqual({
      status: "not_found",
      runnerId: "one",
      runId: "run-on-two",
    });
    registry.switchActive("two");
    expect(registry.resolveActiveRun("run-on-two")).toEqual({
      status: "found",
      runnerId: "two",
      runId: "run-on-two",
    });
  });

  it("removes forgotten connections and ignores their later updates", async () => {
    const profiles = [profile("one"), profile("two")];
    const store = profileStore(profiles);
    const connections = new Map<string, FakeConnection>();
    const registry = new RunnerRegistry({
      profileStore: store,
      connectionFactory: (item) => {
        const connection = new FakeConnection(item.id, []);
        connections.set(item.id, connection);
        return connection as unknown as RunnerConnection;
      },
    });
    await registry.start();
    registry.reconcile([profiles[0]!]);
    connections.get("two")?.patch({ status: "needs-reauth" });

    expect(connections.get("two")?.stop).toHaveBeenCalledOnce();
    expect(registry.getConnection("two")).toBeNull();
    expect(registry.getSnapshot().connections.some((item) => item.profileId === "two")).toBe(false);
  });

  it("flags two live endpoints that report the same durable identity", async () => {
    const registry = new RunnerRegistry({
      profileStore: profileStore([profile("one"), profile("two")]),
      connectionFactory: (item) => new FakeConnection(item.id, []) as unknown as RunnerConnection,
    });
    await registry.start();
    registry.getConnection("two")!.patch({
      runnerInstanceId: "runner-one",
    });

    expect(registry.getSnapshot().identityCollisions).toEqual([{
      runnerInstanceId: "runner-one",
      profileIds: ["one", "two"],
    }]);
  });

  it("creates a fresh connection when a forgotten profile is added again", async () => {
    const created: FakeConnection[] = [];
    const runnerProfile = profile("one");
    const registry = new RunnerRegistry({
      profileStore: profileStore([runnerProfile]),
      connectionFactory: (item) => {
        const connection = new FakeConnection(item.id, []);
        created.push(connection);
        return connection as unknown as RunnerConnection;
      },
    });
    await registry.start();
    registry.reconcile([]);
    registry.reconcile([runnerProfile]);

    expect(created).toHaveLength(2);
    expect(created[0]?.stop).toHaveBeenCalledOnce();
    expect(registry.getConnection("one")).toBe(created[1]);
  });
});
