import { describe, expect, it } from "vitest";
import * as acp from "@agentclientprotocol/sdk";
import {
  AGENT_NOTIFICATION_DISPATCH,
  AGENT_REQUEST_DISPATCH,
} from "@/server/agent-runtime/acp/agent-methods";

describe("ACP client-to-agent dispatch", () => {
  it("classifies every standard method as a request or notification", () => {
    expect([
      ...Object.keys(AGENT_REQUEST_DISPATCH),
      ...Object.keys(AGENT_NOTIFICATION_DISPATCH),
    ].sort()).toEqual([...new Set(Object.values(acp.AGENT_METHODS))].sort());
  });
});
