import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeMutations } from "@/interface/home/useHomeMutations";
import { homeUiStateManager, homeUiSetters } from "@/interface/home/HomeUiStateManager";

// Drive the real mutation callbacks without mounting the home screen.
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useMutation: (options: unknown) => ({ ...(options as object), mutate: vi.fn() }),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
}));

const create = vi.fn(async (_input: Record<string, unknown>) => ({ runId: "run-new" }));
const sendTo = vi.fn(async (_input: { runId: string; body: Record<string, unknown> }) => ({ ok: true }));
vi.mock("@/runtime-api/provider", () => ({
  useRuntimeAPIs: () => ({ conversations: { create, sendTo }, files: {} }),
}));

type MutationInternals = {
  mutate: { mockImplementation(fn: (variables: unknown) => void): void };
  onMutate?: (variables: unknown) => unknown;
  mutationFn?: (variables: unknown, context?: unknown) => Promise<unknown>;
};
type Mutations = ReturnType<typeof useHomeMutations>;
type LaunchVariables = { requestedRunId: string; launch: { model: string | null } };

const internals = (mutation: unknown) => mutation as unknown as MutationInternals;

function buildMutations(overrides: Record<string, unknown> = {}) {
  return useHomeMutations({
    state: { workers: [] },
    setState: () => {},
    selectedRunId: null,
    selectedCliAgent: "claude",
    selectedWorkerAccountId: "auto",
    selectedConversationMode: "direct",
    selectedModel: "claude-fable-5-1",
    selectedEffort: "High",
    autoSelectedWorkerType: "claude",
    activeAllowedWorkerTypes: ["claude"],
    activeWorkerModelValues: ["claude-opus-5", "claude-fable-5-1"],
    renamingRunId: null,
    pendingDeletedRunIdsRef: { current: new Set() },
    pendingCreatedConversationSnapshotsRef: { current: new Map() },
    loadingWorkerHistoryIdsRef: { current: new Set() },
    scrollConversationToBottom: () => {},
    sessionQueryRefetch: async () => undefined,
    ...overrides,
  } as unknown as Parameters<typeof useHomeMutations>[0]) as Mutations;
}

let runCounter = 0;

function launchOf(mutations: Mutations) {
  let captured: unknown;
  internals(mutations.runCommand).mutate.mockImplementation((variables) => {
    captured = variables;
  });
  mutations.startConversation({
    content: "start here",
    attachments: [],
    projectPath: null,
    requestedRunId: `run-new-${++runCounter}`,
  });
  return captured as LaunchVariables;
}

describe("a conversation launches on the model the composer is showing", () => {
  beforeEach(() => {
    create.mockClear();
    sendTo.mockClear();
    // The composer state the hook parameters above are derived from in the app.
    homeUiSetters.setSelectedRunId(null);
    homeUiStateManager.setComposerWorkerSelection("claude", "claude-fable-5-1");
  });

  it("sends the model that was selected, not the one the composer resets to", async () => {
    const mutations = buildMutations();
    const variables = launchOf(mutations);
    expect(variables.launch.model).toBe("claude-fable-5-1");

    // Selecting the new conversation replaces the composer's selection with the
    // draftless-run defaults, React re-renders, and React Query reads the
    // request builder off that newer render. The request must not notice.
    internals(mutations.runCommand).onMutate?.(variables);
    homeUiStateManager.setComposerSelectionField("model", "claude-opus-5", { userEdited: false });
    const afterComposerReset = buildMutations({ selectedModel: "claude-opus-5", selectedCliAgent: "auto" });

    await internals(afterComposerReset.runCommand).mutationFn?.(variables);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      preferredWorkerType: "claude",
      preferredWorkerModel: "claude-fable-5-1",
      preferredWorkerEffort: "high",
    });
  });

  it("hands the launch selection to the conversation it created", () => {
    const mutations = buildMutations();
    const variables = launchOf(mutations);

    internals(mutations.runCommand).onMutate?.(variables);

    expect(homeUiStateManager.getSnapshot()).toMatchObject({
      selectedRunId: variables.requestedRunId,
      selectedCliAgent: "claude",
      selectedModel: "claude-fable-5-1",
    });
  });

  it("gives the created conversation a draft that already knows its model", () => {
    const mutations = buildMutations();
    const variables = launchOf(mutations);

    internals(mutations.runCommand).onMutate?.(variables);

    expect(homeUiStateManager.getSnapshot().composerDraftsByRun[variables.requestedRunId]?.selection)
      .toMatchObject({ worker: "claude", model: "claude-fable-5-1" });
  });

  it("omits the model from a send instead of resetting the conversation's own", async () => {
    const mutations = buildMutations();

    await internals(mutations.sendConversationMessage).mutationFn?.({
      runId: "run-existing",
      content: "second message",
      clientMessageId: "msg-2",
      attachments: [],
      launch: {
        conversationMode: "direct",
        workerType: "claude",
        isAutoWorkerSelection: true,
        model: null,
        effort: "high",
        accountId: null,
        allowedWorkerTypes: ["claude"],
      },
    });

    expect(sendTo.mock.calls[0][0].runId).toBe("run-existing");
    expect(sendTo.mock.calls[0][0].body).not.toHaveProperty("preferredWorkerModel");
  });
});
