import { describe, expect, it } from "vitest";
import { buildAgentOutputActivity } from "@/lib/agent-output";

describe("agent output normalization", () => {
  it("conflates tool call updates into a single tool activity item", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "start-1",
          type: "tool_call",
          text: "Read File",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "read",
          status: "pending",
          raw: {
            title: "Read File",
            kind: "read",
            locations: [{ path: "/Users/masterman/NLP/omniharness/vibes/nuxt-full-rewrite-plan-NEW3.md" }],
            rawInput: { path: "/Users/masterman/NLP/omniharness/vibes/nuxt-full-rewrite-plan-NEW3.md" },
          },
        },
        {
          id: "update-1",
          type: "tool_call_update",
          text: "Tool call tool-1 completed",
          timestamp: "2026-04-22T00:00:01.000Z",
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            toolCallId: "tool-1",
            status: "completed",
            content: [
              {
                type: "content",
                content: {
                  type: "text",
                  text: "```md\n1       # Heading\n2       body text\n```",
                },
              },
            ],
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      kind: "tool",
      label: "Read",
      title: "nuxt-full-rewrite-plan-NEW3.md",
      status: "completed",
      outputPane: {
        label: "OUT",
        text: "# Heading\nbody text",
      },
    });
  });

  it("uses bridge descriptions and tool response payloads for bash activities", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "start-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "execute",
          status: "pending",
          raw: {
            title: "Terminal",
            kind: "execute",
          },
        },
        {
          id: "update-1",
          type: "tool_call_update",
          text: "Tool call tool-1 updated: Extract jest config from package.json",
          timestamp: "2026-04-22T00:00:01.000Z",
          toolCallId: "tool-1",
          raw: {
            title: "cat package.json | jq .jest",
            kind: "execute",
            rawInput: {
              command: "cat package.json | jq .jest",
              description: "Extract jest config from package.json",
            },
            _meta: {
              claudeCode: {
                toolResponse: {
                  stdout: "{\n  \"test\": \"jest\"\n}",
                },
              },
            },
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      kind: "tool",
      label: "Bash",
      title: "Extract jest config from package.json",
      inputPane: {
        label: "IN",
        text: "cat package.json | jq .jest",
      },
      outputPane: {
        label: "OUT",
        text: "{\n  \"test\": \"jest\"\n}",
      },
    });
  });

  it("keeps thoughts as dedicated activity items", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "thought-1",
          type: "thought",
          text: "Let me inspect the current plan and memory first.",
          timestamp: "2026-04-22T00:00:00.000Z",
        },
      ],
    });

    expect(activity).toEqual([
      {
        id: "thought-1",
        kind: "thought",
        text: "Let me inspect the current plan and memory first.",
        timestamp: "2026-04-22T00:00:00.000Z",
      },
    ]);
  });

  it("surfaces live text as a fallback when no structured entries exist", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [],
      currentText: "Running tests and checking files",
    });

    expect(activity).toEqual([
      {
        id: "live-fallback",
        kind: "message",
        text: "Running tests and checking files",
        timestamp: new Date(0).toISOString(),
        live: true,
      },
    ]);
  });
});
