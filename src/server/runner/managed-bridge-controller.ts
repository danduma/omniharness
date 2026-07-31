import { emitNamedEvent } from "@/server/events/named-events";

export type BridgeProbeResult =
  | { status: "ready" }
  | { status: "unavailable" | "unhealthy"; reason: string };

export type BridgeOwnership = "none" | "adopted" | "owned";
export type ManagedBridgeStatus =
  | "idle"
  | "probing"
  | "starting"
  | "ready"
  | "unavailable"
  | "stopped";

export interface ManagedBridgeSnapshot {
  status: ManagedBridgeStatus;
  ownership: BridgeOwnership;
  bridgeUrl: string;
  reason: string | null;
  attempt: number;
}

export interface BridgeChild {
  pid: number | null;
  stop(): Promise<void>;
  onExit(
    listener: (exit: { code: number | null; signal: string | null }) => void,
  ): () => void;
}

export interface BridgeSchedule {
  cancel(): void;
}

export interface ManagedBridgeDependencies {
  probe(): Promise<BridgeProbeResult>;
  acquireLock():
    | { status: "acquired" }
    | { status: "locked"; ownerPid: number | null };
  releaseLock(): void;
  spawn(): Promise<BridgeChild>;
  schedule(delayMs: number, callback: () => void): BridgeSchedule;
}

export interface ManagedBridgeControllerOptions {
  bridgeUrl: string;
  manage: boolean;
  dependencies: ManagedBridgeDependencies;
}

type Listener = () => void;

export class ManagedBridgeController {
  private snapshot: ManagedBridgeSnapshot;
  private readonly listeners = new Set<Listener>();
  private child: BridgeChild | null = null;
  private removeChildExitListener: (() => void) | null = null;
  private retrySchedule: BridgeSchedule | null = null;
  private ownsLock = false;
  private stopped = false;

  constructor(private readonly options: ManagedBridgeControllerOptions) {
    this.snapshot = {
      status: "idle",
      ownership: "none",
      bridgeUrl: options.bridgeUrl,
      reason: null,
      attempt: 0,
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<ManagedBridgeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }

  async start() {
    if (this.stopped || this.snapshot.status !== "idle") {
      return this.snapshot;
    }
    await this.tryConnect();
    return this.snapshot;
  }

  private async tryConnect() {
    if (this.stopped) {
      return;
    }
    this.retrySchedule?.cancel();
    this.retrySchedule = null;
    this.update({
      status: "probing",
      reason: null,
      attempt: this.snapshot.attempt + 1,
    });

    const probe = await this.options.dependencies.probe();
    if (probe.status === "ready") {
      const ownership = this.child ? "owned" : "adopted";
      this.update({ status: "ready", ownership, reason: null });
      emitNamedEvent({
        kind: "runner.bridge_ready",
        bridgeUrl: this.options.bridgeUrl,
        ownership,
      });
      return;
    }

    if (!this.options.manage || probe.status === "unhealthy") {
      this.markUnavailable(probe.reason, this.options.manage ? 250 : null);
      return;
    }
    if (this.child) {
      this.markUnavailable(probe.reason, 250);
      return;
    }

    const lock = this.options.dependencies.acquireLock();
    if (lock.status === "locked") {
      this.update({
        status: "starting",
        ownership: "none",
        reason: "Another runner is starting the bridge.",
      });
      emitNamedEvent({
        kind: "runner.bridge_lock_contended",
        bridgeUrl: this.options.bridgeUrl,
        ownerPid: lock.ownerPid,
      });
      this.scheduleRetry();
      return;
    }

    this.ownsLock = true;
    this.update({ status: "starting", ownership: "owned", reason: null });
    emitNamedEvent({
      kind: "runner.bridge_starting",
      bridgeUrl: this.options.bridgeUrl,
      attempt: this.snapshot.attempt,
    });

    try {
      this.child = await this.options.dependencies.spawn();
      this.removeChildExitListener = this.child.onExit((exit) => {
        this.handleChildExit(exit);
      });
      const startedProbe = await this.options.dependencies.probe();
      if (startedProbe.status === "ready") {
        this.update({ status: "ready", ownership: "owned", reason: null });
        emitNamedEvent({
          kind: "runner.bridge_ready",
          bridgeUrl: this.options.bridgeUrl,
          ownership: "owned",
        });
        return;
      }
      this.markUnavailable(
        startedProbe.status === "unhealthy"
          ? startedProbe.reason
          : startedProbe.reason,
        250,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.markUnavailable(reason, 250);
      emitNamedEvent({
        kind: "error.surfaced",
        code: "runner.bridge_start_failed",
        message: reason,
        surface: "log",
        cause: error instanceof Error
          ? { name: error.name, message: error.message }
          : null,
      });
    }
  }

  private markUnavailable(reason: string, retryInMs: number | null) {
    this.update({ status: "unavailable", reason });
    emitNamedEvent({
      kind: "runner.bridge_unavailable",
      bridgeUrl: this.options.bridgeUrl,
      reason,
      retryInMs,
    });
    if (retryInMs !== null) {
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.stopped || this.retrySchedule) {
      return;
    }
    const delayMs = Math.min(
      30_000,
      250 * (2 ** Math.max(0, this.snapshot.attempt - 1)),
    );
    this.retrySchedule = this.options.dependencies.schedule(delayMs, () => {
      this.retrySchedule = null;
      void this.tryConnect();
    });
  }

  private handleChildExit(exit: { code: number | null; signal: string | null }) {
    if (this.stopped) {
      return;
    }
    this.child = null;
    this.removeChildExitListener?.();
    this.removeChildExitListener = null;
    if (this.ownsLock) {
      this.options.dependencies.releaseLock();
      this.ownsLock = false;
    }
    emitNamedEvent({
      kind: "runner.bridge_child_exited",
      bridgeUrl: this.options.bridgeUrl,
      code: exit.code,
      signal: exit.signal,
    });
    this.markUnavailable(
      exit.signal
        ? `Bridge exited with signal ${exit.signal}.`
        : `Bridge exited with code ${exit.code ?? "unknown"}.`,
      250,
    );
  }

  async stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.retrySchedule?.cancel();
    this.retrySchedule = null;
    this.removeChildExitListener?.();
    this.removeChildExitListener = null;
    if (this.snapshot.ownership === "owned") {
      await this.child?.stop();
    }
    this.child = null;
    if (this.ownsLock) {
      this.options.dependencies.releaseLock();
      this.ownsLock = false;
    }
    this.update({
      status: "stopped",
      ownership: "none",
      reason: null,
    });
  }
}
