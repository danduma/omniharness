import { describe, expect, it } from "vitest";
import { buildAgentOutputActivity, extractLatestPlainTextTurn } from "@/lib/agent-output";

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

  it("does not render empty formatted command output as expandable metadata", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "start-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "execute",
          status: "in_progress",
          raw: {
            kind: "execute",
            rawInput: {
              command: "true",
            },
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
            rawOutput: {
              duration_ms: 12,
              exit_code: 0,
              formatted_output: "",
            },
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      kind: "tool",
      status: "completed",
      inputPane: {
        label: "IN",
        text: "true",
      },
    });
    expect(activity[0]?.kind === "tool" ? activity[0].outputPane : null).toBeUndefined();
  });

  it("groups active thoughts into a thinking activity", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "thought-1",
          type: "thought",
          text: "Let me inspect the current plan and memory first.",
          timestamp: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "thought-2",
          type: "thought",
          text: "I should check the renderer next.",
          timestamp: "2026-04-22T00:00:02.000Z",
        },
      ],
    });

    expect(activity).toEqual([
      {
        id: "thought-1",
        kind: "thinking",
        thoughts: [
          "Let me inspect the current plan and memory first.",
          "I should check the renderer next.",
        ],
        timestamp: "2026-04-22T00:00:00.000Z",
        inProgress: true,
      },
    ]);
  });

  it("falls back to display text when structured activity fields are empty", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [],
      currentText: "",
      lastText: "",
      displayText: "Recovered worker output",
    });

    expect(activity).toEqual([
      expect.objectContaining({
        kind: "message",
        text: "Recovered worker output",
        live: true,
      }),
    ]);
  });

  it("marks thinking complete when a following activity arrives", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "thought-1",
          type: "thought",
          text: "Let me inspect the current plan and memory first.",
          timestamp: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "msg-1",
          type: "message",
          text: "I found the renderer.",
          timestamp: "2026-04-22T00:00:03.400Z",
        },
      ],
    });

    expect(activity[0]).toMatchObject({
      id: "thought-1",
      kind: "thinking",
      thoughts: ["Let me inspect the current plan and memory first."],
      timestamp: "2026-04-22T00:00:00.000Z",
      inProgress: false,
      durationMs: 3400,
    });
    expect(activity[1]).toMatchObject({
      kind: "message",
      text: "I found the renderer.",
    });
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

  it("extracts the latest plain text worker turn instead of the initial chatter", () => {
    const summary = extractLatestPlainTextTurn({
      outputEntries: [
        {
          id: "msg-1",
          type: "message",
          text: "I will inspect the worker renderer first.",
          timestamp: "2026-04-22T00:00:00.000Z",
        },
        {
          id: "tool-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-04-22T00:00:01.000Z",
          toolCallId: "tool-1",
          status: "completed",
        },
        {
          id: "msg-2",
          type: "message",
          text: "Updated the worker summary card and verified the focused tests.",
          timestamp: "2026-04-22T00:00:02.000Z",
        },
      ],
      lastText: "Prompted worker-1:\nDo the thing\n\nResponse:\nUpdated the worker summary card and verified the focused tests.",
    });

    expect(summary).toBe("Updated the worker summary card and verified the focused tests.");
  });

  it("falls back to the response section from legacy worker output messages", () => {
    const summary = extractLatestPlainTextTurn({
      lastText: "Prompted run-worker-1:\nPlease fix the UI\n\nInitial response:\nImplemented the compact worker summary.",
    });

    expect(summary).toBe("Implemented the compact worker summary.");
  });
});
