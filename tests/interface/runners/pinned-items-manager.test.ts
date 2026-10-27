import { describe, expect, it, vi } from "vitest";
import { StateManager } from "@/lib/state-manager";
import {
  PINNED_PROJECTS_PREFERENCE_KEY,
  PINNED_SESSIONS_PREFERENCE_KEY,
  PinnedItemsManager,
  readPinnedProjects,
  readPinnedSessions,
} from "@/interface/runners/PinnedItemsManager";
import type { RunnerConnectionSnapshot } from "@/interface/runners/RunnerConnection";
import {
  emptyRunnerScopedState,
  type RunnerProfileStoreSnapshot,
  type RunnerScopedState,
} from "@/interface/runners/RunnerProfile";

function connection(
  profileId: string,
  overrides: Partial<RunnerConnectionSnapshot> = {},
): RunnerConnectionSnapshot {
  return {
    profileId,
    status: "online",
    active: false,
    runnerInstanceId: `runner-${profileId}`,
    runnerName: `Server ${profileId}`,
    observedRunnerInstanceId: null,
    lastError: null,
    retryAt: null,
    resyncCount: 0,
    snapshot: null,
    bootstrap: null,
    ...overrides,
  };
}

const betaServer = (overrides: Partial<RunnerConnectionSnapshot> = {}) => connection("two", {
  snapshot: {
    plans: [],
    runs: [{ id: "run-b", planId: "p", status: "done", createdAt: "2026-10-01T00:00:00.000Z", projectPath: "/work/beta", title: "Beta work" }],
    readMarkers: { "run-b": "2026-10-02T00:00:00.000Z" },
  },
  bootstrap: { initialQueries: { settings: { values: { PROJECTS: JSON.stringify(["/work/beta"]) } } } } as never,
  ...overrides,
});

class FakeRegistry extends StateManager<{ activeRunnerId: string | null; connections: RunnerConnectionSnapshot[] }> {
  switchActive = vi.fn((profileId: string) => {
    this.patch({ activeRunnerId: profileId });
    return true;
  });
}

class FakeProfileStore extends StateManager<RunnerProfileStoreSnapshot> {
  constructor() {
    super({
      schemaVersion: 1,
      hydrated: true,
      activeRunnerId: "one",
      profiles: [],
      scopedState: {},
      recoveryNoticeCode: null,
    });
  }

  getScopedState(profileId: string): RunnerScopedState {
    return this.getSnapshot().scopedState[profileId] ?? emptyRunnerScopedState();
  }

  async updateScopedState(profileId: string, patch: Partial<RunnerScopedState>) {
    const previous = this.getScopedState(profileId);
    this.patch((current) => ({
      scopedState: {
        ...current.scopedState,
        [profileId]: {
          ...previous,
          preferences: { ...previous.preferences, ...(patch.preferences ?? {}) },
        },
      },
    }));
  }
}

function setup(connections: RunnerConnectionSnapshot[], activeRunnerId = "one") {
  const registry = new FakeRegistry({ activeRunnerId, connections });
  const profileStore = new FakeProfileStore();
  const urls: string[] = [];
  let tick = 0;
  const manager = new PinnedItemsManager({
    registry,
    profileStore,
    now: () => `2026-10-26T00:00:0${tick++}.000Z`,
    replaceUrl: (path) => urls.push(path),
  });
  manager.start();
  return { registry, profileStore, manager, urls };
}

describe("PinnedItemsManager", () => {
  it("lists project pins from every server in pin order, building other servers' groups from their snapshots", async () => {
    const { manager } = setup([connection("one"), betaServer()]);

    await manager.setProjectPinned("two", "/work/beta/", true);
    await manager.setProjectPinned("one", "/work/alpha", true);

    const { projects, serverCount } = manager.getSnapshot();
    expect(serverCount).toBe(2);
    expect(projects.map((entry) => [entry.profileId, entry.path, entry.active, entry.runnerName])).toEqual([
      ["two", "/work/beta", false, "Server two"],
      ["one", "/work/alpha", true, "Server one"],
    ]);
    expect(projects[0]!.group?.runs.map((run) => run.title)).toEqual(["Beta work"]);
    expect(projects[0]!.readMarkers).toEqual({ "run-b": "2026-10-02T00:00:00.000Z" });
    // The active server's groups come from the sidebar's own live state.
    expect(projects[1]!.group).toBeNull();
  });

  it("lists session pins from every server, resolving another server's run from its snapshot", async () => {
    const { manager } = setup([connection("one"), betaServer()]);

    await manager.setSessionPinned("two", "run-b", true);
    await manager.setSessionPinned("one", "run-a", true);
    await manager.setSessionPinned("two", "run-missing", true);

    const { sessions } = manager.getSnapshot();
    expect(sessions.map((entry) => [entry.profileId, entry.runId, entry.active])).toEqual([
      ["two", "run-b", false],
      ["one", "run-a", true],
      ["two", "run-missing", false],
    ]);
    expect(sessions[0]!.run?.title).toBe("Beta work");
    expect(sessions[1]!.run).toBeNull();
    expect(sessions[2]!.run).toBeNull();
    expect(manager.isSessionPinned("two", "run-b")).toBe(true);

    await manager.setSessionPinned("two", "run-b", false);
    expect(manager.isSessionPinned("two", "run-b")).toBe(false);
    expect(manager.getSnapshot().sessions.map((entry) => entry.runId)).toEqual(["run-a", "run-missing"]);
  });

  it("follows the server's live status and name", async () => {
    const { manager, registry } = setup([connection("one"), betaServer()]);
    await manager.setSessionPinned("two", "run-b", true);

    registry.patch({ connections: [connection("one"), betaServer({ status: "offline", runnerName: "Greenhorn" })] });

    expect(manager.getSnapshot().sessions[0]).toMatchObject({ status: "offline", runnerName: "Greenhorn" });
  });

  it("keeps a project pin on a server that reports nothing for it, so it can still be unpinned", async () => {
    const { manager } = setup([connection("one"), connection("two")]);

    await manager.setProjectPinned("two", "/gone/project", true);
    const [entry] = manager.getSnapshot().projects;
    expect(entry!.group).toEqual({ path: "/gone/project", name: "project", runs: [] });

    await manager.setProjectPinned("two", "/gone/project", false);
    expect(manager.getSnapshot().projects).toEqual([]);
    expect(manager.isProjectPinned("two", "/gone/project")).toBe(false);
  });

  it("does not republish when an unrelated server frame leaves pinned items unchanged", async () => {
    const { manager, registry } = setup([connection("one"), connection("two")]);
    await manager.setProjectPinned("two", "/gone/project", true);
    await manager.setSessionPinned("two", "run-x", true);
    const before = manager.getSnapshot();

    registry.patch({ connections: [connection("one", { snapshot: { runs: [] } }), connection("two")] });

    expect(manager.getSnapshot()).toBe(before);
  });

  it("re-pinning an already pinned item keeps its original position", async () => {
    const { manager } = setup([connection("one")]);
    await manager.setProjectPinned("one", "/a", true);
    await manager.setProjectPinned("one", "/b", true);
    await manager.setProjectPinned("one", "/a", true);
    await manager.setSessionPinned("one", "run-1", true);
    await manager.setSessionPinned("one", "run-2", true);
    await manager.setSessionPinned("one", "run-1", true);

    const { projects, sessions } = manager.getSnapshot();
    expect(projects.map((entry) => entry.path)).toEqual(["/a", "/b"]);
    expect(sessions.map((entry) => entry.runId)).toEqual(["run-1", "run-2"]);
  });

  it("opens another server's conversation by writing the route before switching servers", () => {
    const { manager, registry, urls } = setup([connection("one"), connection("two")]);
    registry.switchActive.mockImplementation((profileId: string) => {
      expect(urls).toEqual(["/session/run%2F1"]);
      registry.patch({ activeRunnerId: profileId });
      return true;
    });

    manager.openRun("two", "run/1");

    expect(registry.switchActive).toHaveBeenCalledWith("two");
  });

  it("starts a draft in another server's project through the project route", () => {
    const { manager, registry, urls } = setup([connection("one"), connection("two")]);

    manager.beginConversation("two", "/work/beta");

    expect(urls).toEqual(["/?project=%2Fwork%2Fbeta"]);
    expect(registry.switchActive).toHaveBeenCalledWith("two");
  });

  it("ignores malformed stored pins", () => {
    expect(readPinnedProjects({
      [PINNED_PROJECTS_PREFERENCE_KEY]: [
        { path: "/ok", pinnedAt: "2026-10-26T00:00:00.000Z" },
        { path: "/ok/" },
        { path: 3 },
        null,
        "nope",
      ],
    })).toEqual([{ path: "/ok", pinnedAt: "2026-10-26T00:00:00.000Z" }]);
    expect(readPinnedProjects({ [PINNED_PROJECTS_PREFERENCE_KEY]: "bad" })).toEqual([]);
    expect(readPinnedSessions({
      [PINNED_SESSIONS_PREFERENCE_KEY]: [
        { runId: "run-1", pinnedAt: "2026-10-26T00:00:00.000Z" },
        { runId: "run-1" },
        { runId: "" },
        { path: "/x" },
      ],
    })).toEqual([{ runId: "run-1", pinnedAt: "2026-10-26T00:00:00.000Z" }]);
  });
});
