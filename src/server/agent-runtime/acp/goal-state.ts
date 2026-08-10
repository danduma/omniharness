import {
  GOAL_PLAN_ITEM_MAX_LENGTH,
  GOAL_PLAN_MARKDOWN_MAX_LENGTH,
  GOAL_PLAN_MAX_ITEMS,
  GOAL_PLAN_URI_MAX_LENGTH,
  createDeterministicGoalPlanItemId,
  normalizeGoalCapabilities,
  validateGoalObjective,
  type GoalCapabilities,
  type GoalPlanItem,
  type GoalPlanItemStatus,
  type GoalPlanSource,
  type GoalStatus,
} from "@/shared/goal-plan";

export const MAX_ACP_GOAL_PAYLOAD_BYTES = 128 * 1024;
export const MAX_ACP_GOAL_NESTING_DEPTH = 8;
export const MAX_ACP_GOAL_COLLECTION_SIZE = 256;

export type AcpGoalRejectionReason =
  | "malformed"
  | "unsupported_version"
  | "too_large"
  | "too_deep"
  | "collection_too_large"
  | "invalid_status"
  | "invalid_objective"
  | "too_many_items"
  | "empty_content"
  | "item_too_long"
  | "invalid_item_status"
  | "unsafe_uri";

export type AcpGoalMetadataResult =
  | {
      ok: true;
      value: {
        schemaVersion: 1;
        providerGoalId: string | null;
        objective: string | null;
        status: GoalStatus | null;
        capabilities: GoalCapabilities;
      };
    }
  | { ok: false; reason: AcpGoalRejectionReason };

export type AcpGoalPlanResult =
  | {
      ok: true;
      value: {
        providerPlanId: string | null;
        plan: GoalPlanItem[];
        planSource: GoalPlanSource;
        removed: boolean;
      };
    }
  | { ok: false; reason: AcpGoalRejectionReason; itemIndex?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inspectEnvelope(value: unknown): AcpGoalRejectionReason | null {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return "malformed";
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_ACP_GOAL_PAYLOAD_BYTES) return "too_large";

  const seen = new WeakSet<object>();
  const inspect = (candidate: unknown, depth: number): AcpGoalRejectionReason | null => {
    if (!candidate || typeof candidate !== "object") return null;
    if (depth > MAX_ACP_GOAL_NESTING_DEPTH) return "too_deep";
    if (seen.has(candidate)) return "malformed";
    seen.add(candidate);
    const values = Array.isArray(candidate)
      ? candidate
      : Object.values(candidate as Record<string, unknown>);
    if (values.length > MAX_ACP_GOAL_COLLECTION_SIZE) return "collection_too_large";
    for (const nested of values) {
      const failure = inspect(nested, depth + 1);
      if (failure) return failure;
    }
    return null;
  };
  return inspect(value, 0);
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeProviderStatus(value: unknown): GoalStatus | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return "invalid";
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  const statuses: Record<string, GoalStatus> = {
    absent: "absent",
    pending: "pending",
    queued: "pending",
    pursuing: "pursuing",
    in_progress: "pursuing",
    running: "pursuing",
    working: "pursuing",
    paused: "paused",
    waiting: "waiting_user",
    waiting_user: "waiting_user",
    awaiting_user: "waiting_user",
    blocked: "blocked",
    limited: "limited",
    validating: "validating",
    completed: "completed",
    complete: "completed",
    done: "completed",
    succeeded: "completed",
    cleared: "cleared",
    error: "error",
    failed: "error",
  };
  return statuses[normalized] ?? "invalid";
}

function capabilityInput(value: Record<string, unknown>) {
  const capabilities = isRecord(value.capabilities) ? value.capabilities : {};
  const actions = Array.isArray(value.actions)
    ? new Set(value.actions.filter((action): action is string => typeof action === "string"))
    : null;
  return normalizeGoalCapabilities({
    set: capabilities.set === true || actions?.has("set") === true,
    edit: capabilities.edit === true || actions?.has("edit") === true,
    pause: capabilities.pause === true || actions?.has("pause") === true,
    resume: capabilities.resume === true || actions?.has("resume") === true,
    clear: capabilities.clear === true || actions?.has("clear") === true,
    fallbackMethod: capabilities.fallbackMethod,
  });
}

export function normalizeAcpGoalMetadata(value: unknown): AcpGoalMetadataResult {
  const envelopeFailure = inspectEnvelope(value);
  if (envelopeFailure) return { ok: false, reason: envelopeFailure };
  if (!isRecord(value) || !isRecord(value._meta) || !isRecord(value._meta.goal)) {
    return { ok: false, reason: "malformed" };
  }
  const goal = value._meta.goal;
  const version = goal.version ?? 1;
  if (version !== 1) return { ok: false, reason: "unsupported_version" };
  const status = normalizeProviderStatus(goal.status);
  if (status === "invalid") return { ok: false, reason: "invalid_status" };
  const rawObjective = goal.objective;
  let objective: string | null = null;
  if (rawObjective !== undefined && rawObjective !== null) {
    const validated = validateGoalObjective(rawObjective);
    if (!validated.ok) return { ok: false, reason: "invalid_objective" };
    objective = validated.objective;
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      providerGoalId: cleanString(goal.goalId),
      objective,
      status,
      capabilities: capabilityInput(goal),
    },
  };
}

function normalizePlanItemStatus(value: unknown): GoalPlanItemStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "pending" || normalized === "todo") return "pending";
  if (normalized === "in_progress" || normalized === "active" || normalized === "running") return "in_progress";
  if (normalized === "blocked") return "blocked";
  if (normalized === "completed" || normalized === "done") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  return null;
}

function normalizePlanItems(
  entries: unknown,
  context: { goalId: string; revision: number },
): AcpGoalPlanResult {
  if (!Array.isArray(entries)) return { ok: false, reason: "malformed" };
  if (entries.length > GOAL_PLAN_MAX_ITEMS) return { ok: false, reason: "too_many_items" };
  const plan: GoalPlanItem[] = [];
  for (const [order, candidate] of entries.entries()) {
    if (!isRecord(candidate)) return { ok: false, reason: "malformed", itemIndex: order };
    const title = cleanString(candidate.content ?? candidate.title);
    if (!title) return { ok: false, reason: "empty_content", itemIndex: order };
    if (Array.from(title).length > GOAL_PLAN_ITEM_MAX_LENGTH) {
      return { ok: false, reason: "item_too_long", itemIndex: order };
    }
    const status = normalizePlanItemStatus(candidate.status);
    if (!status) return { ok: false, reason: "invalid_item_status", itemIndex: order };
    const metadata = isRecord(candidate._meta) ? candidate._meta : {};
    const providerId = cleanString(candidate.id) ?? cleanString(metadata.id) ?? cleanString(metadata.goalItemId);
    const phase = cleanString(candidate.phase) ?? cleanString(metadata.phase);
    plan.push({
      id: providerId ?? createDeterministicGoalPlanItemId({
        goalId: context.goalId,
        revision: context.revision,
        title,
        phase,
      }),
      title,
      phase,
      status,
      order,
      providerId,
    });
  }
  return {
    ok: true,
    value: { providerPlanId: null, plan, planSource: { kind: "items" }, removed: false },
  };
}

function safePlanUri(value: unknown) {
  const uri = cleanString(value);
  if (!uri || uri.length > GOAL_PLAN_URI_MAX_LENGTH) return null;
  try {
    const parsed = new URL(uri);
    return ["file:", "https:", "http:"].includes(parsed.protocol) ? uri : null;
  } catch {
    return null;
  }
}

export function normalizeAcpGoalPlanUpdate(
  value: unknown,
  context: { goalId: string; revision: number },
): AcpGoalPlanResult {
  const envelopeFailure = inspectEnvelope(value);
  if (envelopeFailure) return { ok: false, reason: envelopeFailure };
  if (!isRecord(value) || typeof value.sessionUpdate !== "string") return { ok: false, reason: "malformed" };

  if (value.sessionUpdate === "plan") {
    return normalizePlanItems(value.entries, context);
  }
  if (value.sessionUpdate === "plan_removed") {
    const providerPlanId = cleanString(value.id);
    if (!providerPlanId) return { ok: false, reason: "malformed" };
    return { ok: true, value: { providerPlanId, plan: [], planSource: { kind: "none" }, removed: true } };
  }
  if (value.sessionUpdate !== "plan_update" || !isRecord(value.plan)) {
    return { ok: false, reason: "malformed" };
  }
  const providerPlanId = cleanString(value.plan.id);
  if (!providerPlanId) return { ok: false, reason: "malformed" };
  if (value.plan.type === "items") {
    const normalized = normalizePlanItems(value.plan.entries, context);
    return normalized.ok
      ? { ok: true, value: { ...normalized.value, providerPlanId } }
      : normalized;
  }
  if (value.plan.type === "markdown") {
    if (typeof value.plan.content !== "string" || value.plan.content.length > GOAL_PLAN_MARKDOWN_MAX_LENGTH) {
      return { ok: false, reason: "too_large" };
    }
    return {
      ok: true,
      value: { providerPlanId, plan: [], planSource: { kind: "markdown", markdown: value.plan.content }, removed: false },
    };
  }
  if (value.plan.type === "file") {
    const uri = safePlanUri(value.plan.uri);
    if (!uri) return { ok: false, reason: "unsafe_uri" };
    return { ok: true, value: { providerPlanId, plan: [], planSource: { kind: "uri", uri }, removed: false } };
  }
  return { ok: false, reason: "malformed" };
}

export function normalizeGoalFallbackCapabilities(availableCommands: readonly string[]) {
  const commands = new Set(availableCommands.map((command) => command.trim().replace(/^\//, "").toLowerCase()));
  const hasGoal = commands.has("goal");
  return normalizeGoalCapabilities({
    set: hasGoal,
    edit: hasGoal,
    clear: hasGoal,
    pause: commands.has("goal pause") || commands.has("pause-goal"),
    resume: commands.has("goal resume") || commands.has("resume-goal"),
    fallbackMethod: hasGoal ? "/goal" : null,
  });
}
