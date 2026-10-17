import { expect, test } from "vitest";
import { compactEntryForHistory } from "@/server/workers/output-store";
import { incomingAgentCommunication, outgoingAgentCommunication } from "@/lib/agent-communication";

const message = Array.from({ length: 20 }, (_, i) => `Message line ${i}: ${"details ".repeat(60)}`).join("\n");

test("history compaction preserves outgoing message content", () => {
  const entry = compactEntryForHistory({ type: "tool_call", raw: {
    _meta: { claudeCode: { toolName: "SendMessage" } }, rawInput: { to: "Reviewer", message },
  } });
  expect(outgoingAgentCommunication(entry.raw)?.text).toBe(message);
});

test("history compaction preserves received message content from provider origins", () => {
  const entry = compactEntryForHistory({ type: "usage", text: "10/100", raw: {
    _meta: { "_claude/origin": { kind: "peer", from: "Reviewer", body: message } },
  } });
  expect(incomingAgentCommunication(entry.type, entry.text, entry.raw)?.text).toBe(message);
});
