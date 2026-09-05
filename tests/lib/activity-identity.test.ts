import { describe, expect, it } from "vitest";
import { buildAgentOutputActivity, reconcileActivityIdentity, type AgentActivityItem } from "@/lib/agent-output";

function message(id: string, text: string, seq: number): AgentActivityItem {
  return {
    id,
    kind: "message",
    text,
    timestamp: new Date(1700000000000 + seq).toISOString(),
  };
}

describe("reconcileActivityIdentity", () => {
  it("returns the previous object for rows whose content is unchanged", () => {
    const previous = [message("a", "one", 1), message("b", "two", 2)];
    const rebuilt = [message("a", "one", 1), message("b", "two", 2), message("c", "three", 3)];

    const reconciled = reconcileActivityIdentity(previous, rebuilt);

    expect(reconciled[0]).toBe(previous[0]);
    expect(reconciled[1]).toBe(previous[1]);
    expect(reconciled[2]).toBe(rebuilt[2]);
  });

  it("hands back the rebuilt object when a row's content changed", () => {
    const previous = [message("a", "partial", 1)];
    const rebuilt = [message("a", "partial text now complete", 1)];

    const reconciled = reconcileActivityIdentity(previous, rebuilt);

    expect(reconciled[0]).toBe(rebuilt[0]);
  });

  it("does not reuse across a kind change on the same id", () => {
    const previous: AgentActivityItem[] = [message("a", "text", 1)];
    const rebuilt: AgentActivityItem[] = [{
      id: "a",
      kind: "permission",
      title: "terminal.permission.granted",
      text: "text",
      detail: null,
      timestamp: new Date(1700000001000).toISOString(),
      status: "granted",
    }];

    expect(reconcileActivityIdentity(previous, rebuilt)[0]).toBe(rebuilt[0]);
  });

  it("compares nested tool group contents rather than object identity", () => {
    const build = () => buildAgentOutputActivity({
      outputEntries: [
        { id: "t1", type: "tool_call", toolCallId: "t1", text: "Read a.ts", timestamp: "2026-01-01T00:00:00.000Z", status: "completed" },
        { id: "t2", type: "tool_call", toolCallId: "t2", text: "Read b.ts", timestamp: "2026-01-01T00:00:01.000Z", status: "completed" },
      ],
    } as never);

    const previous = build();
    const rebuilt = build();
    expect(rebuilt[0]).not.toBe(previous[0]);

    const reconciled = reconcileActivityIdentity(previous, rebuilt);
    expect(reconciled[0]).toBe(previous[0]);
  });

  it("keeps the streaming row fresh while the settled rows above it stay stable", () => {
    const settled = { id: "t1", type: "tool_call", toolCallId: "t1", text: "Read a.ts", timestamp: "2026-01-01T00:00:00.000Z", status: "completed" };
    const previous = buildAgentOutputActivity({
      outputEntries: [settled, { id: "m1", type: "message", text: "Partial", timestamp: "2026-01-01T00:00:02.000Z" }],
    } as never);
    const rebuilt = buildAgentOutputActivity({
      outputEntries: [settled, { id: "m1", type: "message", text: "Partial answer", timestamp: "2026-01-01T00:00:02.000Z" }],
    } as never);

    const reconciled = reconcileActivityIdentity(previous, rebuilt);
    const settledIndex = reconciled.findIndex((item) => item.kind !== "message");
    const streamingIndex = reconciled.findIndex((item) => item.kind === "message");

    expect(reconciled[settledIndex]).toBe(previous[settledIndex]);
    expect(reconciled[streamingIndex]).toBe(rebuilt[streamingIndex]);
  });

  it("passes the rebuilt array through when there is nothing to reuse", () => {
    const rebuilt = [message("a", "one", 1)];
    expect(reconcileActivityIdentity(null, rebuilt)).toBe(rebuilt);
    expect(reconcileActivityIdentity([], rebuilt)).toBe(rebuilt);
    expect(reconcileActivityIdentity([message("z", "other", 9)], rebuilt)).toBe(rebuilt);
  });
});
