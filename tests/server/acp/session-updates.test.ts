import { describe, expect, it } from "vitest";
import type * as acp from "@agentclientprotocol/sdk";
import { normalizeSessionUpdate } from "@/server/agent-runtime/acp/session-updates";

describe("ACP session update normalization", () => {
  it("keeps non-text content instead of silently dropping it", () => {
    const normalized = normalizeSessionUpdate({
      sessionUpdate: "agent_message_chunk",
      content: { type: "image", data: "aW1hZ2U=", mimeType: "image/png" },
    });
    expect(normalized).toMatchObject({ kind: "entry", entry: { type: "agent_content", text: "image" } });
  });

  it.each([
    [{ sessionUpdate: "plan", entries: [{ content: "Do it", priority: "high", status: "pending" }] }, "plan"],
    [{ sessionUpdate: "plan_update", plan: { type: "markdown", id: "p1", content: "# Plan" } }, "plan_update"],
    [{ sessionUpdate: "plan_removed", id: "p1" }, "plan_removed"],
    [{ sessionUpdate: "available_commands_update", availableCommands: [{ name: "review", description: "Review" }] }, "available_commands"],
    [{ sessionUpdate: "current_mode_update", currentModeId: "code" }, "current_mode"],
    [{ sessionUpdate: "config_option_update", configOptions: [] }, "config_option"],
    [{ sessionUpdate: "session_info_update", title: "Session" }, "session_info"],
    [{ sessionUpdate: "usage_update", used: 10, size: 100 }, "usage"],
  ] as const)("persists %s", (update, expectedType) => {
    const normalized = normalizeSessionUpdate(update as unknown as acp.SessionUpdate);
    expect(normalized).toMatchObject({ kind: "entry", entry: { type: expectedType } });
  });
});
