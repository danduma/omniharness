import { describe, expect, it } from "vitest";
import {
  deriveVisibleWorkerTerminalProcesses,
  deriveWorkerTerminalProcesses,
  isActiveWorkerTerminalProcess,
} from "@/lib/worker-terminal-processes";
import type { AgentOutputEntry } from "@/lib/agent-output";

describe("worker terminal process derivation", () => {
  it("merges ACP terminal tool calls into a single recent process", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "start-1",
        type: "tool_call",
        text: "Terminal",
        timestamp: "2026-05-03T00:00:00.000Z",
        toolCallId: "tool-1",
        toolKind: "execute",
        status: "in_progress",
        raw: {
          kind: "execute",
          rawInput: {
            command: "pnpm test tests/api/agent-route.test.ts",
          },
        },
      },
      {
        id: "update-1",
        type: "tool_call_update",
        text: "Tool call tool-1 completed",
        timestamp: "2026-05-03T00:00:02.000Z",
        toolCallId: "tool-1",
        status: "completed",
        raw: {
          rawOutput: {
            exit_code: 0,
            formatted_output: "PASS tests/api/agent-route.test.ts\n",
          },
        },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)).toEqual([
      {
        id: "tool-1",
        command: "pnpm test tests/api/agent-route.test.ts",
        processId: null,
        status: "completed",
        startedAt: "2026-05-03T00:00:00.000Z",
        updatedAt: "2026-05-03T00:00:02.000Z",
        outputTail: "PASS tests/api/agent-route.test.ts",
        toolKind: "execute",
        active: false,
      },
    ]);
  });

  it("keeps active command rows ahead of older completed rows", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "start-old",
        type: "tool_call",
        text: "Terminal",
        timestamp: "2026-05-03T00:00:00.000Z",
        toolCallId: "old",
        toolKind: "execute",
        status: "completed",
        raw: { rawInput: { command: "pnpm lint" } },
      },
      {
        id: "start-active",
        type: "tool_call",
        text: "Terminal",
        timestamp: "2026-05-03T00:00:01.000Z",
        toolCallId: "active",
        toolKind: "execute",
        status: "running",
        raw: { command: "pnpm dev" },
      },
    ];

    const processes = deriveWorkerTerminalProcesses(outputEntries);

    expect(processes.map((process) => process.id)).toEqual(["active", "old"]);
    expect(isActiveWorkerTerminalProcess(processes[0])).toBe(true);
  });

  it("hides stale active command rows once the worker is no longer active", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "start-active",
        type: "tool_call",
        text: "Terminal",
        timestamp: "2026-05-03T00:00:01.000Z",
        toolCallId: "active",
        toolKind: "execute",
        status: "running",
        raw: { command: "pnpm dev" },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)).toHaveLength(1);
    expect(deriveVisibleWorkerTerminalProcesses(outputEntries, "cancelled")).toEqual([]);
    expect(deriveVisibleWorkerTerminalProcesses(outputEntries, "error")).toEqual([]);
    expect(deriveVisibleWorkerTerminalProcesses(outputEntries, "working")).toHaveLength(1);
  });

  it("hides completed command rows from the running terminal list while the worker is active", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "start-completed",
        type: "tool_call",
        text: "Terminal",
        timestamp: "2026-05-03T00:00:01.000Z",
        toolCallId: "completed",
        toolKind: "execute",
        status: "completed",
        raw: { command: "pnpm test" },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)).toHaveLength(1);
    expect(deriveVisibleWorkerTerminalProcesses(outputEntries, "working")).toEqual([]);
  });

  it("formats shell command arrays and surfaces CLI process handles when provided", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "start-active",
        type: "tool_call",
        text: "Terminal",
        timestamp: "2026-05-03T00:00:01.000Z",
        toolCallId: "active",
        toolKind: "execute",
        status: "running",
        raw: {
          kind: "execute",
          rawInput: {
            process_id: "93230",
            command: ["/bin/zsh", "-lc", "pnpm dev"],
          },
        },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)[0]).toMatchObject({
      command: "/bin/zsh -lc 'pnpm dev'",
      processId: "93230",
    });
  });

  it("extracts failed command output from ACP tool response metadata", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "start-1",
        type: "tool_call",
        text: "Shell",
        timestamp: "2026-05-03T00:00:00.000Z",
        toolCallId: "tool-1",
        toolKind: "shell",
        status: "pending",
        raw: {
          cmd: "pnpm exec tsc --noEmit",
        },
      },
      {
        id: "update-1",
        type: "tool_call_update",
        text: "Tool call tool-1 failed",
        timestamp: "2026-05-03T00:00:03.000Z",
        toolCallId: "tool-1",
        status: "failed",
        raw: {
          _meta: {
            claudeCode: {
              toolResponse: {
                stderr: "src/server/agent-runtime/manager.ts(1,1): error TS1005\n",
              },
            },
          },
        },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)[0]).toMatchObject({
      command: "pnpm exec tsc --noEmit",
      status: "failed",
      outputTail: "src/server/agent-runtime/manager.ts(1,1): error TS1005",
      active: false,
    });
  });

  it("ignores non-terminal tools even when file names or adapter internals mention terminals", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "read-1",
        type: "tool_call",
        text: "Read Terminal.tsx",
        timestamp: "2026-05-03T00:00:00.000Z",
        toolCallId: "read-1",
        toolKind: "read",
        status: "in_progress",
        raw: {
          title: "Read Terminal.tsx",
          rawInput: {
            command: ["/bin/zsh", "-lc", "sed -n '1,260p' Terminal.tsx"],
            path: "/tmp/Terminal.tsx",
          },
        },
      },
      {
        id: "edit-1",
        type: "tool_call",
        text: "Edit /workspace/tests/ui/terminal-fit.test.ts",
        timestamp: "2026-05-03T00:00:01.000Z",
        toolCallId: "edit-1",
        toolKind: "edit",
        status: "in_progress",
        raw: {
          title: "Edit /workspace/tests/ui/terminal-fit.test.ts",
          rawInput: {
            path: "/workspace/tests/ui/terminal-fit.test.ts",
            text: "Success. Updated the following files: M tests/ui/terminal-fit.test.ts",
          },
        },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)).toEqual([]);
  });

  it("does not create terminal processes from completed sparse read and search updates", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "read-update",
        type: "tool_call_update",
        text: "Tool call call_read completed",
        timestamp: "2026-05-03T00:00:00.000Z",
        toolCallId: "call_read",
        toolKind: null,
        status: "completed",
        raw: {
          rawOutput: {
            process_id: "52769",
            command: ["/bin/zsh", "-lc", "sed -n '1,240p' tests/ui/composer-shell.test.ts"],
            parsed_cmd: [
              {
                type: "read",
                cmd: "sed -n '1,240p' tests/ui/composer-shell.test.ts",
                path: "tests/ui/composer-shell.test.ts",
              },
            ],
            status: "completed",
          },
          status: "completed",
        },
      },
      {
        id: "search-update",
        type: "tool_call_update",
        text: "Tool call call_search completed",
        timestamp: "2026-05-03T00:00:01.000Z",
        toolCallId: "call_search",
        toolKind: null,
        status: "completed",
        raw: {
          rawOutput: {
            process_id: "47045",
            command: ["/bin/zsh", "-lc", "rg -n \"PopoverPrimitive|DropdownMenu|Dialog\" src/components"],
            parsed_cmd: [
              {
                type: "search",
                cmd: "rg -n \"PopoverPrimitive|DropdownMenu|Dialog\" src/components",
                query: "PopoverPrimitive|DropdownMenu|Dialog",
              },
            ],
            status: "completed",
          },
          status: "completed",
        },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)).toEqual([]);
  });
});
