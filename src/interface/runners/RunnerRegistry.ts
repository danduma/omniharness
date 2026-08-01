import { StateManager } from "@/lib/state-manager";
import type { RunnerProfile, RunnerProfileStoreSnapshot } from "./RunnerProfile";
import {
  BoundedRunnerPreviewCache,
  RunnerConnection,
  type RunnerConnectionSnapshot,
} from "./RunnerConnection";

type ProfileStoreLike = {
  getSnapshot(): RunnerProfileStoreSnapshot;
  subscribe(listener: () => void): () => void;
  setActiveRunner?(profileId: string): Promise<void>;
};

export type RunnerIdentityCollision = {
  runnerInstanceId: string;
  profileIds: string[];
};

export type RunnerRegistrySnapshot = {
  activeRunnerId: string | null;
  connections: RunnerConnectionSnapshot[];
  identityCollisions: RunnerIdentityCollision[];
};

export class RunnerRegistry extends StateManager<RunnerRegistrySnapshot> {
  private readonly profileStore: ProfileStoreLike;
  private readonly connectionFactory: (profile: RunnerProfile) => RunnerConnection;
  private readonly connections = new Map<string, RunnerConnection>();
  private readonly connectionUnsubscribes = new Map<string, () => void>();
  private profileUnsubscribe: (() => void) | null = null;
  private started = false;
  readonly previewCache = new BoundedRunnerPreviewCache<unknown>(300);

  constructor(options: {
    profileStore: ProfileStoreLike;
    connectionFactory: (profile: RunnerProfile) => RunnerConnection;
  }) {
    super({
      activeRunnerId: options.profileStore.getSnapshot().activeRunnerId ?? null,
      connections: [],
      identityCollisions: [],
    });
    this.profileStore = options.profileStore;
    this.connectionFactory = options.connectionFactory;
  }

  async start() {
    if (this.started) return;
    const profileSnapshot = this.profileStore.getSnapshot();
    this.reconcile(profileSnapshot.profiles);
    this.started = true;
    this.switchActive(profileSnapshot.activeRunnerId);
    this.profileUnsubscribe = this.profileStore.subscribe(() => {
      const next = this.profileStore.getSnapshot();
      this.reconcile(next.profiles);
      if (next.activeRunnerId !== this.getSnapshot().activeRunnerId) {
        this.switchActive(next.activeRunnerId, false);
      }
    });
    await Promise.all([...this.connections.values()].map((connection) => connection.start()));
  }

  stop() {
    this.started = false;
    this.profileUnsubscribe?.();
    this.profileUnsubscribe = null;
    for (const unsubscribe of this.connectionUnsubscribes.values()) {
      unsubscribe();
    }
    this.connectionUnsubscribes.clear();
    for (const connection of this.connections.values()) {
      connection.stop();
    }
    this.connections.clear();
    this.publish();
  }

  reconcile(profiles: RunnerProfile[]) {
    const nextIds = new Set(profiles.map((profile) => profile.id));
    for (const [profileId, connection] of this.connections) {
      if (nextIds.has(profileId)) continue;
      this.connectionUnsubscribes.get(profileId)?.();
      this.connectionUnsubscribes.delete(profileId);
      connection.stop();
      this.connections.delete(profileId);
    }
    for (const profile of profiles) {
      const existing = this.connections.get(profile.id);
      if (existing) {
        existing.updateProfile(profile);
        continue;
      }
      const connection = this.connectionFactory(profile);
      this.connections.set(profile.id, connection);
      this.connectionUnsubscribes.set(profile.id, connection.subscribe(() => {
        this.publish();
      }));
      if (this.started) {
        void connection.start();
      }
    }
    const activeRunnerId = this.getSnapshot().activeRunnerId;
    if (activeRunnerId && !this.connections.has(activeRunnerId)) {
      this.patch({
        activeRunnerId: profiles[0]?.id ?? null,
      }, false);
    }
    this.publish();
  }

  getConnection(profileId: string) {
    return this.connections.get(profileId) ?? null;
  }

  getActiveConnection() {
    const active = this.getSnapshot().activeRunnerId;
    return active ? this.getConnection(active) : null;
  }

  retryRecoverableConnections() {
    for (const connection of this.connections.values()) {
      const status = connection.getSnapshot().status;
      if (status === "degraded" || status === "offline") {
        void connection.retry();
      }
    }
  }

  switchActive(profileId: string, persist = true) {
    if (!this.connections.has(profileId)) {
      return false;
    }
    for (const [id, connection] of this.connections) {
      connection.setActive(id === profileId);
    }
    this.patch({ activeRunnerId: profileId }, false);
    this.publish();
    if (persist) {
      void this.profileStore.setActiveRunner?.(profileId);
    }
    return true;
  }

  resolveActiveRun(runId: string) {
    const runnerId = this.getSnapshot().activeRunnerId;
    const connection = runnerId ? this.connections.get(runnerId) : null;
    if (!runnerId || !connection) {
      return { status: "loading" as const, runnerId, runId };
    }
    const state = connection.getSnapshot();
    if (state.status === "connecting" || !state.snapshot) {
      return { status: "loading" as const, runnerId, runId };
    }
    const runs = Array.isArray(state.snapshot.runs)
      ? state.snapshot.runs as Array<{ id?: unknown }>
      : [];
    return runs.some((run) => run.id === runId)
      ? { status: "found" as const, runnerId, runId }
      : { status: "not_found" as const, runnerId, runId };
  }

  private publish() {
    const snapshots = [...this.connections.values()].map(
      (connection) => connection.getSnapshot(),
    );
    const byIdentity = new Map<string, string[]>();
    for (const snapshot of snapshots) {
      if (!snapshot.runnerInstanceId || snapshot.status !== "online") continue;
      const profiles = byIdentity.get(snapshot.runnerInstanceId) ?? [];
      profiles.push(snapshot.profileId);
      byIdentity.set(snapshot.runnerInstanceId, profiles);
    }
    const identityCollisions = [...byIdentity]
      .filter(([, profileIds]) => profileIds.length > 1)
      .map(([runnerInstanceId, profileIds]) => ({
        runnerInstanceId,
        profileIds: [...profileIds].sort(),
      }));
    this.update({
      activeRunnerId: this.getSnapshot().activeRunnerId,
      connections: snapshots,
      identityCollisions,
    });
  }
}
