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

  it("conflates duplicate tool call start entries into one activity item", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "start-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-05-04T14:31:00.000Z",
          toolCallId: "call_c982tKcpm7cjfz8Qbq9DktlV",
          toolKind: "execute",
          status: "in_progress",
          raw: {
            title: "Terminal",
            kind: "execute",
            rawInput: {
              command: "pnpm test",
            },
          },
        },
        {
          id: "start-duplicate",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-05-04T14:31:01.000Z",
          toolCallId: "call_c982tKcpm7cjfz8Qbq9DktlV",
          toolKind: "execute",
          status: "in_progress",
          raw: {
            title: "Run focused tests",
            kind: "execute",
            rawInput: {
              command: "pnpm test tests/lib/agent-output.test.ts",
              description: "Run focused tests",
            },
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      id: "call_c982tKcpm7cjfz8Qbq9DktlV",
      kind: "tool",
      label: "Bash",
      status: "in_progress",
      inputPane: {
        label: "IN",
        text: "pnpm test",
      },
    });
  });

  it("hydrates lifecycle-only tool updates when the matching start entry loads later", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "update-1",
          type: "tool_call_update",
          text: "Tool call call_IHHguba6n9yj9Tr2QhK4maQS completed",
          timestamp: "2026-05-04T14:31:01.000Z",
          toolCallId: "call_IHHguba6n9yj9Tr2QhK4maQS",
          status: "completed",
          raw: {
            toolCallId: "call_IHHguba6n9yj9Tr2QhK4maQS",
            status: "completed",
          },
        },
        {
          id: "start-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-05-04T14:31:00.000Z",
          toolCallId: "call_IHHguba6n9yj9Tr2QhK4maQS",
          toolKind: "execute",
          status: "in_progress",
          raw: {
            title: "Run focused tests",
            kind: "execute",
            rawInput: {
              command: "pnpm test tests/lib/agent-output.test.ts",
              description: "Run focused tests",
            },
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      id: "call_IHHguba6n9yj9Tr2QhK4maQS",
      kind: "tool",
      label: "Bash",
      title: "Run focused tests",
      status: "completed",
      inputPane: {
        label: "IN",
        text: "pnpm test tests/lib/agent-output.test.ts",
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

  it("surfaces edit tool unified diffs as dedicated diff panes", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "start-1",
          type: "tool_call",
          text: "Edit /workspace/app/src/index.ts",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "edit",
          status: "pending",
          raw: {
            title: "Edit /workspace/app/src/index.ts",
            kind: "edit",
            rawInput: {
              changes: {
                "/workspace/app/src/index.ts": {
                  type: "update",
                  unified_diff: "@@ -1 +1\n-old\n+new\n",
                },
              },
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
              stdout: "Success. Updated the following files:\nM src/index.ts\n",
              success: true,
              changes: {
                "/workspace/app/src/index.ts": {
                  type: "update",
                  unified_diff: "@@ -1 +1\n-old\n+new\n",
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
      label: "Edit",
      title: "index.ts",
      status: "completed",
      outputPane: {
        label: "DIFF",
        kind: "diff",
        text: expect.stringContaining("-old\n+new"),
      },
    });
    expect(activity[0]?.kind === "tool" ? activity[0].outputPane?.text : "").not.toContain("Success. Updated");
  });

  it("builds a red-green replacement diff for classic edit old and new string payloads", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "edit-1",
          type: "tool_call",
          text: "Edit",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "edit",
          status: "completed",
          raw: {
            kind: "edit",
            rawInput: {
              file_path: "/workspace/app/src/index.ts",
              old_string: "const status = 'old';",
              new_string: "const status = 'new';",
            },
          },
        },
      ],
    });

    expect(activity[0]).toMatchObject({
      kind: "tool",
      label: "Edit",
      outputPane: {
        label: "DIFF",
        kind: "diff",
        text: "diff -- /workspace/app/src/index.ts\n@@ replacement @@\n-const status = 'old';\n+const status = 'new';",
      },
    });
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

  it("does not render compact live payload markers as conversation activity", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "output-entries-omitted:entry-5:entry-66",
          type: "message",
          text: "60 earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.",
          timestamp: "2026-05-04T00:01:06.000Z",
        },
      ],
    });

    expect(activity).toEqual([]);
  });

  it("does not render worker archive markers as conversation activity", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "output-archive-marker",
          type: "message",
          text: "9294 older raw worker activity records are only in archived history, not in the current terminal output.",
          timestamp: "2026-05-06T15:30:00.000Z",
        },
      ],
    });

    expect(activity).toEqual([]);
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

  it("does not treat compact live payload markers as the latest worker turn", () => {
    const summary = extractLatestPlainTextTurn({
      outputEntries: [
        {
          id: "msg-1",
          type: "message",
          text: "Actual worker update",
          timestamp: "2026-05-04T00:00:00.000Z",
        },
        {
          id: "output-entries-omitted:msg-1:msg-2",
          type: "message",
          text: "20 earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.",
          timestamp: "2026-05-04T00:00:01.000Z",
        },
      ],
    });

    expect(summary).toBe("Actual worker update");
  });

  it("does not treat worker archive markers as the latest worker turn", () => {
    const summary = extractLatestPlainTextTurn({
      outputEntries: [
        {
          id: "msg-1",
          type: "message",
          text: "Actual worker update",
          timestamp: "2026-05-04T00:00:00.000Z",
        },
        {
          id: "output-archive-marker",
          type: "message",
          text: "9294 older raw worker activity records are only in archived history, not in the current terminal output.",
          timestamp: "2026-05-04T00:00:01.000Z",
        },
      ],
    });

    expect(summary).toBe("Actual worker update");
  });

  it("falls back to the response section from legacy worker output messages", () => {
    const summary = extractLatestPlainTextTurn({
      lastText: "Prompted run-worker-1:\nPlease fix the UI\n\nInitial response:\nImplemented the compact worker summary.",
    });

    expect(summary).toBe("Implemented the compact worker summary.");
  });
});
