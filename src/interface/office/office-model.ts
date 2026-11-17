// Pure layout decisions for the office view. No React imports.

import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import { isAttentionActivity, type AgentActivity } from "./deriveAgentActivity";
import { MAIN_DESK_ID, type OfficeRelation, type OfficeRelationKind } from "./OfficeRelationsManager";

/** At most this many avatars animate at once; the rest hold a static pose. */
export const OFFICE_MAX_ANIMATED = 8;
/** Above this many workers, resting workers move to the break room counter. */
export const OFFICE_COLLAPSE_THRESHOLD = 20;
/** Above this many workers, the office falls back to the compact status strip. */
export const OFFICE_MAX_WORKERS = 50;
/** Up to this many desks share one room; above it, desks group into rooms by role. */
export const OFFICE_SINGLE_ROOM_MAX = 5;

export const OFFICE_ROOMS = ["main", "implementation", "validation", "review"] as const;
export type OfficeRoom = (typeof OFFICE_ROOMS)[number];

export function roomForWorker(worker: Pick<ConversationWorkerRecord, "workerRole">): OfficeRoom {
  switch ((worker.workerRole ?? "").trim().toLowerCase()) {
    case "implementation":
      return "implementation";
    case "validation":
      return "validation";
    case "plan_review":
    case "review":
      return "review";
    default:
      return "main";
  }
}

const RESTING_ACTIVITIES: ReadonlySet<AgentActivity> = new Set(["idle", "done", "cancelled"]);

export type OfficeSeatInput = {
  worker: ConversationWorkerRecord;
  activity: AgentActivity;
};

export type OfficeSeat = OfficeSeatInput & {
  /** Human-facing number: the persisted worker number, else 1-based position. */
  displayNumber: number;
  attention: boolean;
  animate: boolean;
};

export type OfficeRoomGroup = { room: OfficeRoom; seats: OfficeSeat[] };

export type OfficeLayout =
  | {
      kind: "office";
      seats: OfficeSeat[];
      /** One group (no headings) up to OFFICE_SINGLE_ROOM_MAX desks or when every desk shares a role. */
      rooms: OfficeRoomGroup[];
      breakRoom: OfficeSeat[];
    }
  | { kind: "strip" };

function groupIntoRooms(seats: OfficeSeat[]): OfficeRoomGroup[] {
  const grouped = new Map<OfficeRoom, OfficeSeat[]>();
  for (const seat of seats) {
    const room = roomForWorker(seat.worker);
    grouped.set(room, [...(grouped.get(room) ?? []), seat]);
  }
  if (seats.length <= OFFICE_SINGLE_ROOM_MAX || grouped.size <= 1) {
    return [{ room: grouped.size === 1 ? [...grouped.keys()][0]! : "main", seats }];
  }
  return OFFICE_ROOMS
    .filter((room) => grouped.has(room))
    .map((room) => ({ room, seats: grouped.get(room)! }));
}

export function isRestingActivity(activity: AgentActivity) {
  return RESTING_ACTIVITIES.has(activity);
}

export function buildOfficeLayout(inputs: ReadonlyArray<OfficeSeatInput>): OfficeLayout {
  if (inputs.length > OFFICE_MAX_WORKERS) {
    return { kind: "strip" };
  }

  // Desk order is the worker order and never changes with activity, so
  // avatars do not jump between desks while the user is looking.
  const seats: OfficeSeat[] = inputs.map((input, index) => ({
    ...input,
    displayNumber: typeof input.worker.workerNumber === "number" ? input.worker.workerNumber : index + 1,
    attention: isAttentionActivity(input.activity),
    animate: false,
  }));

  // Animation budget: attention first, then other non-resting workers, in desk order.
  const candidates = [
    ...seats.filter((seat) => seat.attention),
    ...seats.filter((seat) => !seat.attention && !isRestingActivity(seat.activity)),
  ];
  for (const seat of candidates.slice(0, OFFICE_MAX_ANIMATED)) {
    seat.animate = true;
  }

  if (seats.length <= OFFICE_COLLAPSE_THRESHOLD) {
    return { kind: "office", seats, rooms: groupIntoRooms(seats), breakRoom: [] };
  }
  const deskSeats = seats.filter((seat) => !isRestingActivity(seat.activity));
  return {
    kind: "office",
    seats: deskSeats,
    rooms: groupIntoRooms(deskSeats),
    breakRoom: seats.filter((seat) => isRestingActivity(seat.activity)),
  };
}

export type DeskRelationBadge = {
  kind: OfficeRelationKind;
  /** "out": this desk acts on the counterpart (delegates, hands off, reviews); "in": the reverse. */
  direction: "in" | "out";
  /** Counterpart desk number, or null for the main conversation desk. */
  counterpartNumber: number | null;
};

/**
 * Relationship badges for one desk. A relation whose counterpart is not on
 * screen (finished, collapsed, or never loaded) is dropped rather than shown
 * pointing at nothing.
 */
export function describeDeskRelations(
  deskId: string,
  relations: ReadonlyArray<OfficeRelation>,
  deskNumbers: ReadonlyMap<string, number>,
): DeskRelationBadge[] {
  const badges: DeskRelationBadge[] = [];
  for (const relation of relations) {
    const direction = relation.fromId === deskId ? "out" : relation.toId === deskId ? "in" : null;
    if (!direction) continue;
    const counterpartId = direction === "out" ? relation.toId : relation.fromId;
    if (counterpartId === MAIN_DESK_ID) {
      badges.push({ kind: relation.kind, direction, counterpartNumber: null });
      continue;
    }
    const counterpartNumber = deskNumbers.get(counterpartId);
    if (counterpartNumber === undefined) continue;
    badges.push({ kind: relation.kind, direction, counterpartNumber });
  }
  return badges;
}
