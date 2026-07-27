import { describe, expect, it } from "vitest";
import * as acp from "@agentclientprotocol/sdk";
import {
  ACP_CONTENT_BLOCKS,
  ACP_SESSION_UPDATES,
  ACP_TOOL_CALL_CONTENT,
  AGENT_TO_CLIENT_METHODS,
  CLIENT_TO_AGENT_METHODS,
} from "@/server/agent-runtime/acp/capability-registry";

describe("ACP 0.25 capability registry", () => {
  it("classifies every SDK method", () => {
    expect([...AGENT_TO_CLIENT_METHODS.keys()].sort()).toEqual(
      [...new Set(Object.values(acp.CLIENT_METHODS))].sort(),
    );
    expect([...CLIENT_TO_AGENT_METHODS.keys()].sort()).toEqual(
      [...new Set(Object.values(acp.AGENT_METHODS))].sort(),
    );
    expect([...AGENT_TO_CLIENT_METHODS.values(), ...CLIENT_TO_AGENT_METHODS.values()]
      .filter((capability) => capability.status !== "operational")).toEqual([]);
  });

  it("classifies every session and content discriminator", () => {
    expect(ACP_SESSION_UPDATES).toEqual([
      "user_message_chunk", "agent_message_chunk", "agent_thought_chunk",
      "tool_call", "tool_call_update", "plan", "plan_update", "plan_removed",
      "available_commands_update", "current_mode_update", "config_option_update",
      "session_info_update", "usage_update",
    ]);
    expect(ACP_CONTENT_BLOCKS).toEqual(["text", "image", "audio", "resource_link", "resource"]);
    expect(ACP_TOOL_CALL_CONTENT).toEqual(["content", "diff", "terminal"]);
  });
});
