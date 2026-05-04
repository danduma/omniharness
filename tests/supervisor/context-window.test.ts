import { describe, expect, it } from "vitest";
import {
  buildSupervisorModelMessages,
  estimateContextTokens,
  type SupervisorTurnContextForPrompt,
} from "@/server/supervisor/context-window";

function baseContext(overrides: Partial<SupervisorTurnContextForPrompt> = {}): SupervisorTurnContextForPrompt {
  return {
    runId: "run-1",
    projectPath: "/tmp/project",
    goal: "Implement the feature.",
    planPath: "/tmp/project/docs/plan.md",
    planContent: "# Plan\n\n- [ ] Implement the feature",
    preferredWorkerType: "codex",
    allowedWorkerTypes: ["codex"],
    recentUserMessages: ["Implement the feature."],
    pendingClarifications: [],
    answeredClarifications: [],
    activeWorkers: [],
    recentEvents: [],
    readFiles: [],
    compactedMemory: null,
    ...overrides,
  };
}

describe("supervisor context window compaction", () => {
  it("builds a summary-first decision brief while it is under budget", () => {
    const bundle = buildSupervisorModelMessages({
      systemPrompt: "system",
      context: baseContext({
        recentUserMessages: ["first instruction", "latest instruction"],
      }),
      heartbeatCount: 2,
      runStatus: "running",
      budget: {
        maxContextTokens: 2_000,
        responseReserveTokens: 200,
        compactionThreshold: 0.8,
      },
    });

    expect(bundle.stats.compacted).toBe(false);
    expect(bundle.messages.map((message) => message.role)).toEqual(["system", "system"]);
    const rendered = bundle.messages.map((message) => message.content).join("\n\n");
    expect(rendered).toContain("Supervisor decision brief");
    expect(rendered).toContain("Original prompt");
    expect(rendered).toContain("Conversation turns with the user");
    expect(rendered).toContain("first instruction");
    expect(rendered).toContain("latest instruction");
    expect(bundle.messages.some((message) => message.content.includes("Prior supervision memory"))).toBe(false);
  });

  it("adds objective and plan context as a supervisor-owned completion gate", () => {
    const bundle = buildSupervisorModelMessages({
      systemPrompt: "system",
      context: baseContext({
        goal: "Make the importer support resumable uploads.",
        planPath: "/tmp/project/docs/plans/importer.md",
        planContent: "# Importer Plan\n\n## Objective\n\nSupport resumable uploads.\n\n## Checklist\n\n- [ ] Add storage",
      }),
      heartbeatCount: 1,
      runStatus: "running",
      budget: {
        maxContextTokens: 4_000,
        responseReserveTokens: 200,
        compactionThreshold: 0.8,
      },
    });

    const rendered = bundle.messages.map((message) => message.content).join("\n\n");
    expect(rendered).toContain("Supervisor-owned objective");
    expect(rendered).toContain("Make the importer support resumable uploads.");
    expect(rendered).toContain("Plan artifact");
    expect(rendered).toContain("/tmp/project/docs/plans/importer.md");
    expect(rendered).toContain("Support resumable uploads.");
  });

  it("summarizes supervisor-read files without dumping raw file bodies", () => {
    const bundle = buildSupervisorModelMessages({
      systemPrompt: "system",
      context: baseContext({
        readFiles: [{
          path: "docs/superpowers/specs/handoff.md",
          content: [
            "# Handoff",
            "",
            "The outcome is a reviewed plan handoff before implementation.",
            "background filler ".repeat(2_000),
          ].join("\n"),
          truncated: false,
        }],
      }),
      heartbeatCount: 1,
      runStatus: "running",
      budget: {
        maxContextTokens: 4_000,
        responseReserveTokens: 200,
        compactionThreshold: 0.8,
      },
    });

    const rendered = bundle.messages.map((message) => message.content).join("\n\n");
    expect(rendered).toContain("Reusable supervisor notes");
    expect(rendered).toContain("docs/superpowers/specs/handoff.md");
    expect(rendered).toContain("reviewed plan handoff before implementation");
    expect(rendered).not.toContain("background filler ".repeat(100));
  });

  it("compacts old user messages into memory and keeps the latest instruction in the decision brief", () => {
    const largeOldInstruction = "old context ".repeat(1_000);
    const latestInstruction = "Now verify the final implementation path.";
    const bundle = buildSupervisorModelMessages({
      systemPrompt: "system",
      context: baseContext({
        goal: `${largeOldInstruction}\n\n${latestInstruction}`,
        recentUserMessages: [
          largeOldInstruction,
          "second old context ".repeat(900),
          latestInstruction,
        ],
      }),
      heartbeatCount: 3,
      runStatus: "running",
      budget: {
        maxContextTokens: 700,
        responseReserveTokens: 100,
        compactionThreshold: 0.6,
      },
    });

    expect(bundle.stats.compacted).toBe(true);
    expect(bundle.messages.some((message) => message.content.includes("Prior supervision memory"))).toBe(true);
    expect(bundle.messages.map((message) => message.content).join("\n\n")).toContain(latestInstruction);
    expect(estimateContextTokens(bundle.messages)).toBeLessThanOrEqual(bundle.stats.budgetTokens);
  });

  it("filters low-signal wait events from event detail while retaining actionable events", () => {
    const bundle = buildSupervisorModelMessages({
      systemPrompt: "system",
      context: baseContext({
        recentEvents: [
          { eventType: "supervisor_wait", summary: "check again soon", createdAt: "2026-05-04T01:00:02.000Z" },
          { eventType: "worker_stopped", summary: "worker-1 stopped after verifying tests passed", createdAt: "2026-05-04T01:00:01.000Z", workerId: "worker-1" },
          { eventType: "supervisor_wait", summary: "poll", createdAt: "2026-05-04T01:00:00.000Z" },
        ],
      }),
      heartbeatCount: 1,
      runStatus: "running",
      budget: {
        maxContextTokens: 4_000,
        responseReserveTokens: 200,
        compactionThreshold: 0.8,
      },
    });

    const rendered = bundle.messages.map((message) => message.content).join("\n\n");
    expect(rendered).toContain("Omitted low-signal poll/wait events from detail: 2");
    expect(rendered).toContain("worker_stopped");
    expect(rendered).toContain("worker-1 stopped after verifying tests passed");
    expect(rendered).not.toContain("check again soon");
  });

  it("carries forward existing memory and shrinks noisy worker observations first", () => {
    const noisyWorkerText = "worker output ".repeat(2_000);
    const bundle = buildSupervisorModelMessages({
      systemPrompt: "system",
      context: baseContext({
        compactedMemory: "Earlier summary: worker fixed the API route.",
        activeWorkers: [{
          workerId: "worker-1",
          type: "codex",
          status: "working",
          purpose: "main implementation",
          silenceMs: 42,
          currentText: noisyWorkerText,
          lastText: noisyWorkerText,
          stderrTail: noisyWorkerText,
          stopReason: null,
        }],
      }),
      heartbeatCount: 4,
      runStatus: "running",
      budget: {
        maxContextTokens: 650,
        responseReserveTokens: 100,
        compactionThreshold: 0.6,
      },
    });

    const rendered = bundle.messages.map((message) => message.content).join("\n");
    expect(bundle.stats.compacted).toBe(true);
    expect(rendered).toContain("Earlier summary: worker fixed the API route.");
    expect(rendered.length).toBeLessThan(noisyWorkerText.length);
    expect(estimateContextTokens(bundle.messages)).toBeLessThanOrEqual(bundle.stats.budgetTokens);
  });
});
