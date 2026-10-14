import { describe, expect, it } from "vitest";
import {
  ARMED_WAKE_GRACE_MS,
  PERSISTENT_WAKE_AT,
  hasArmedWake,
  readArmedWakeDeadline,
  trackArmedWake,
} from "@/server/agent-runtime/acp/armed-wakes";

const NOW = 1_791_947_000_000;

function toolResult(toolName: string, toolResponse: Record<string, unknown>) {
  return {
    _meta: { claudeCode: { toolName, toolResponse } },
    toolCallId: "toolu_1",
    sessionUpdate: "tool_call_update",
  };
}

const turnOutput = { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Checking" } };

describe("readArmedWakeDeadline", () => {
  it("reads a Monitor's expiry from its timeout", () => {
    const update = toolResult("Monitor", { taskId: "bxr1hghpz", timeoutMs: 1_800_000, persistent: false });
    expect(readArmedWakeDeadline(update, NOW)).toBe(NOW + 1_800_000);
  });

  it("treats a persistent Monitor as armed until the session ends", () => {
    const update = toolResult("Monitor", { taskId: "b1", timeoutMs: 1_800_000, persistent: true });
    expect(readArmedWakeDeadline(update, NOW)).toBe(PERSISTENT_WAKE_AT);
  });

  it("reads a ScheduleWakeup's scheduled time", () => {
    const update = toolResult("ScheduleWakeup", { scheduledFor: 1_791_940_560_000, clampedDelaySeconds: 1800, wasClamped: false });
    expect(readArmedWakeDeadline(update, NOW)).toBe(1_791_940_560_000);
  });

  it("ignores other tools, pending calls and other updates", () => {
    expect(readArmedWakeDeadline(toolResult("Bash", { stdout: "", timeoutMs: 5 }), NOW)).toBeNull();
    expect(readArmedWakeDeadline({ ...toolResult("Monitor", {}), _meta: { claudeCode: { toolName: "Monitor" } } }, NOW)).toBeNull();
    expect(readArmedWakeDeadline(turnOutput, NOW)).toBeNull();
    expect(readArmedWakeDeadline(null, NOW)).toBeNull();
  });
});

describe("trackArmedWake", () => {
  it("keeps the latest due time across several armed wakes", () => {
    const record: { armedWakeAt?: number | null } = { armedWakeAt: null };
    trackArmedWake(record, toolResult("Monitor", { timeoutMs: 1_800_000 }), NOW);
    trackArmedWake(record, toolResult("Monitor", { timeoutMs: 60_000 }), NOW);
    expect(record.armedWakeAt).toBe(NOW + 1_800_000);
    expect(hasArmedWake(record, NOW + 1_800_000 + 1)).toBe(true);
    expect(hasArmedWake(record, NOW + 1_800_000 + ARMED_WAKE_GRACE_MS)).toBe(false);
  });

  it("keeps the wake through output before it is due, such as a Monitor event", () => {
    const record: { armedWakeAt?: number | null } = { armedWakeAt: NOW + 1_800_000 };
    trackArmedWake(record, turnOutput, NOW + 60_000);
    expect(record.armedWakeAt).toBe(NOW + 1_800_000);
  });

  it("consumes the wake when a turn runs at or after its due time", () => {
    const record: { armedWakeAt?: number | null } = { armedWakeAt: NOW + 1_800_000 };
    trackArmedWake(record, turnOutput, NOW + 1_800_000 + 5_000);
    expect(record.armedWakeAt).toBeNull();
    expect(hasArmedWake(record, NOW + 1_800_000 + 5_000)).toBe(false);
  });

  it("lets the first output of a new process supersede wakes an earlier process armed", () => {
    const record: { armedWakeAt?: number | null } = {};
    trackArmedWake(record, { sessionUpdate: "usage_update", used: 1, size: 2 }, NOW);
    expect(record.armedWakeAt).toBeUndefined();
    trackArmedWake(record, turnOutput, NOW);
    expect(record.armedWakeAt).toBeNull();
  });

  it("never consumes a persistent Monitor", () => {
    const record: { armedWakeAt?: number | null } = { armedWakeAt: null };
    trackArmedWake(record, toolResult("Monitor", { timeoutMs: 1_800_000, persistent: true }), NOW);
    trackArmedWake(record, turnOutput, NOW + 10 * 60 * 60_000);
    expect(record.armedWakeAt).toBe(PERSISTENT_WAKE_AT);
  });
});
