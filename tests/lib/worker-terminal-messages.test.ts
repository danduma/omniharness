import { describe, expect, it } from "vitest";
import { buildDirectTerminalUserMessages, buildWorkerTerminalUserMessages } from "@/lib/worker-terminal-messages";
import type { AgentSnapshot, SupervisorInterventionRecord } from "@/app/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";

function buildWorker(overrides: Partial<ConversationWorkerRecord> = {}): ConversationWorkerRecord {
  return {
    id: "run-1-worker-1",
    runId: "run-1",
    type: "codex",
    status: "working",
    initialPrompt: "Initial supervisor prompt",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:05:00.000Z",
    ...overrides,
  };
}

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

function buildIntervention(overrides: Partial<SupervisorInterventionRecord>): SupervisorInterventionRecord {
  return {
    id: "intervention-1",
    runId: "run-1",
    workerId: "run-1-worker-1",
    interventionType: "continue",
    prompt: "Steer this worker in context",
    createdAt: "2026-05-07T00:04:00.000Z",
    ...overrides,
  };
}

describe("buildWorkerTerminalUserMessages", () => {
  it("keeps worker prompts only when loaded output surrounds their timestamp", () => {
    const messages = buildWorkerTerminalUserMessages({
      worker: buildWorker(),
      agent: buildAgent([
        "2026-05-07T00:00:05.000Z",
        "2026-05-07T00:04:30.000Z",
      ]),
      supervisorInterventions: [
        buildIntervention({ id: "intervention-in-window" }),
      ],
    });

    expect(messages.map((message) => message.id)).toEqual([
      "run-1-worker-1:initial-prompt",
      "intervention-in-window",
    ]);
  });

  it("drops stale supervisor prompts when their surrounding worker output is not loaded", () => {
    const messages = buildWorkerTerminalUserMessages({
      worker: buildWorker(),
      agent: buildAgent([
        "2026-05-07T02:00:00.000Z",
        "2026-05-07T02:01:00.000Z",
      ]),
      supervisorInterventions: [
        buildIntervention({ id: "intervention-stale", createdAt: "2026-05-07T00:04:00.000Z" }),
        buildIntervention({ id: "intervention-visible", createdAt: "2026-05-07T02:00:30.000Z" }),
      ],
    });

    expect(messages.map((message) => message.id)).toEqual(["intervention-visible"]);
  });

  it("drops supervisor prompts that fall inside a broad loaded range without nearby output", () => {
    const messages = buildWorkerTerminalUserMessages({
      worker: buildWorker(),
      agent: buildAgent([
        "2026-05-07T00:00:05.000Z",
        "2026-05-07T04:00:00.000Z",
      ]),
      supervisorInterventions: [
        buildIntervention({
          id: "intervention-between-loaded-ranges",
          createdAt: "2026-05-07T02:00:00.000Z",
        }),
      ],
    });

    expect(messages.map((message) => message.id)).toEqual(["run-1-worker-1:initial-prompt"]);
  });

  it("does not render prompt bubbles before any worker output context exists", () => {
    const messages = buildWorkerTerminalUserMessages({
      worker: buildWorker(),
      agent: buildAgent([]),
      supervisorInterventions: [
        buildIntervention({ id: "intervention-no-context" }),
      ],
    });

    expect(messages).toEqual([]);
  });
});

describe("buildDirectTerminalUserMessages", () => {
  it("drops stale direct prompts when compacted output no longer includes their surrounding worker activity", () => {
    const messages = buildDirectTerminalUserMessages({
      messages: [
        {
          id: "initial-prompt",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Group all modified files into commits as they fit best",
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
        "2026-05-09T10:30:05.563Z",
        "2026-05-09T10:30:18.423Z",
      ]),
    });

    expect(messages.map((message) => message.id)).toEqual(["follow-up"]);
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
