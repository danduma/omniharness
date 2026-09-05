import { describe, expect, it } from "vitest";
import { selectWorkerEntryCandidates } from "@/server/handoff/candidates";
import type { WorkerEntry } from "@/shared/worker-entries";

function entry(
  seq: number,
  type: WorkerEntry["type"],
  text: string,
  authorRole?: WorkerEntry["authorRole"],
  overrides: Partial<WorkerEntry> = {},
): WorkerEntry {
  return { id: `e-${seq}`, seq, type, text, timestamp: new Date(seq * 1_000).toISOString(), authorRole, ...overrides };
}

describe("selectWorkerEntryCandidates", () => {
  it("excludes hidden reasoning and bounds entries at the requested source sequence", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "user_input", "original", "user"),
      entry(2, "thought", "private reasoning", "assistant"),
      entry(3, "message", "assistant recap", "assistant"),
      entry(4, "tool_call_update", "tests passed", "assistant"),
      entry(5, "message", "later answer", "assistant"),
    ], 4, "/workspace/app");

    expect(result.recentUserMessages).toEqual(["original"]);
    expect(result.recentAssistantSummary).toBe("assistant recap");
    expect(result.verification).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("private reasoning");
    expect(JSON.stringify(result)).not.toContain("later answer");
  });

  it("keeps useful earlier assistant context when the latest worker output is only a quota error", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "message", "Confirmed that Safari exports are falling back to the slow path.", "assistant"),
      entry(2, "message", "You've hit your session limit · resets 3:20pm", "assistant"),
    ], null, "/workspace/app");

    expect(result.recentAssistantSummary).toContain("Safari exports");
    expect(result.recentAssistantSummary).not.toContain("session limit");
  });

  it("deduplicates user messages replayed into replacement worker streams", () => {
    const first = entry(1, "user_input", "Check the export path", "user");
    const replay = { ...entry(2, "user_input", "Check the export path", "user"), id: first.id };
    const result = selectWorkerEntryCandidates([first, replay], null, "/workspace/app");

    expect(result.recentUserMessages).toEqual(["Check the export path"]);
  });

  it("lists only project files targeted by successful edit tools in the supplied full session", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "tool_call_update", "Edit src/actual.ts", "assistant", {
        toolCallId: "edit-actual",
        toolKind: "edit",
        raw: {
          kind: "edit",
          locations: [{ path: "/workspace/app/src/actual.ts" }],
          rawInput: { file_path: "/workspace/app/src/actual.ts" },
        },
      }),
      entry(2, "tool_call_update", "Edit src/actual.ts", "assistant", {
        toolCallId: "edit-actual",
        toolKind: "edit",
        raw: {
          kind: "edit",
          content: [{ type: "diff", path: "/workspace/app/src/actual.ts", oldText: "old", newText: "new" }],
        },
      }),
      entry(2.5, "tool_call_update", "Edit src/actual.ts", "assistant", {
        toolCallId: "edit-actual",
        toolKind: "edit",
        raw: {
          kind: "edit",
          rawInput: { file_path: "/workspace/app/src/actual.ts", old_string: "old" },
        },
      }),
      entry(3, "tool_call_update", "completed", "assistant", {
        toolCallId: "edit-actual",
        status: "completed",
        raw: { status: "completed" },
      }),
      entry(4, "tool_call_update", "Edit src/failed.ts", "assistant", {
        toolCallId: "edit-failed",
        toolKind: "edit",
        raw: { kind: "edit", locations: [{ path: "/workspace/app/src/failed.ts" }] },
      }),
      entry(5, "tool_call_update", "failed", "assistant", {
        toolCallId: "edit-failed",
        status: "failed",
        raw: { status: "failed" },
      }),
      entry(6, "tool_call_update", "Read src/read-only.ts", "assistant", {
        toolCallId: "read-only",
        toolKind: "read",
        raw: { kind: "read", locations: [{ path: "/workspace/app/src/read-only.ts" }] },
      }),
      entry(7, "tool_call_update", "completed", "assistant", {
        toolCallId: "read-only",
        status: "completed",
        raw: { status: "completed" },
      }),
      entry(8, "tool_call_update", "Edit ../other-repo/private.ts", "assistant", {
        toolCallId: "outside-project",
        toolKind: "edit",
        raw: { kind: "edit", locations: [{ path: "/workspace/other-repo/private.ts" }] },
      }),
      entry(9, "tool_call_update", "completed", "assistant", {
        toolCallId: "outside-project",
        status: "completed",
        raw: { status: "completed" },
      }),
    ], null, "/workspace/app");

    expect(result.modifiedFiles).toEqual([{
      path: "src/actual.ts",
      changeType: "modified",
      ownership: "session",
      summary: "1 successful edit tool call recorded for this file.",
      evidence: ['Changed "old" to "new".'],
    }]);
  });

  it("summarizes every successful edit call for a file without using git state", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "tool_call_update", "Edit src/actual.ts", "assistant", {
        toolCallId: "edit-one",
        toolKind: "edit",
        raw: {
          kind: "edit",
          content: [{ type: "diff", path: "/workspace/app/src/actual.ts", oldText: "const oldValue = true;", newText: "const newValue = true;" }],
        },
      }),
      entry(2, "tool_call_update", "completed", "assistant", {
        toolCallId: "edit-one",
        status: "completed",
        raw: { status: "completed" },
      }),
      entry(3, "tool_call_update", "Edit src/actual.ts", "assistant", {
        toolCallId: "edit-two",
        toolKind: "edit",
        raw: {
          kind: "edit",
          content: [{ type: "diff", path: "/workspace/app/src/actual.ts", oldText: null, newText: "export function addedBehavior() { return true; }" }],
        },
      }),
      entry(4, "tool_call_update", "completed", "assistant", {
        toolCallId: "edit-two",
        status: "completed",
        raw: { status: "completed" },
      }),
    ], null, "/workspace/app");

    expect(result.modifiedFiles).toEqual([{
      path: "src/actual.ts",
      changeType: "added",
      ownership: "session",
      summary: "2 successful edit tool calls recorded for this file.",
      evidence: [
        'Changed "const oldValue = true;" to "const newValue = true;".',
        'Added "export function addedBehavior() { return true; }".',
      ],
    }]);
  });

  it("collapses tool progress into one verification record with the real outcome", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "tool_call_update", "pnpm vitest run tests/server/example.test.ts", "assistant", {
        toolCallId: "verify-1",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "pnpm vitest run tests/server/example.test.ts" } },
      }),
      entry(2, "tool_call_update", "pnpm vitest run tests/server/example.test.ts", "assistant", {
        toolCallId: "verify-1",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "pnpm vitest run tests/server/example.test.ts" } },
      }),
      entry(3, "tool_call_update", "verify-1", "assistant", {
        toolCallId: "verify-1",
        raw: { _meta: { claudeCode: { toolResponse: { stdout: "Test Files 1 passed (1)\nTests 4 passed (4)", stderr: "" } } } },
      }),
      entry(4, "tool_call_update", "completed", "assistant", {
        toolCallId: "verify-1",
        status: "completed",
        raw: { status: "completed", rawOutput: "Test Files 1 passed (1)\nTests 4 passed (4)" },
      }),
      entry(5, "tool_call_update", "find tests -name '*interrupt*'", "assistant", {
        toolCallId: "not-verification",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "find tests -name '*interrupt*'" } },
      }),
      entry(6, "tool_call_update", "completed", "assistant", {
        toolCallId: "not-verification",
        status: "completed",
        raw: { status: "completed", rawOutput: "tests/server/example.test.ts" },
      }),
      entry(7, "tool_call_update", "pnpm exec tsc --noEmit", "assistant", {
        toolCallId: "typecheck-1",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "pnpm exec tsc --noEmit" } },
      }),
      entry(8, "tool_call_update", "completed", "assistant", {
        toolCallId: "typecheck-1",
        status: "completed",
        raw: { status: "completed", rawOutput: "(Bash completed with no output)" },
      }),
      entry(9, "tool_call_update", "pnpm exec tsc --noEmit 2>&1 | grep -v known-error | tail -3", "assistant", {
        toolCallId: "masked-typecheck",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "pnpm exec tsc --noEmit 2>&1 | grep -v known-error | tail -3" } },
      }),
      entry(10, "tool_call_update", "completed", "assistant", {
        toolCallId: "masked-typecheck",
        status: "completed",
        raw: { status: "completed", rawOutput: "(Bash completed with no output)" },
      }),
      entry(11, "tool_call_update", "pnpm exec tsc --noEmit 2>&1 | tail -5", "assistant", {
        toolCallId: "failed-piped-typecheck",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "pnpm exec tsc --noEmit 2>&1 | tail -5" } },
      }),
      entry(12, "tool_call_update", "completed", "assistant", {
        toolCallId: "failed-piped-typecheck",
        status: "completed",
        raw: { status: "completed", rawOutput: "tests/example.ts(2,3): error TS2345: Invalid value" },
      }),
    ], null, "/workspace/app");

    expect(result.verification).toEqual([
      {
        command: "pnpm vitest run tests/server/example.test.ts",
        result: "passed",
        exitCode: 0,
        importantOutput: "Test Files 1 passed (1)\nTests 4 passed (4)",
      },
      {
        command: "pnpm exec tsc --noEmit",
        result: "passed",
        exitCode: 0,
        importantOutput: null,
      },
      {
        command: "pnpm exec tsc --noEmit 2>&1 | grep -v known-error | tail -3",
        result: "unknown",
        exitCode: 0,
        importantOutput: null,
      },
      {
        command: "pnpm exec tsc --noEmit 2>&1 | tail -5",
        result: "failed",
        exitCode: 0,
        importantOutput: "tests/example.ts(2,3): error TS2345: Invalid value",
      },
    ]);
  });

  it("records a failed verification once with its exit code", () => {
    const result = selectWorkerEntryCandidates([
      entry(1, "tool_call_update", "pnpm build:interface:web", "assistant", {
        toolCallId: "verify-failed",
        toolKind: "execute",
        raw: { kind: "execute", rawInput: { command: "pnpm build:interface:web" } },
      }),
      entry(2, "tool_call_update", "failed", "assistant", {
        toolCallId: "verify-failed",
        status: "failed",
        raw: {
          status: "failed",
          rawOutput: { formatted_output: "Build failed", exit_code: 2 },
        },
      }),
    ], null, "/workspace/app");

    expect(result.verification).toEqual([{
      command: "pnpm build:interface:web",
      result: "failed",
      exitCode: 2,
      importantOutput: "Build failed",
    }]);
  });
});
