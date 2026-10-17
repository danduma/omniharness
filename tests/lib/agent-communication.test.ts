import { describe, expect, it } from "vitest";
import { buildAgentOutputActivity, type AgentOutputEntry } from "@/lib/agent-output";

const timestamp = "2026-10-15T17:00:00.000Z";
const send = (rawInput: unknown, status = "completed"): AgentOutputEntry => ({
  id: "send", type: "tool_call", text: "SendMessage", toolCallId: "send-tool", timestamp, status,
  raw: { _meta: { claudeCode: { toolName: "SendMessage" } }, rawInput },
});

describe("agent communication in the transcript", () => {
  it("shows the destination and full message rather than JSON", () => {
    const [activity] = buildAgentOutputActivity({ outputEntries: [send({ to: "Research", message: "Check this.\nThen reply." })] });
    expect(activity).toMatchObject({ kind: "tool", communication: { peer: "Research", text: "Check this.\nThen reply." } });
  });
  it("keeps communication outside collapsed tool groups", () => {
    const ordinary: AgentOutputEntry = { id: "read", type: "tool_call", text: "Read", timestamp };
    expect(buildAgentOutputActivity({ outputEntries: [ordinary, send({ recipient: "Reviewer", content: "Please review", type: "message" }), { ...ordinary, id: "read2" }] }).map(a => a.kind)).toEqual(["tool", "tool", "tool"]);
  });
  it("retains the message and failure status when a result has no input", () => {
    const [activity] = buildAgentOutputActivity({ outputEntries: [send({ to: "Research", message: "Check this" }, "pending"), {
      id: "result", type: "tool_call_update", toolCallId: "send-tool", timestamp, status: "failed", text: "Unknown recipient",
      raw: { rawOutput: "Unknown recipient" },
    }] });
    expect(activity).toMatchObject({ status: "failed", communication: { peer: "Research", text: "Check this" } });
  });
  it("renders protocol deliveries with their actual sender and recipient", () => {
    const [activity] = buildAgentOutputActivity({ outputEntries: [{
      id: "incoming", type: "session_message", timestamp, text: "Here is the result",
      raw: { sessionUpdate: "session_message", messageId: "message-1", senderSessionId: "Research", recipientSessionId: "Coding" },
    }] });
    expect(activity).toMatchObject({ kind: "agent_communication", peer: "Research", text: "Here is the result", recipientSessionId: "Coding" });
  });
  it("recognizes legacy teammate envelopes without exposing their XML", () => {
    const [activity] = buildAgentOutputActivity({ outputEntries: [{ id: "incoming", type: "user_message_chunk", timestamp,
      text: '<teammate-message teammate_id="Reviewer" summary="Review complete">Looks good.\nShip it.</teammate-message>' }] });
    expect(activity).toMatchObject({ kind: "agent_communication", peer: "Reviewer", text: "Looks good.\nShip it." });
  });
  it("does not mistake a quoted message or unrelated tool for communication", () => {
    expect(buildAgentOutputActivity({ outputEntries: [{ id: "normal", type: "user_message_chunk", timestamp, text: 'Example: <teammate-message teammate_id="Reviewer">Hello</teammate-message>' }] })).toEqual([]);
    expect(buildAgentOutputActivity({ outputEntries: [send({ command: 'echo SendMessage' })] })[0]).toHaveProperty("communication", undefined);
  });
});
