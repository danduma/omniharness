import { StateManager } from "@/lib/state-manager";

/** The main conversation desk, used as the source of supervisor delegations. */
export const MAIN_DESK_ID = "__main__";

export type OfficeRelationKind = "delegated" | "handoff" | "review";

export type OfficeRelation = {
  kind: OfficeRelationKind;
  fromId: string;
  toId: string;
};

type RelationEvent = { kind?: unknown } & Record<string, unknown>;

function relationKey(relation: OfficeRelation) {
  return `${relation.kind}\u0000${relation.fromId}\u0000${relation.toId}`;
}

function str(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

/**
 * Short-lived relationships between desks: a delegation from the main
 * conversation, a failover handoff between workers, or a review. Each one is
 * opened and closed by named events only (no timers), so its lifetime is a
 * server decision rather than a client guess:
 *
 * - `supervisor.delegated` opens delegated(main → worker); the target's next
 *   tool or interaction `worker.activity` closes it (the worker picked the
 *   task up; the prompt delivery itself does not count).
 * - `worker.failover_completed` opens handoff(outgoing → new); the new
 *   worker's next tool or interaction `worker.activity` closes it.
 * - `worker.review_started` opens review(reviewer → subject);
 *   `worker.review_finished` closes it.
 *
 * Relations are presentation state, not history. A stream resync drops them
 * because the events that would close them may have been missed.
 */
export class OfficeRelationsManager extends StateManager<Readonly<Record<string, OfficeRelation>>> {
  constructor() {
    super({});
  }

  onNamedEvent(event: unknown) {
    if (!event || typeof event !== "object") return;
    const data = event as RelationEvent;
    switch (data.kind) {
      case "supervisor.delegated": {
        const toId = str(data.toWorkerId);
        if (toId) this.open({ kind: "delegated", fromId: MAIN_DESK_ID, toId });
        return;
      }
      case "worker.failover_completed": {
        const fromId = str(data.outgoingWorkerId);
        const toId = str(data.newWorkerId);
        if (fromId && toId) this.open({ kind: "handoff", fromId, toId });
        return;
      }
      case "worker.review_started": {
        const fromId = str(data.reviewerWorkerId);
        const toId = str(data.subjectWorkerId);
        if (fromId && toId) this.open({ kind: "review", fromId, toId });
        return;
      }
      case "worker.review_finished": {
        const fromId = str(data.reviewerWorkerId);
        if (fromId) this.closeWhere((relation) => relation.kind === "review" && relation.fromId === fromId);
        return;
      }
      case "worker.activity": {
        const workerId = str(data.workerId);
        // A "turn" activity is the delivery of the prompt itself; only a tool
        // call or interaction proves the worker has picked the work up.
        if (workerId && data.source !== "turn") {
          this.closeWhere((relation) => relation.kind !== "review" && relation.toId === workerId);
        }
        return;
      }
      default:
    }
  }

  reset() {
    this.update((current) => (Object.keys(current).length === 0 ? current : {}));
  }

  /** Relations touching any of the given desks, for rendering badges. */
  relationsFor(deskId: string): OfficeRelation[] {
    return Object.values(this.getSnapshot()).filter((relation) => relation.fromId === deskId || relation.toId === deskId);
  }

  private open(relation: OfficeRelation) {
    const key = relationKey(relation);
    this.update((current) => (current[key] ? current : { ...current, [key]: relation }));
  }

  private closeWhere(predicate: (relation: OfficeRelation) => boolean) {
    this.update((current) => {
      const entries = Object.entries(current);
      const kept = entries.filter(([, relation]) => !predicate(relation));
      return kept.length === entries.length ? current : Object.fromEntries(kept);
    });
  }
}

export const officeRelationsManager = new OfficeRelationsManager();
