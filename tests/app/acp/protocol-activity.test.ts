import { describe, expect, it } from "vitest";
import { buildAgentOutputActivity } from "@/lib/agent-output";

describe("ACP protocol activity projection", () => {
  it("projects user-facing protocol activity without exposing the command catalog", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        { id: "plan", type: "plan", text: "Implement it", timestamp: "2026-01-01T00:00:00Z", raw: { entries: [] } },
        { id: "commands", type: "available_commands", text: "review", timestamp: "2026-01-01T00:00:01Z", raw: { availableCommands: [] } },
        { id: "mode", type: "current_mode", text: "code", timestamp: "2026-01-01T00:00:02Z", raw: { currentModeId: "code" } },
        { id: "image", type: "agent_content", text: "image", timestamp: "2026-01-01T00:00:03Z", raw: { content: { type: "image", data: "aQ==", mimeType: "image/png" } } },
      ],
    });

    expect(activity.map((item) => item.kind)).toEqual(["protocol", "protocol", "protocol"]);
    expect(activity.map((item) => item.kind === "protocol" ? item.protocolType : null)).toEqual([
      "plan", "current_mode", "content",
    ]);
  });

  it("coalesces updates for the same plan and request", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        { id: "p1", type: "plan_update", text: "Old", timestamp: "2026-01-01T00:00:00Z", raw: { plan: { id: "one", type: "markdown" } } },
        { id: "p2", type: "plan_update", text: "New", timestamp: "2026-01-01T00:00:01Z", raw: { plan: { id: "one", type: "markdown" } } },
        { id: "q1", type: "elicitation", text: "Question", timestamp: "2026-01-01T00:00:02Z", status: "pending", raw: { requestId: 7 } },
        { id: "q2", type: "elicitation", text: "Answered", timestamp: "2026-01-01T00:00:03Z", status: "answered", raw: { requestId: 7 } },
      ],
    });
    expect(activity).toHaveLength(2);
    expect(activity.map((item) => item.kind === "protocol" ? item.text : null)).toEqual(["New", "Answered"]);
  });
});
