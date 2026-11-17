import { StateManager } from "@/lib/state-manager";

export type SupervisorActivity = "idle" | "thinking" | "scheduled" | "stopped";

type RunSupervisorState = {
  /** A supervisor turn holds the wake lease. */
  thinking: boolean;
  /** A later wake is scheduled (wait_until, a deferred wake), so it will check back. */
  scheduled: boolean;
  stopped: boolean;
};

const IDLE: RunSupervisorState = { thinking: false, scheduled: false, stopped: false };

/**
 * What the supervisor of each run is doing, from its named events:
 *  - `supervisor.wake_lease_acquired` → a turn is running (thinking);
 *  - `supervisor.wake_lease_released` → the turn ended;
 *  - `supervisor.wake_scheduled` with a delay → it will check back later;
 *  - `supervisor.stopped` → it stopped for this run.
 * Direct conversations have no supervisor, so they never leave "idle".
 * State is not part of the snapshot: after a page load or resync it starts at
 * "idle" and corrects itself on the next supervisor event.
 */
export class SupervisorActivityManager extends StateManager<Readonly<Record<string, RunSupervisorState>>> {
  constructor() {
    super({});
  }

  onSupervisorEvent(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const event = payload as { kind?: unknown; runId?: unknown; delayMs?: unknown; source?: unknown };
    if (typeof event.runId !== "string" || !event.runId) return;
    const runId = event.runId;
    switch (event.kind) {
      case "supervisor.wake_lease_acquired":
        // The scheduled wake (if any) is the one now running.
        this.set(runId, { thinking: true, scheduled: false, stopped: false });
        return;
      case "supervisor.wake_lease_released":
        this.set(runId, { ...this.get(runId), thinking: false });
        return;
      case "supervisor.wake_scheduled":
        // Immediate wakes and short lease retries are not "checking back later".
        if (typeof event.delayMs === "number" && event.delayMs > 0 && event.source !== "lease_retry") {
          this.set(runId, { ...this.get(runId), scheduled: true, stopped: false });
        }
        return;
      case "supervisor.stopped":
        this.set(runId, { thinking: false, scheduled: false, stopped: true });
        return;
      default:
    }
  }

  reset() {
    this.update((current) => (Object.keys(current).length === 0 ? current : {}));
  }

  activityFor(runId: string | null | undefined): SupervisorActivity {
    const state = runId ? this.getSnapshot()[runId] : undefined;
    return supervisorActivityOf(state);
  }

  private get(runId: string): RunSupervisorState {
    return this.getSnapshot()[runId] ?? IDLE;
  }

  private set(runId: string, next: RunSupervisorState) {
    this.update((current) => {
      const existing = current[runId] ?? IDLE;
      if (existing.thinking === next.thinking && existing.scheduled === next.scheduled && existing.stopped === next.stopped) {
        return current;
      }
      return { ...current, [runId]: next };
    });
  }
}

export function supervisorActivityOf(state: RunSupervisorState | undefined): SupervisorActivity {
  if (!state) return "idle";
  if (state.stopped) return "stopped";
  if (state.thinking) return "thinking";
  if (state.scheduled) return "scheduled";
  return "idle";
}

export const supervisorActivityManager = new SupervisorActivityManager();
