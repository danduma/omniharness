import { describe, expect, it } from "vitest";
import { sanitizeIncomingMessage } from "@/server/agent-runtime/acp-stream-sanitizer";

describe("sanitizeIncomingMessage", () => {
  it("rewrites range-read line tuples to the start line", () => {
    const message = {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "abc",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "t1",
          title: "Read foo.js",
          kind: "read",
          status: "pending",
          locations: [
            { path: "/x/foo.js", line: [912, 1000] },
            { path: "/x/bar.js", line: 3 },
            { path: "/x/baz.js", line: null },
          ],
        },
      },
    };
    const out = sanitizeIncomingMessage(message) as typeof message;
    expect(out.params.update.locations).toEqual([
      { path: "/x/foo.js", line: 912 },
      { path: "/x/bar.js", line: 3 },
      { path: "/x/baz.js", line: null },
    ]);
  });

  it("nulls out garbage line values", () => {
    const message = {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "abc",
        update: {
          sessionUpdate: "tool_call",
          locations: [
            { path: "/x/a.js", line: "twelve" },
            { path: "/x/b.js", line: -5 },
            { path: "/x/c.js", line: 5e10 },
            { path: "/x/d.js", line: [] },
            { path: "/x/e.js", line: ["nope"] },
          ],
        },
      },
    };
    const out = sanitizeIncomingMessage(message) as typeof message;
    expect(out.params.update.locations).toEqual([
      { path: "/x/a.js", line: null },
      { path: "/x/b.js", line: null },
      { path: "/x/c.js", line: null },
      { path: "/x/d.js", line: null },
      { path: "/x/e.js", line: null },
    ]);
  });

  it("leaves non session/update messages alone", () => {
    const message = { jsonrpc: "2.0", method: "prompt", params: { foo: "bar" } };
    expect(sanitizeIncomingMessage(message)).toBe(message);
  });

  it("tolerates missing locations", () => {
    const message = {
      jsonrpc: "2.0",
      method: "session/update",
      params: { sessionId: "abc", update: { sessionUpdate: "agent_thought_chunk" } },
    };
    expect(sanitizeIncomingMessage(message)).toBe(message);
  });

  it("passes a fully valid claude-style tool_call through untouched", () => {
    const message = {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "abc",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "t1",
          title: "Read foo.js",
          kind: "read",
          status: "pending",
          locations: [{ path: "/x/foo.js", line: 1 }],
          content: [],
          rawInput: {},
        },
      },
    };
    expect(sanitizeIncomingMessage(message)).toBe(message);
  });

  it("does not nuke complex update objects when a deep leaf is invalid", () => {
    // Path like locations[0].line being garbage shouldn't strip the
    // surrounding tool_call envelope (toolCallId, title, content…).
    const message = {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "abc",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "t1",
          title: "Read foo.js",
          kind: "read",
          status: "pending",
          locations: [{ path: "/x/foo.js", line: [10, 20] }],
          content: [],
          rawInput: {},
        },
      },
    };
    const out = sanitizeIncomingMessage(message) as typeof message;
    expect(out.params.update.toolCallId).toBe("t1");
    expect(out.params.update.title).toBe("Read foo.js");
    expect(out.params.update.locations).toEqual([{ path: "/x/foo.js", line: 10 }]);
  });
});
