import { describe, expect, it } from "vitest";
import { resolveNewConversationWorkerSelection, resolveRunComposerSelection } from "@/interface/home/useRunSelectionEffects";
import { buildOptimisticCreatedConversationSnapshot } from "@/interface/home/utils";
import type { RunRecord, WorkerModelCatalog } from "@/interface/home/types";

function createRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run-1",
    planId: "plan-1",
    mode: "direct",
    status: "running",
    createdAt: "2026-07-11T12:00:00.000Z",
    projectPath: null,
    title: "Claude conversation",
    ...overrides,
  };
}

describe("resolveRunComposerSelection", () => {
  it("restores the account saved on a reopened conversation", () => {
    const selection = resolveRunComposerSelection({
      run: createRun({
        preferredWorkerType: "claude",
        preferredWorkerModel: "claude-opus-4-8",
        preferredWorkerEffort: "high",
        preferredWorkerAccountId: "claude-sub-1",
      }),
      activeAllowedWorkerTypes: ["claude"],
    });

    expect(selection.accountId).toBe("claude-sub-1");
  });
  it("resolves the launched model from the conversation's optimistic placeholder", () => {
    const snapshot = buildOptimisticCreatedConversationSnapshot({
      runId: "run-new",
      content: "start here",
      projectPath: null,
      mode: "direct",
      preferredWorkerType: "claude",
      preferredWorkerModel: "claude-fable-5-1",
      preferredWorkerEffort: "high",
      preferredWorkerAccountId: null,
    });

    const selection = resolveRunComposerSelection({
      run: snapshot.run as RunRecord,
      activeAllowedWorkerTypes: ["claude"],
    });

    expect(selection).toMatchObject({ worker: "claude", model: "claude-fable-5-1", effort: "High" });
  });
});

describe("resolveNewConversationWorkerSelection", () => {
  const catalog: Partial<WorkerModelCatalog> = {
    codex: [
      { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { value: "gpt-5.5", label: "GPT-5.5" },
    ],
    claude: [
      { value: "claude-opus-5", label: "Opus 5" },
      { value: "claude-sonnet-5", label: "Sonnet 5" },
    ],
  };

  function resolve(overrides: Partial<Parameters<typeof resolveNewConversationWorkerSelection>[0]> = {}) {
    return resolveNewConversationWorkerSelection({
      composerMode: "direct",
      selectedCliAgent: "auto",
      selectedModel: "gpt-5.6-sol",
      autoSelectedWorkerType: "codex",
      activeAllowedWorkerTypes: ["codex", "claude"],
      workerModelCatalog: catalog,
      workerModelsRefreshing: false,
      ...overrides,
    });
  }

  it("drops a model belonging to a worker the runner no longer offers", () => {
    expect(resolve({
      selectedCliAgent: "claude",
      selectedModel: "claude-opus-5",
      activeAllowedWorkerTypes: ["codex"],
    })).toEqual({ worker: "codex", model: "gpt-5.6-sol" });
  });

  it("heals a persisted pairing whose worker is already correct", () => {
    expect(resolve({
      selectedCliAgent: "codex",
      selectedModel: "claude-opus-5",
    })).toEqual({ worker: "codex", model: "gpt-5.6-sol" });
  });

  it("leaves an unrecognized model alone while the catalogue is still refreshing", () => {
    expect(resolve({
      selectedCliAgent: "codex",
      selectedModel: "gpt-6-astra",
      workerModelsRefreshing: true,
    })).toBeNull();
  });

  it("leaves an unrecognized model alone before the catalogue has been discovered", () => {
    expect(resolve({
      selectedCliAgent: "codex",
      selectedModel: "gpt-6-astra",
      workerModelCatalog: {},
    })).toBeNull();
  });

  it("resolves direct mode off auto and onto that worker's own model", () => {
    expect(resolve({
      selectedCliAgent: "auto",
      selectedModel: "claude-opus-5",
    })).toEqual({ worker: "codex", model: "gpt-5.6-sol" });
  });

  it("keeps a model the resolved worker can actually run", () => {
    expect(resolve({
      selectedCliAgent: "claude",
      selectedModel: "claude-opus-5",
    })).toBeNull();
  });

  it("returns auto to the omni composer when its worker disappears", () => {
    expect(resolve({
      composerMode: "omni",
      selectedCliAgent: "claude",
      selectedModel: "claude-opus-5",
      activeAllowedWorkerTypes: ["codex"],
    })).toEqual({ worker: "auto", model: "gpt-5.6-sol" });
  });
});
