export const GOAL_SCHEMA_VERSION = 1 as const;
export const GOAL_OBJECTIVE_MAX_LENGTH = 4_000;
export const GOAL_PLAN_MAX_ITEMS = 200;
export const GOAL_PLAN_ITEM_MAX_LENGTH = 2_000;
export const GOAL_PLAN_MARKDOWN_MAX_LENGTH = 100_000;
export const GOAL_PLAN_URI_MAX_LENGTH = 2_048;

export const GOAL_STATUSES = [
  "absent",
  "pending",
  "pursuing",
  "paused",
  "waiting_user",
  "blocked",
  "limited",
  "validating",
  "completed",
  "cleared",
  "error",
] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_ACTIONS = ["pause", "resume", "clear", "retry"] as const;
export type GoalAction = (typeof GOAL_ACTIONS)[number];
export type GoalMutationAction = "set" | "edit" | GoalAction;
export type GoalMutationSource = "api" | "acp" | "reconciliation" | "recovery";

export const GOAL_PLAN_ITEM_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "failed",
] as const;
export type GoalPlanItemStatus = (typeof GOAL_PLAN_ITEM_STATUSES)[number];

export interface GoalPlanItem {
  id: string;
  title: string;
  phase: string | null;
  status: GoalPlanItemStatus;
  order: number;
  providerId: string | null;
}

export type GoalPlanSource =
  | { kind: "none" }
  | { kind: "items" }
  | { kind: "markdown"; markdown: string }
  | { kind: "uri"; uri: string };

export interface GoalCapabilities {
  set: boolean;
  edit: boolean;
  pause: boolean;
  resume: boolean;
  clear: boolean;
  fallbackMethod: string | null;
}

export interface GoalValidationState {
  status: "idle" | "validating" | "passed" | "failed";
  message: string | null;
  updatedAt: string;
}

export interface GoalSnapshotProvenance {
  source: "server" | "cache";
  complete: boolean;
  eventCursor: number | null;
}

export interface GoalSnapshot {
  schemaVersion: typeof GOAL_SCHEMA_VERSION;
  runId: string;
  goalId: string;
  revision: number;
  leaseGeneration: number;
  objective: string;
  status: GoalStatus;
  startedAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  completedAt: string | null;
  clearedAt: string | null;
  updatedAt: string;
  workerId: string | null;
  acpSessionId: string | null;
  plan: GoalPlanItem[];
  planSource: GoalPlanSource;
  capabilities: GoalCapabilities;
  lastError: string | null;
  validationState: GoalValidationState | null;
  visible: boolean;
  provenance: GoalSnapshotProvenance;
}

export interface GoalMutationInput {
  goalId: string;
  expectedRevision: number;
  operationId: string;
}

export interface PutGoalInput extends GoalMutationInput {
  objective: string;
}

export interface GoalActionInput extends GoalMutationInput {
  action: GoalAction;
}

export type GoalMutationResult =
  | { ok: true; snapshot: GoalSnapshot; replayed: boolean }
  | {
      ok: false;
      code: "not_found" | "revision_conflict" | "invalid_transition" | "unsupported_action" | "operation_conflict" | "stale_lease" | "invalid_objective" | "provider_error" | "persistence_error";
      message: string;
      snapshot: GoalSnapshot | null;
    };

const TRANSITIONS: Readonly<Record<GoalStatus, ReadonlySet<GoalStatus>>> = {
  absent: new Set(["pending"]),
  pending: new Set(["pursuing", "blocked", "limited", "error", "cleared"]),
  pursuing: new Set(["paused", "waiting_user", "blocked", "limited", "validating", "error", "cleared"]),
  paused: new Set(["pursuing", "blocked", "limited", "error", "cleared"]),
  waiting_user: new Set(["pursuing", "blocked", "limited", "error", "cleared"]),
  blocked: new Set(["pursuing", "limited", "error", "cleared"]),
  limited: new Set(["pursuing", "blocked", "error", "cleared"]),
  validating: new Set(["completed", "blocked", "error", "cleared"]),
  completed: new Set(["cleared"]),
  cleared: new Set(),
  error: new Set(["pursuing", "cleared"]),
};

export function canTransitionGoalStatus(previous: GoalStatus, next: GoalStatus) {
  return previous === next || TRANSITIONS[previous].has(next);
}

export function validateGoalObjective(input: unknown):
  | { ok: true; objective: string }
  | { ok: false; code: "empty" | "too_long" | "invalid_type"; maxLength: number } {
  if (typeof input !== "string") {
    return { ok: false, code: "invalid_type", maxLength: GOAL_OBJECTIVE_MAX_LENGTH };
  }
  const objective = input.trim();
  if (!objective) {
    return { ok: false, code: "empty", maxLength: GOAL_OBJECTIVE_MAX_LENGTH };
  }
  if (objective.length > GOAL_OBJECTIVE_MAX_LENGTH) {
    return { ok: false, code: "too_long", maxLength: GOAL_OBJECTIVE_MAX_LENGTH };
  }
  return { ok: true, objective };
}

export function normalizeGoalCapabilities(input: unknown): GoalCapabilities {
  const value = isRecord(input) ? input : {};
  return {
    set: value.set === true,
    edit: value.edit === true,
    pause: value.pause === true,
    resume: value.resume === true,
    clear: value.clear === true,
    fallbackMethod: typeof value.fallbackMethod === "string" && value.fallbackMethod.trim()
      ? value.fallbackMethod.trim()
      : null,
  };
}

export function createDeterministicGoalPlanItemId(input: {
  goalId: string;
  revision: number;
  title: string;
  phase?: string | null;
}) {
  const value = `${input.goalId}\u0000${input.revision}\u0000${input.phase ?? ""}\u0000${input.title}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `goal-item-${(hash >>> 0).toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

function nullableString(value: unknown, field: string) {
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError(`${field} must be a string or null`);
  return value;
}

function nonNegativeInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return Number(value);
}

function parsePlanSource(value: unknown): GoalPlanSource {
  if (!isRecord(value) || !["none", "items", "markdown", "uri"].includes(String(value.kind))) {
    throw new TypeError("planSource is invalid");
  }
  if (value.kind === "markdown") {
    if (typeof value.markdown !== "string" || value.markdown.length > GOAL_PLAN_MARKDOWN_MAX_LENGTH) {
      throw new TypeError("planSource markdown is invalid");
    }
    return { kind: "markdown", markdown: value.markdown };
  }
  if (value.kind === "uri") {
    if (typeof value.uri !== "string" || value.uri.length > GOAL_PLAN_URI_MAX_LENGTH) {
      throw new TypeError("planSource uri is invalid");
    }
    return { kind: "uri", uri: value.uri };
  }
  return { kind: value.kind as "none" | "items" };
}

function parsePlanItem(value: unknown): GoalPlanItem {
  if (!isRecord(value)) throw new TypeError("plan item must be an object");
  const status = String(value.status);
  if (!GOAL_PLAN_ITEM_STATUSES.includes(status as GoalPlanItemStatus)) throw new TypeError("plan item status is invalid");
  const title = requiredString(value.title, "plan item title");
  if (title.length > GOAL_PLAN_ITEM_MAX_LENGTH) throw new TypeError("plan item title is too long");
  return {
    id: requiredString(value.id, "plan item id"),
    title,
    phase: nullableString(value.phase, "plan item phase"),
    status: status as GoalPlanItemStatus,
    order: nonNegativeInteger(value.order, "plan item order"),
    providerId: nullableString(value.providerId, "plan item providerId"),
  };
}

export function parseGoalSnapshot(value: unknown): GoalSnapshot {
  if (!isRecord(value)) throw new TypeError("goal snapshot must be an object");
  if (value.schemaVersion !== GOAL_SCHEMA_VERSION) throw new TypeError("goal snapshot schemaVersion is unsupported");
  const status = String(value.status);
  if (!GOAL_STATUSES.includes(status as GoalStatus)) throw new TypeError("goal snapshot status is invalid");
  if (!Array.isArray(value.plan) || value.plan.length > GOAL_PLAN_MAX_ITEMS) throw new TypeError("goal snapshot plan is invalid");
  if (!isRecord(value.provenance) || !["server", "cache"].includes(String(value.provenance.source))) {
    throw new TypeError("goal snapshot provenance is invalid");
  }
  if (typeof value.visible !== "boolean" || typeof value.provenance.complete !== "boolean") {
    throw new TypeError("goal snapshot boolean fields are invalid");
  }
  const objective = validateGoalObjective(value.objective);
  if (!objective.ok) throw new TypeError(`goal snapshot objective is ${objective.code}`);

  return {
    schemaVersion: GOAL_SCHEMA_VERSION,
    runId: requiredString(value.runId, "runId"),
    goalId: requiredString(value.goalId, "goalId"),
    revision: nonNegativeInteger(value.revision, "revision"),
    leaseGeneration: nonNegativeInteger(value.leaseGeneration, "leaseGeneration"),
    objective: objective.objective,
    status: status as GoalStatus,
    startedAt: requiredString(value.startedAt, "startedAt"),
    pausedAt: nullableString(value.pausedAt, "pausedAt"),
    resumedAt: nullableString(value.resumedAt, "resumedAt"),
    completedAt: nullableString(value.completedAt, "completedAt"),
    clearedAt: nullableString(value.clearedAt, "clearedAt"),
    updatedAt: requiredString(value.updatedAt, "updatedAt"),
    workerId: nullableString(value.workerId, "workerId"),
    acpSessionId: nullableString(value.acpSessionId, "acpSessionId"),
    plan: value.plan.map(parsePlanItem),
    planSource: parsePlanSource(value.planSource),
    capabilities: normalizeGoalCapabilities(value.capabilities),
    lastError: nullableString(value.lastError, "lastError"),
    validationState: value.validationState as GoalValidationState | null,
    visible: value.visible,
    provenance: {
      source: value.provenance.source as "server" | "cache",
      complete: value.provenance.complete,
      eventCursor: value.provenance.eventCursor === null
        ? null
        : nonNegativeInteger(value.provenance.eventCursor, "eventCursor"),
    },
  };
}
