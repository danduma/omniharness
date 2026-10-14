import type { AgentRecord } from "../types";

/**
 * How long past an armed wake's due time the agent stays protected from the
 * idle reaper. The wake starts a turn inside the agent, and only that turn's
 * first output reaches the runtime; until then the agent still reads as idle.
 */
export const ARMED_WAKE_GRACE_MS = 2 * 60_000;

/** Stored for a persistent Monitor, which can fire until the session ends. */
export const PERSISTENT_WAKE_AT = Number.MAX_SAFE_INTEGER;

type ArmedWakeRecord = Pick<AgentRecord, "armedWakeAt">;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * When the agent will next wake itself, from a completed Claude Code `Monitor`
 * or `ScheduleWakeup` tool call.
 */
export function readArmedWakeDeadline(update: unknown, now: number): number | null {
  const record = asRecord(update);
  if (!record || record.sessionUpdate !== "tool_call_update") return null;
  const claudeCode = asRecord(asRecord(record._meta)?.claudeCode);
  const response = asRecord(claudeCode?.toolResponse);
  if (!response) return null;
  if (claudeCode?.toolName === "Monitor") {
    if (response.persistent === true) return PERSISTENT_WAKE_AT;
    const timeoutMs = positiveNumber(response.timeoutMs);
    return timeoutMs === null ? null : now + timeoutMs;
  }
  if (claudeCode?.toolName === "ScheduleWakeup") {
    return positiveNumber(response.scheduledFor);
  }
  return null;
}

function isTurnOutput(update: unknown) {
  const kind = asRecord(update)?.sessionUpdate;
  return kind === "agent_message_chunk" || kind === "agent_thought_chunk" || kind === "tool_call";
}

/**
 * Track the wake an agent armed for itself. Such an agent ends its turn and
 * waits for the wake to start the next one, so it must not be reaped before
 * then, and if its process dies first something else has to start that turn.
 *
 * Arming keeps the latest due time. Turn output at or after the due time means
 * the wake ran, so it is consumed. The first output of a process that never saw
 * an arming (a fresh or resumed session) consumes whatever an earlier process
 * armed: that process, and its monitors, are gone.
 */
export function trackArmedWake(record: ArmedWakeRecord, update: unknown, now = Date.now()) {
  if (isTurnOutput(update)) {
    if (record.armedWakeAt === undefined || (record.armedWakeAt !== null && now >= record.armedWakeAt)) {
      record.armedWakeAt = null;
    }
    return;
  }
  const deadline = readArmedWakeDeadline(update, now);
  if (deadline !== null && (record.armedWakeAt ?? 0) < deadline) record.armedWakeAt = deadline;
}

export function hasArmedWake(record: ArmedWakeRecord, now: number) {
  return typeof record.armedWakeAt === "number" && now < record.armedWakeAt + ARMED_WAKE_GRACE_MS;
}
