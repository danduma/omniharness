import { describe, expect, it } from "vitest";
import { buildAgentOutputActivity, extractLatestPlainTextTurn } from "@/lib/agent-output";

describe("agent output normalization", () => {
  it("renders the latest changed revision for repeated bridge message ids", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "34ab93a5-fa74-40e3-8af9-26a19301a1bb",
          type: "message",
          text: "First",
          timestamp: "2026-05-17T00:00:00.000Z",
        },
        {
          id: "tool-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-05-17T00:00:00.500Z",
          toolCallId: "tool-1",
          toolKind: "execute",
          status: "completed",
          raw: {
            kind: "execute",
            rawInput: { command: "date" },
          },
        },
        {
          id: "34ab93a5-fa74-40e3-8af9-26a19301a1bb",
          type: "message",
          text: "First message expanded after streaming completed.",
          timestamp: "2026-05-17T00:00:01.000Z",
        },
      ],
    });

    expect(activity).toHaveLength(2);
    expect(activity[0]).toEqual({
      id: "34ab93a5-fa74-40e3-8af9-26a19301a1bb",
      kind: "message",
      text: "First message expanded after streaming completed.",
      timestamp: "2026-05-17T00:00:00.000Z",
    });
    expect(activity[1]).toMatchObject({ kind: "tool", id: "tool-1" });
  });

  it("groups consecutive tool activities between assistant messages", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "msg-1",
          type: "message",
          text: "I will inspect this first.",
          timestamp: "2026-05-10T00:00:00.000Z",
        },
        {
          id: "read-1",
          type: "tool_call",
          text: "Read File",
          timestamp: "2026-05-10T00:00:01.000Z",
          toolCallId: "read-1",
          toolKind: "read",
          status: "completed",
          raw: {
            kind: "read",
            rawInput: { path: "/workspace/src/Terminal.tsx" },
          },
        },
        {
          id: "search-1",
          type: "tool_call",
          text: "Search",
          timestamp: "2026-05-10T00:00:02.000Z",
          toolCallId: "search-1",
          toolKind: "search",
          status: "completed",
          raw: {
            kind: "search",
            rawInput: { command: "rg Terminal src" },
          },
        },
        {
          id: "edit-1",
          type: "tool_call",
          text: "Edit /workspace/src/Terminal.tsx",
          timestamp: "2026-05-10T00:00:03.000Z",
          toolCallId: "edit-1",
          toolKind: "edit",
          status: "completed",
          raw: {
            kind: "edit",
            rawInput: {
              file_path: "/workspace/src/Terminal.tsx",
              old_string: "old",
              new_string: "new",
            },
          },
        },
        {
          id: "msg-2",
          type: "message",
          text: "I found the renderer.",
          timestamp: "2026-05-10T00:00:04.000Z",
        },
      ],
    });

    expect(activity).toHaveLength(3);
    expect(activity[1]).toMatchObject({
      kind: "tool_group",
      id: "tool-group:read-1:edit-1",
      status: "completed",
      counts: {
        editedFiles: 1,
        readFiles: 1,
        searches: 1,
        total: 3,
      },
      tools: [
        expect.objectContaining({ kind: "tool", label: "Read", targetPath: "/workspace/src/Terminal.tsx" }),
        expect.objectContaining({ kind: "tool", label: "Search" }),
        expect.objectContaining({ kind: "tool", label: "Edit", targetPath: "/workspace/src/Terminal.tsx" }),
      ],
    });
  });

  it("marks a grouped tool run as failed when any child tool fails", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "read-1",
          type: "tool_call",
          text: "Read File",
          timestamp: "2026-05-10T00:00:01.000Z",
          toolCallId: "read-1",
          toolKind: "read",
          status: "completed",
        },
        {
          id: "bash-1",
          type: "tool_call",
          text: "Terminal",
          timestamp: "2026-05-10T00:00:02.000Z",
          toolCallId: "bash-1",
          toolKind: "execute",
          status: "failed",
          raw: {
            kind: "execute",
            rawInput: { command: "pnpm test" },
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      kind: "tool_group",
      status: "failed",
      counts: {
        readFiles: 1,
        commands: 1,
        total: 2,
      },
    });
  });

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

  it("does not echo agent prompts as an input pane when output repeats the same text", () => {
    const text = "Switching to Plan mode: Need to research existing supervisor, worker, and ACP connection code.";
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "agent-1",
          type: "tool_call",
          text: "Agent",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "agent-tool-1",
          toolKind: "agent",
          status: "completed",
          raw: {
            title: "Agent",
            kind: "agent",
            rawInput: {
              prompt: text,
            },
            rawOutput: {
              formatted_output: text,
            },
          },
        },
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      kind: "tool",
      label: "Agent",
      outputPane: {
        label: "OUT",
        text,
      },
    });
    expect(activity[0]?.kind === "tool" ? activity[0].inputPane : null).toBeUndefined();
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

  it("keeps an edit diff when the final update only reports success text", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "start-1",
          type: "tool_call",
          text: "Edit",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "edit",
          status: "pending",
          raw: {
            title: "Edit",
            kind: "edit",
            locations: [{ path: "/workspace/app/src/index.ts" }],
          },
        },
        {
          id: "diff-update",
          type: "tool_call_update",
          text: "Tool call tool-1 updated",
          timestamp: "2026-04-22T00:00:01.000Z",
          toolCallId: "tool-1",
          raw: {
            kind: "edit",
            content: [
              {
                type: "content",
                content: {
                  type: "text",
                  text: "@@ -1 +1\n-old\n+new\n",
                },
              },
            ],
          },
        },
        {
          id: "success-update",
          type: "tool_call_update",
          text: "Tool call tool-1 completed: File edited successfully",
          timestamp: "2026-04-22T00:00:02.000Z",
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            rawOutput: "File edited successfully",
            status: "completed",
          },
        },
      ],
    });

    expect(activity[0]).toMatchObject({
      kind: "tool",
      label: "Edit",
      status: "completed",
      outputPane: {
        label: "DIFF",
        kind: "diff",
        text: expect.stringContaining("-old\n+new"),
      },
    });
    expect(activity[0]?.kind === "tool" ? activity[0].outputPane?.text : "").not.toContain("File edited successfully");
  });

  it("builds an edit diff from oldText and newText content payloads", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "edit-update",
          type: "tool_call_update",
          text: "Tool call tool-1 completed",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            kind: "edit",
            title: "src/index.ts: old => new",
            content: [
              {
                type: "diff",
                path: "/workspace/app/src/index.ts",
                oldText: "const status = 'old';",
                newText: "const status = 'new';",
              },
            ],
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

  it("builds an edit diff for added file content payloads", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "edit-update",
          type: "tool_call_update",
          text: "Tool call tool-1 completed",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            kind: "edit",
            title: "Edit /workspace/app/src/new-file.ts",
            rawOutput: {
              stdout: "Success. Updated the following files:\nA src/new-file.ts\n",
              success: true,
              changes: {
                "/workspace/app/src/new-file.ts": {
                  type: "add",
                  content: "export const status = 'new';\n",
                },
              },
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
        text: "diff -- /workspace/app/src/new-file.ts\n@@ add @@\n+export const status = 'new';\n+",
      },
    });
  });

  it("builds an edit diff for newText-only content payloads", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "edit-start",
          type: "tool_call",
          text: "Edit /workspace/app/src/new-file.ts",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          toolKind: "edit",
          status: "in_progress",
          raw: {
            kind: "edit",
            content: [
              {
                type: "diff",
                path: "/workspace/app/src/new-file.ts",
                newText: "export const status = 'new';\n",
              },
            ],
          },
        },
        {
          id: "edit-update",
          type: "tool_call_update",
          text: "Tool call tool-1 completed",
          timestamp: "2026-04-22T00:00:01.000Z",
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            rawOutput: {
              stdout: "Success. Updated the following files:\nA src/new-file.ts\n",
              success: true,
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
        text: "diff -- /workspace/app/src/new-file.ts\n@@ add @@\n+export const status = 'new';\n+",
      },
    });
  });

  it("deduplicates identical edit diffs from content and raw output changes", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "edit-update",
          type: "tool_call_update",
          text: "Tool call tool-1 completed",
          timestamp: "2026-04-22T00:00:00.000Z",
          toolCallId: "tool-1",
          status: "completed",
          raw: {
            kind: "edit",
            content: [
              {
                type: "diff",
                path: "/workspace/app/src/new-file.ts",
                newText: "export const status = 'new';\n",
              },
            ],
            rawOutput: {
              changes: {
                "/workspace/app/src/new-file.ts": {
                  type: "add",
                  content: "export const status = 'new';\n",
                },
              },
            },
          },
        },
      ],
    });

    const text = activity[0]?.kind === "tool" ? activity[0].outputPane?.text ?? "" : "";
    expect(text.match(/@@ add @@/g)).toHaveLength(1);
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

  it("marks trailing thoughts complete when the agent is done", () => {
    const activity = buildAgentOutputActivity({
      state: "done",
      outputEntries: [
        {
          id: "thought-1",
          type: "thought",
          text: "Reviewing the final result.",
          timestamp: "2026-04-22T00:00:00.000Z",
        },
      ],
    });

    expect(activity).toEqual([
      {
        id: "thought-1",
        kind: "thinking",
        thoughts: ["Reviewing the final result."],
        timestamp: "2026-04-22T00:00:00.000Z",
        inProgress: false,
        durationMs: 0,
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

  it("labels permission activity from the stored outcome status", () => {
    const activity = buildAgentOutputActivity({
      outputEntries: [
        {
          id: "permission-request",
          type: "permission",
          text: "Permission requested: allow_once Allow, reject_once Reject",
          timestamp: "2026-05-10T00:00:00.000Z",
          status: "pending",
          raw: {
            requestId: 1,
            toolCall: { kind: "execute", title: "pnpm test" },
          },
        },
        {
          id: "permission-result",
          type: "permission",
          text: "Permission approved for request 1: allow_once Allow",
          timestamp: "2026-05-10T00:00:01.000Z",
          status: "approved",
        },
      ],
    });

    expect(activity).toMatchObject([
      { kind: "permission", title: "terminal.permission.approved", status: "approved", detail: "execute: pnpm test", text: "" },
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
