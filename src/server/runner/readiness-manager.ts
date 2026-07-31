import type {
  ManagedBridgeSnapshot,
} from "./managed-bridge-controller";

export type RunnerReadinessStatus =
  | "starting"
  | "ready"
  | "degraded"
  | "stopping"
  | "stopped";

export interface RunnerReadinessSnapshot {
  status: RunnerReadinessStatus;
  origin: string | null;
  bridgeStatus: ManagedBridgeSnapshot["status"];
  bridgeReason: string | null;
}

interface BridgeSnapshotSource {
  getSnapshot(): ManagedBridgeSnapshot;
  subscribe(listener: () => void): () => void;
}

export class RunnerReadinessManager {
  private snapshot: RunnerReadinessSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeBridge: () => void;
  private stopping = false;
  private stopped = false;

  constructor(private readonly bridge: BridgeSnapshotSource) {
    const bridgeSnapshot = bridge.getSnapshot();
    this.snapshot = {
      status: "starting",
      origin: null,
      bridgeStatus: bridgeSnapshot.status,
      bridgeReason: bridgeSnapshot.reason,
    };
    this.unsubscribeBridge = bridge.subscribe(() => this.recompute());
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  markHttpListening(origin: string) {
    this.snapshot = { ...this.snapshot, origin };
    this.recompute();
  }

  markStopping() {
    this.stopping = true;
    this.recompute();
  }

  markStopped() {
    this.stopped = true;
    this.stopping = false;
    this.unsubscribeBridge();
    this.recompute();
  }

  private recompute() {
    const bridge = this.bridge.getSnapshot();
    let status: RunnerReadinessStatus;
    if (this.stopped) {
      status = "stopped";
    } else if (this.stopping) {
      status = "stopping";
    } else if (!this.snapshot.origin) {
      status = "starting";
    } else if (bridge.status === "ready") {
      status = "ready";
    } else if (
      bridge.status === "unavailable"
      || bridge.status === "stopped"
    ) {
      status = "degraded";
    } else {
      status = "starting";
    }

    this.snapshot = {
      ...this.snapshot,
      status,
      bridgeStatus: bridge.status,
      bridgeReason: bridge.reason,
    };
    for (const listener of this.listeners) {
      listener();
    }
  }
}
