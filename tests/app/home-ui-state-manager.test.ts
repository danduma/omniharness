import { describe, expect, it } from "vitest";
import { HomeUiStateManager } from "@/interface/home/HomeUiStateManager";
import { PROJECT_SESSION_DISPLAY_BATCH_SIZE } from "@/interface/home/constants";

describe("HomeUiStateManager", () => {
  it("tracks project session reveal counts without persisting them as collapsed state", () => {
    const manager = new HomeUiStateManager();
    const controls = manager as unknown as {
      revealMoreProjectSessions?: (projectPath: string) => void;
      resetProjectSessionDisplayLimit?: (projectPath: string) => void;
    };

    expect(manager.getSnapshot().visibleProjectSessionCounts).toEqual({});
    expect(typeof controls.revealMoreProjectSessions).toBe("function");
    expect(typeof controls.resetProjectSessionDisplayLimit).toBe("function");

    controls.revealMoreProjectSessions?.("/workspace/app");
    expect(manager.getSnapshot().visibleProjectSessionCounts["/workspace/app"]).toBe(
      PROJECT_SESSION_DISPLAY_BATCH_SIZE * 2,
    );

    manager.setKey("collapsedProjectPaths", new Set(["/workspace/app"]));
    expect(manager.getSnapshot().visibleProjectSessionCounts["/workspace/app"]).toBe(
      PROJECT_SESSION_DISPLAY_BATCH_SIZE * 2,
    );

    controls.resetProjectSessionDisplayLimit?.("/workspace/app");
    expect(manager.getSnapshot().visibleProjectSessionCounts).toEqual({});
  });

  it("collapses projects without resetting session counts for unrelated groups", () => {
    const manager = new HomeUiStateManager();
    manager.revealMoreProjectSessions("/workspace/app");
    manager.revealMoreProjectSessions("/workspace/other");

    manager.collapseProjects(["/workspace/app"]);

    const snapshot = manager.getSnapshot();
    expect(snapshot.collapsedProjectPaths).toEqual(new Set(["/workspace/app"]));
    expect(snapshot.visibleProjectSessionCounts).toEqual({
      "/workspace/other": PROJECT_SESSION_DISPLAY_BATCH_SIZE * 2,
    });
  });

  it("defaults selectedConversationMode to 'direct'", () => {
    const manager = new HomeUiStateManager();
    expect(manager.getSnapshot().selectedConversationMode).toBe("direct");
  });

  it("updates composer command and cursor with a single notification", () => {
    const manager = new HomeUiStateManager();
    let notifications = 0;
    manager.subscribe(() => {
      notifications += 1;
    });

    manager.setComposerDraft({ command: "hello", commandCursor: 5 });

    expect(manager.getSnapshot().command).toBe("hello");
    expect(manager.getSnapshot().commandCursor).toBe(5);
    expect(notifications).toBe(1);
  });

  it("restores saved composer drafts when switching between selected runs", () => {
    const manager = new HomeUiStateManager();

    manager.selectRun("run-a");
    manager.setComposerDraft({ command: "draft for A", commandCursor: 11 });
    manager.selectRun("run-b");
    manager.setComposerDraft({ command: "draft for B", commandCursor: 7 });
    manager.selectRun("run-a");

    expect(manager.getSnapshot().command).toBe("draft for A");
    expect(manager.getSnapshot().commandCursor).toBe(11);
  });

  it("restores each session's unsent worker selection atomically with its draft", () => {
    const manager = new HomeUiStateManager();

    manager.selectRun("run-a");
    manager.setComposerSelectionField("model", "model-a");
    manager.setComposerSelectionField("effort", "Max");
    manager.selectRun("run-b");
    manager.setComposerSelectionField("model", "model-b");
    manager.setComposerSelectionField("effort", "Low");
    manager.selectRun("run-a");

    expect(manager.getSnapshot()).toMatchObject({ selectedModel: "model-a", selectedEffort: "Max" });
  });

  it("hydrates newer server preferences without overwriting unacknowledged user fields", () => {
    const manager = new HomeUiStateManager();
    manager.selectRun("run-a");
    manager.hydrateComposerSelection({
      runId: "run-a",
      selection: { conversationMode: "direct", worker: "codex", accountId: "auto", model: "old", effort: "High" },
      serverVersion: "1",
    });
    manager.setComposerSelectionField("effort", "Max");
    manager.hydrateComposerSelection({
      runId: "run-a",
      selection: { conversationMode: "direct", worker: "claude", accountId: "auto", model: "new", effort: "Low" },
      serverVersion: "2",
    });

    expect(manager.getSnapshot()).toMatchObject({
      selectedCliAgent: "claude",
      selectedModel: "new",
      selectedEffort: "Max",
    });
  });

  it("restores clean server-hydrated selections immediately when switching sessions", () => {
    const manager = new HomeUiStateManager();
    manager.selectRun("run-a");
    manager.hydrateComposerSelection({
      runId: "run-a",
      selection: { conversationMode: "direct", worker: "codex", accountId: "auto", model: "model-a", effort: "High" },
      serverVersion: "1",
    });
    manager.selectRun("run-b");
    manager.hydrateComposerSelection({
      runId: "run-b",
      selection: { conversationMode: "direct", worker: "claude", accountId: "account-b", model: "model-b", effort: "Low" },
      serverVersion: "1",
    });

    manager.selectRun("run-a");

    expect(manager.getSnapshot()).toMatchObject({
      selectedCliAgent: "codex",
      selectedWorkerAccountId: "auto",
      selectedModel: "model-a",
      selectedEffort: "High",
      hydratedRunSelectionId: "run-a",
    });
  });

  it("clears a dirty selection that returns to the unchanged server value", () => {
    const manager = new HomeUiStateManager();
    const baseline = { conversationMode: "direct", worker: "codex", accountId: "auto", model: "model-a", effort: "High" } as const;
    manager.selectRun("run-a");
    manager.hydrateComposerSelection({ runId: "run-a", selection: baseline, serverVersion: "1" });
    manager.setComposerSelectionField("model", "model-b");
    manager.setComposerSelectionField("model", "model-a");

    expect(manager.getSnapshot().composerDraftsByRun["run-a"]?.dirtySelectionFields).not.toContain("model");
  });

  it("changes worker and its compatible model atomically", () => {
    const manager = new HomeUiStateManager();
    manager.setComposerSelectionField("worker", "codex");
    manager.setComposerSelectionField("model", "gpt-5.6-sol");
    let notifications = 0;
    manager.subscribe(() => {
      notifications += 1;
    });

    manager.setComposerWorkerSelection("claude", "claude-opus-5");

    expect(manager.getSnapshot()).toMatchObject({
      selectedCliAgent: "claude",
      selectedModel: "claude-opus-5",
    });
    expect(manager.getSnapshot().composerDraftsByRun.__new__?.selection).toMatchObject({
      worker: "claude",
      model: "claude-opus-5",
    });
    expect(manager.getSnapshot().composerDraftsByRun.__new__?.dirtySelectionFields).toEqual(
      expect.arrayContaining(["worker", "model"]),
    );
    expect(notifications).toBe(1);
  });
  it("keeps the launch selection on the conversation it just created", () => {
    const manager = new HomeUiStateManager();
    manager.setComposerWorkerSelection("claude", "claude-fable-5-1");

    manager.adoptSelectionForCreatedRun("run-new");
    manager.selectRun("run-new");

    expect(manager.getSnapshot()).toMatchObject({
      selectedCliAgent: "claude",
      selectedModel: "claude-fable-5-1",
    });
  });

  it("leaves an existing conversation draft alone", () => {
    const manager = new HomeUiStateManager();
    manager.selectRun("run-a");
    manager.setComposerSelectionField("model", "claude-fable-5-1");
    manager.selectRun(null);
    manager.setComposerSelectionField("model", "claude-opus-5");

    manager.adoptSelectionForCreatedRun("run-a");

    expect(manager.getSnapshot().composerDraftsByRun["run-a"]?.selection.model).toBe("claude-fable-5-1");
  });
});
