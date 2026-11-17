// Shared worker-activity vocabulary. The server derives the stream-driven
// subset (`StreamAgentActivity`) at the worker-stream append boundary and
// publishes it as `worker.activity`; the interface combines that with
// persisted worker status to render the office view and status strip.

export const AGENT_ACTIVITIES = [
  "waiting_user",
  "blocked",
  "quota_blocked",
  "errored",
  "recovering",
  "starting",
  "researching",
  "writing",
  "testing",
  "executing",
  "working",
  "idle",
  "done",
  "cancelled",
] as const;

export type AgentActivity = (typeof AGENT_ACTIVITIES)[number];

export type ToolActivity = Extract<AgentActivity, "researching" | "writing" | "testing" | "executing">;

/** Activities the server can observe from worker-stream entries alone. */
export type StreamAgentActivity = ToolActivity | "working" | "waiting_user";

export type AgentActivitySource = "tool_kind" | "command_pattern" | "interaction" | "turn" | "decision_model";

/** Named events that open or close office relationships (delegation, handoff, review). */
export const OFFICE_RELATION_EVENT_TYPES = [
  "supervisor.delegated",
  "worker.failover_completed",
  "worker.review_started",
  "worker.review_finished",
] as const;

/** Supervisor events that drive the main desk in the office view. */
export const SUPERVISOR_ACTIVITY_EVENT_TYPES = [
  "supervisor.wake_lease_acquired",
  "supervisor.wake_lease_released",
  "supervisor.wake_scheduled",
  "supervisor.stopped",
] as const;

export type ToolCallLike = { kind?: string | null; title?: string | null } | null | undefined;

const RESEARCH_TOOL_KINDS = new Set(["read", "search", "fetch"]);
const WRITE_TOOL_KINDS = new Set(["edit", "delete", "move"]);
const TEST_COMMAND_PATTERN = /\b(vitest|jest|pytest|playwright test|go test|cargo test|mocha|phpunit|rspec|(?:pnpm|npm|yarn|bun)(?: run)? test(?::[\w-]+)?)\b/i;

export function classifyToolActivity(toolCall: ToolCallLike): ToolActivity | null {
  return classifyToolActivityWithSource(toolCall)?.activity ?? null;
}

export function classifyToolActivityWithSource(
  toolCall: ToolCallLike,
): { activity: ToolActivity; source: AgentActivitySource } | null {
  if (!toolCall) return null;
  const kind = (toolCall.kind ?? "").trim().toLowerCase();
  if (RESEARCH_TOOL_KINDS.has(kind)) return { activity: "researching", source: "tool_kind" };
  if (WRITE_TOOL_KINDS.has(kind)) return { activity: "writing", source: "tool_kind" };
  if (kind === "execute") {
    return TEST_COMMAND_PATTERN.test(toolCall.title ?? "")
      ? { activity: "testing", source: "command_pattern" }
      : { activity: "executing", source: "tool_kind" };
  }
  return null;
}
