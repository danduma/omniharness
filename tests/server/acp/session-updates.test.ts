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

it("preserves session_message deliveries through the current SDK compatibility boundary", async () => {
  const { sanitizeIncomingMessage } = await import("@/server/agent-runtime/acp-stream-sanitizer");
  const { zSessionNotification } = await import("@agentclientprotocol/sdk/dist/schema/zod.gen.js");
  const delivery = { sessionUpdate: "session_message", messageId: "msg-1", senderSessionId: "sender", recipientSessionId: "receiver", content: [{ type: "text", text: "Hello" }] };
  const frame = sanitizeIncomingMessage({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "receiver", update: delivery } }) as { params: unknown };
  const parsed = zSessionNotification.parse(frame.params);
  expect(normalizeSessionUpdate(parsed.update)).toMatchObject({ kind: "entry", entry: { type: "session_message", text: "Hello", raw: delivery } });
});

it("preserves Claude's actual cross-session receipt metadata alongside usage", () => {
  const update = { sessionUpdate: "usage_update", used: 10, size: 100,
    _meta: { "_claude/origin": { kind: "peer", from: "sender-address", name: "Reviewer", fromSession: "sender-session", body: "The review is ready." } },
  } as const;
  expect(normalizeSessionUpdate(update)).toMatchObject({ kind: "entry", entry: { type: "usage", raw: update } });
});

it("does not fabricate receipts for peer origins without a decoded body", () => {
  expect(normalizeSessionUpdate({ sessionUpdate: "usage_update", used: 10, size: 100,
    _meta: { "_claude/origin": { kind: "peer", from: "sender" } },
  })).toMatchObject({ kind: "entry", entry: { type: "usage" } });
});
