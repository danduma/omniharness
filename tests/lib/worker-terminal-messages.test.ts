import { describe, expect, it } from "vitest";
import { buildDirectTerminalUserMessages } from "@/lib/worker-terminal-messages";
import type { AgentSnapshot } from "@/interface/home/types";

function buildAgent(outputTimestamps: string[]): AgentSnapshot {
  return {
    name: "run-1-worker-1",
    type: "codex",
    state: "working",
    outputEntries: outputTimestamps.map((timestamp, index) => ({
      id: `entry-${index}`,
      type: "tool_call",
      text: `Tool ${index}`,
      timestamp,
    })),
  };
}

describe("buildDirectTerminalUserMessages", () => {
  it("keeps direct prompts even when a rerun worker output is far newer than the original prompt", () => {
    const messages = buildDirectTerminalUserMessages({
      messages: [
        {
          id: "initial-prompt",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Group all currently modified files into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop.",
          createdAt: "2026-05-09T09:12:12.000Z",
        },
        {
          id: "follow-up",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "yes add tmp to gitignore. check what else should go in there too",
          createdAt: "2026-05-09T10:26:30.000Z",
        },
      ],
      agent: buildAgent([
        "2026-05-09T12:30:05.563Z",
        "2026-05-09T12:30:18.423Z",
      ]),
    });

    expect(messages.map((message) => message.id)).toEqual(["initial-prompt", "follow-up"]);
  });

  it("keeps direct prompts while no worker output has loaded yet", () => {
    const messages = buildDirectTerminalUserMessages({
      messages: [
        {
          id: "pending-prompt",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Start the task",
          createdAt: "2026-05-09T10:00:00.000Z",
        },
      ],
      agent: buildAgent([]),
    });

    expect(messages.map((message) => message.id)).toEqual(["pending-prompt"]);
  });
});
