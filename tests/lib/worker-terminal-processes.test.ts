import { describe, expect, it } from "vitest";
import {
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

  it("ignores non-terminal tools unless a command-like input is present", () => {
    const outputEntries: AgentOutputEntry[] = [
      {
        id: "read-1",
        type: "tool_call",
        text: "Read File",
        timestamp: "2026-05-03T00:00:00.000Z",
        toolCallId: "read-1",
        toolKind: "read",
        status: "completed",
        raw: {
          rawInput: {
            path: "/tmp/example.ts",
          },
        },
      },
    ];

    expect(deriveWorkerTerminalProcesses(outputEntries)).toEqual([]);
  });
});
