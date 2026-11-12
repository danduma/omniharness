import { StateManager } from "@/lib/state-manager";
import type { AgentActivitySource, StreamAgentActivity } from "@/shared/agent-activity";

export type WorkerStreamActivity = {
  activity: StreamAgentActivity;
  source: AgentActivitySource;
  /** Worker-stream seq of the entry that caused the transition; orders replayed frames. */
  entrySeq: number;
};

const STREAM_ACTIVITIES: ReadonlySet<string> = new Set([
  "researching",
  "writing",
  "testing",
  "executing",
  "working",
  "waiting_user",
]);

/**
 * Latest server-derived `worker.activity` per worker. Single source of truth
 * for the stream half of the office/status-strip activity; persisted worker
 * status still comes from the snapshot and wins for terminal or blocked states.
 */
export class WorkerActivityManager extends StateManager<Readonly<Record<string, WorkerStreamActivity>>> {
  constructor() {
    super({});
  }

  onActivityEvent(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const data = payload as { workerId?: unknown; activity?: unknown; source?: unknown; entrySeq?: unknown };
    if (typeof data.workerId !== "string" || !data.workerId) return;
    if (typeof data.activity !== "string" || !STREAM_ACTIVITIES.has(data.activity)) return;
    if (typeof data.entrySeq !== "number" || !Number.isFinite(data.entrySeq)) return;
    const workerId = data.workerId;
    const next: WorkerStreamActivity = {
      activity: data.activity as StreamAgentActivity,
      source: (typeof data.source === "string" ? data.source : "turn") as AgentActivitySource,
      entrySeq: data.entrySeq,
    };
    this.update((current) => {
      const existing = current[workerId];
      // Replay after reconnect can deliver frames we already applied; never
      // let an older transition overwrite a newer one.
      if (existing && existing.entrySeq > next.entrySeq) return current;
      if (existing && existing.entrySeq === next.entrySeq && existing.activity === next.activity) return current;
      return { ...current, [workerId]: next };
    });
  }

  get(workerId: string): WorkerStreamActivity | null {
    return this.getSnapshot()[workerId] ?? null;
  }
}

export const workerActivityManager = new WorkerActivityManager();
