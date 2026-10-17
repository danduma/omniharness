import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/shared/worker-entries";
import { normalizeSessionUpdate } from "@/server/agent-runtime/acp/session-updates";

const timestamp = "2026-10-15T17:00:00.000Z";
const render = (entries: WorkerEntry[]) => {
  Object.assign(globalThis, { React });
  return renderToStaticMarkup(React.createElement(Terminal, { entries, showTextSizeControl: false, summarizeWorkBlocks: true }));
};

test("sent messages stay readable outside collapsed work summaries", () => {
  const html = render([
    { id: "read", seq: 1, type: "tool_call", timestamp, text: "Read file", status: "completed" },
    { id: "send", seq: 2, type: "tool_call", toolCallId: "send", timestamp, text: "SendMessage", status: "completed",
      raw: { _meta: { claudeCode: { toolName: "SendMessage" } }, rawInput: { to: "Reviewer", message: "Please check the implementation." } } },
    { id: "read2", seq: 3, type: "tool_call", timestamp, text: "Read another file", status: "completed" },
    { id: "answer", seq: 4, type: "message", timestamp, text: "I have asked for review." },
  ]);
  expect(html).toContain('data-agent-communication="outgoing"');
  expect(html).toContain("Sent to Reviewer");
  expect(html).toContain("Please check the implementation.");
  expect(html).toContain("Technical details");
  expect(html).not.toContain("work-summary:");
});

test("provider receipts render on the recipient side with the sender's name", () => {
  const normalized = normalizeSessionUpdate({ sessionUpdate: "usage_update", used: 10, size: 100,
    _meta: { "_claude/origin": { kind: "peer", from: "sender-address", name: "Research", body: "Found the cause." } },
  });
  if (normalized.kind !== "entry") throw new Error("Expected a persisted receipt");
  const html = render([{ ...normalized.entry, id: "received", seq: 1, timestamp }]);
  expect(html).toContain('data-agent-communication="incoming"');
  expect(html).toContain("Received from Research");
  expect(html).toContain("Found the cause.");
});

test("failed sends show their failure without claiming delivery", () => {
  const html = render([{ id: "send", seq: 1, type: "tool_call", timestamp, text: "SendMessage", status: "failed",
    raw: { _meta: { claudeCode: { toolName: "SendMessage" } }, rawInput: { to: "Missing", message: "Hello" } } }]);
  expect(html).toContain("Message to Missing failed");
  expect(html).not.toContain("Sent to Missing");
});

test("incoming provider envelopes render without becoming human messages", () => {
  const html = render([{ id: "incoming", seq: 1, type: "user_message_chunk", timestamp,
    text: '<teammate-message teammate_id="Reviewer">Looks good.</teammate-message>' }]);
  expect(html).toContain("Received from Reviewer");
  expect(html).toContain("Looks good.");
  expect(html).not.toContain("&lt;teammate-message");
});
