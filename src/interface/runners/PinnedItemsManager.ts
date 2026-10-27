import { StateManager } from "@/lib/state-manager";
import { buildConversationGroups, type ConversationGroup } from "@/lib/conversations";
import { normalizeProjectPath } from "@/lib/project-paths";
import type { RunnerConnectionSnapshot, RunnerConnectionStatus } from "./RunnerConnection";
import type { RunnerProfileStoreSnapshot, RunnerScopedState } from "./RunnerProfile";

/**
 * Pins live in the client's per-server scoped preferences rather than in any
 * one server's settings: a pinned session or project stays reachable while a
 * different server is on screen, and only the client knows the full set of
 * servers. The scope is the server identity, so a pin follows the server across
 * profile merges and disappears with it when the server is forgotten.
 */
export const PINNED_PROJECTS_PREFERENCE_KEY = "pinnedProjects";
export const PINNED_SESSIONS_PREFERENCE_KEY = "pinnedSessions";

export type PinnedProjectRecord = {
  path: string;
  pinnedAt: string;
};

export type PinnedSessionRecord = {
  runId: string;
  pinnedAt: string;
};

export type ConversationGroupRun = ConversationGroup["runs"][number];

type PinnedEntryBase = {
  key: string;
  profileId: string;
  runnerName: string;
  status: RunnerConnectionStatus;
  /** True for the server on screen, whose data the sidebar holds in fresher local state. */
  active: boolean;
  pinnedAt: string;
  readMarkers: Record<string, string>;
};

export type PinnedProjectEntry = PinnedEntryBase & {
  path: string;
  /** Built from that server's own live snapshot. Null for the active server. */
  group: ConversationGroup | null;
};

export type PinnedSessionEntry = PinnedEntryBase & {
  runId: string;
  /**
   * From that server's own live snapshot. Null for the active server, and for
   * a run the server no longer reports.
   */
  run: ConversationGroupRun | null;
};

export type PinnedItemsSnapshot = {
  projects: PinnedProjectEntry[];
  sessions: PinnedSessionEntry[];
  /** Pins only say which machine they belong to when there is more than one. */
  serverCount: number;
};

type PinnedItemsProfileStore = {
  getSnapshot(): RunnerProfileStoreSnapshot;
  subscribe(listener: () => void): () => void;
  getScopedState(profileId: string): RunnerScopedState;
  updateScopedState(profileId: string, patch: Partial<RunnerScopedState>): Promise<void>;
};

type PinnedItemsRegistry = {
  getSnapshot(): { activeRunnerId: string | null; connections: RunnerConnectionSnapshot[] };
  subscribe(listener: () => void): () => void;
  switchActive(profileId: string): boolean;
};

type RemoteCatalogCache = {
  snapshot: Record<string, unknown> | null;
  projectsSetting: string | undefined;
  groups: ConversationGroup[];
  runsById: Map<string, ConversationGroupRun>;
  /** Pinned paths the server reports nothing for still need a stable group. */
  placeholders: Map<string, ConversationGroup>;
};

const NO_READ_MARKERS: Record<string, string> = {};

function readRecords<T extends { pinnedAt: string }>(
  value: unknown,
  readId: (item: Record<string, unknown>) => string | null,
  build: (id: string, pinnedAt: string) => T,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const records: T[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id = readId(item as Record<string, unknown>);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const pinnedAt = (item as { pinnedAt?: unknown }).pinnedAt;
    records.push(build(id, typeof pinnedAt === "string" ? pinnedAt : ""));
  }
  return records;
}

export function readPinnedProjects(preferences: Record<string, unknown> | undefined): PinnedProjectRecord[] {
  return readRecords(
    preferences?.[PINNED_PROJECTS_PREFERENCE_KEY],
    (item) => (typeof item.path === "string" && item.path.trim() ? normalizeProjectPath(item.path) : null),
    (path, pinnedAt) => ({ path, pinnedAt }),
  );
}

export function readPinnedSessions(preferences: Record<string, unknown> | undefined): PinnedSessionRecord[] {
  return readRecords(
    preferences?.[PINNED_SESSIONS_PREFERENCE_KEY],
    (item) => (typeof item.runId === "string" && item.runId.trim() ? item.runId.trim() : null),
    (runId, pinnedAt) => ({ runId, pinnedAt }),
  );
}

function parseProjectsSetting(value: string | undefined) {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function asArray<T>(value: unknown) {
  return Array.isArray(value) ? value as T[] : [];
}

function byPinnedAt(left: { pinnedAt: string }, right: { pinnedAt: string }) {
  return left.pinnedAt < right.pinnedAt ? -1 : left.pinnedAt > right.pinnedAt ? 1 : 0;
}

function sameBase(entry: PinnedEntryBase, other: PinnedEntryBase) {
  return entry.key === other.key
    && entry.runnerName === other.runnerName
    && entry.status === other.status
    && entry.active === other.active
    && entry.pinnedAt === other.pinnedAt
    && entry.readMarkers === other.readMarkers;
}

function sameProjects(left: PinnedProjectEntry[], right: PinnedProjectEntry[]) {
  return left.length === right.length
    && left.every((entry, index) => sameBase(entry, right[index]!) && entry.group === right[index]!.group);
}

function sameSessions(left: PinnedSessionEntry[], right: PinnedSessionEntry[]) {
  return left.length === right.length
    && left.every((entry, index) => sameBase(entry, right[index]!) && entry.run === right[index]!.run);
}

export class PinnedItemsManager extends StateManager<PinnedItemsSnapshot> {
  private readonly registry: PinnedItemsRegistry;
  private readonly profileStore: PinnedItemsProfileStore;
  private readonly now: () => string;
  private readonly replaceUrl: (path: string) => void;
  private readonly remoteCatalogs = new Map<string, RemoteCatalogCache>();
  private unsubscribes: Array<() => void> = [];

  constructor(options: {
    registry: PinnedItemsRegistry;
    profileStore: PinnedItemsProfileStore;
    now?: () => string;
    replaceUrl?: (path: string) => void;
  }) {
    super({ projects: [], sessions: [], serverCount: 0 });
    this.registry = options.registry;
    this.profileStore = options.profileStore;
    this.now = options.now ?? (() => new Date().toISOString());
    this.replaceUrl = options.replaceUrl ?? ((path) => {
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", path);
      }
    });
  }

  start() {
    if (this.unsubscribes.length > 0) return;
    const recompute = () => this.recompute();
    this.unsubscribes = [
      this.registry.subscribe(recompute),
      this.profileStore.subscribe(recompute),
    ];
    this.recompute();
  }

  stop() {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    this.remoteCatalogs.clear();
  }

  isProjectPinned(profileId: string, path: string) {
    const normalizedPath = normalizeProjectPath(path);
    return this.readPreferences(profileId, readPinnedProjects).some((record) => record.path === normalizedPath);
  }

  isSessionPinned(profileId: string, runId: string) {
    return this.readPreferences(profileId, readPinnedSessions).some((record) => record.runId === runId);
  }

  setProjectPinned(profileId: string, path: string, pinned: boolean) {
    const normalizedPath = normalizeProjectPath(path);
    return this.writePin(
      profileId,
      PINNED_PROJECTS_PREFERENCE_KEY,
      this.readPreferences(profileId, readPinnedProjects),
      (record) => record.path === normalizedPath,
      pinned ? { path: normalizedPath, pinnedAt: this.now() } : null,
    );
  }

  setSessionPinned(profileId: string, runId: string, pinned: boolean) {
    return this.writePin(
      profileId,
      PINNED_SESSIONS_PREFERENCE_KEY,
      this.readPreferences(profileId, readPinnedSessions),
      (record) => record.runId === runId,
      pinned ? { runId, pinnedAt: this.now() } : null,
    );
  }

  /**
   * Opening a pinned item on another server is a server switch. The route is
   * written first because the app remounts for the new server and takes its
   * selection from the URL, exactly as a deep link would.
   */
  openRun(profileId: string, runId: string) {
    this.replaceUrl(`/session/${encodeURIComponent(runId)}`);
    return this.registry.switchActive(profileId);
  }

  beginConversation(profileId: string, path: string) {
    this.replaceUrl(`/?${new URLSearchParams({ project: path }).toString()}`);
    return this.registry.switchActive(profileId);
  }

  private async writePin<T>(
    profileId: string,
    preferenceKey: string,
    current: T[],
    matches: (record: T) => boolean,
    added: T | null,
  ) {
    const without = current.filter((record) => !matches(record));
    const alreadyPinned = without.length !== current.length;
    // Re-pinning keeps the original position; unpinning an absent pin is a no-op.
    if (added ? alreadyPinned : !alreadyPinned) {
      return;
    }
    await this.profileStore.updateScopedState(profileId, {
      preferences: { [preferenceKey]: added ? [...without, added] : without },
    });
  }

  private readPreferences<T>(profileId: string, read: (preferences: Record<string, unknown>) => T[]) {
    try {
      return read(this.profileStore.getScopedState(profileId).preferences);
    } catch {
      return [];
    }
  }

  private remoteCatalogFor(connection: RunnerConnectionSnapshot) {
    const projectsSetting = connection.bootstrap?.initialQueries?.settings?.values?.PROJECTS;
    const cached = this.remoteCatalogs.get(connection.profileId);
    if (cached && cached.snapshot === connection.snapshot && cached.projectsSetting === projectsSetting) {
      return cached;
    }
    const groups = buildConversationGroups({
      explicitProjects: parseProjectsSetting(projectsSetting),
      plans: asArray(connection.snapshot?.plans),
      runs: asArray(connection.snapshot?.runs),
    });
    const next: RemoteCatalogCache = {
      snapshot: connection.snapshot,
      projectsSetting,
      groups,
      runsById: new Map(groups.flatMap((group) => group.runs.map((run) => [run.id, run] as const))),
      placeholders: cached?.placeholders ?? new Map(),
    };
    this.remoteCatalogs.set(connection.profileId, next);
    return next;
  }

  private remoteGroupFor(catalog: RemoteCatalogCache, path: string) {
    const group = catalog.groups.find((candidate) => candidate.path === path);
    if (group) return group;
    let placeholder = catalog.placeholders.get(path);
    if (!placeholder) {
      placeholder = { path, name: path.split(/[/\\]/).pop() || path, runs: [] };
      catalog.placeholders.set(path, placeholder);
    }
    return placeholder;
  }

  private recompute() {
    const { activeRunnerId, connections } = this.registry.getSnapshot();
    const liveProfileIds = new Set(connections.map((connection) => connection.profileId));
    for (const profileId of this.remoteCatalogs.keys()) {
      if (!liveProfileIds.has(profileId)) this.remoteCatalogs.delete(profileId);
    }

    const projects: PinnedProjectEntry[] = [];
    const sessions: PinnedSessionEntry[] = [];
    for (const connection of connections) {
      const projectPins = this.readPreferences(connection.profileId, readPinnedProjects);
      const sessionPins = this.readPreferences(connection.profileId, readPinnedSessions);
      if (projectPins.length === 0 && sessionPins.length === 0) continue;
      const active = connection.profileId === activeRunnerId;
      const catalog = active ? null : this.remoteCatalogFor(connection);
      const base = {
        profileId: connection.profileId,
        runnerName: connection.runnerName,
        status: connection.status,
        active,
        readMarkers: active
          ? NO_READ_MARKERS
          : (connection.snapshot?.readMarkers ?? NO_READ_MARKERS) as Record<string, string>,
      };
      for (const pin of projectPins) {
        projects.push({
          ...base,
          key: `${connection.profileId}\u0000project\u0000${pin.path}`,
          pinnedAt: pin.pinnedAt,
          path: pin.path,
          group: catalog ? this.remoteGroupFor(catalog, pin.path) : null,
        });
      }
      for (const pin of sessionPins) {
        sessions.push({
          ...base,
          key: `${connection.profileId}\u0000session\u0000${pin.runId}`,
          pinnedAt: pin.pinnedAt,
          runId: pin.runId,
          run: catalog?.runsById.get(pin.runId) ?? null,
        });
      }
    }
    projects.sort(byPinnedAt);
    sessions.sort(byPinnedAt);

    const current = this.getSnapshot();
    const serverCount = connections.length;
    if (
      current.serverCount !== serverCount
      || !sameProjects(current.projects, projects)
      || !sameSessions(current.sessions, sessions)
    ) {
      this.update({ projects, sessions, serverCount });
    }
  }
}
