import { beforeEach, describe, expect, it } from "vitest";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import { applyHomeBootstrap } from "@/interface/home/home-bootstrap";
import { homeUiStateManager } from "@/interface/home/HomeUiStateManager";
import { settingsDraftManager } from "@/interface/home/SettingsDraftManager";
import { DEFAULT_SERVER_SETTINGS } from "@/interface/home/constants";

let bootstrapSequence = 0;

function bootstrapFor(
  runnerInstanceId: string,
  settingsValues: Record<string, string> | null,
  options: { selectedRunId?: string; draftProjectPath?: string | null; runProjectPaths?: string[] } = {},
): HomeBootstrapPayload {
  bootstrapSequence += 1;
  return {
    id: `bootstrap-${bootstrapSequence}`,
    route: {
      selectedRunId: options.selectedRunId ?? null,
      draftProjectPath: options.draftProjectPath ?? null,
      pairTokenFromUrl: null,
    },
    initialEventState: options.runProjectPaths
      ? {
        runs: options.runProjectPaths.map((projectPath, index) => ({ id: `run-${index}`, projectPath })),
      } as unknown as HomeBootstrapPayload["initialEventState"]
      : null,
    initialLastEventId: "",
    initialQueries: {
      session: null,
      settings: settingsValues === null
        ? null
        : {
          values: settingsValues,
          secrets: {},
          diagnostics: [],
          resourceSnapshot: null,
        } as unknown as HomeBootstrapPayload["initialQueries"]["settings"],
    },
    features: { unifiedWorkerStream: true },
    runner: {
      runnerInstanceId,
      name: runnerInstanceId,
      version: "0.0.0",
      apiRevision: { minimum: 1, current: 1 } as never,
      capabilities: [],
      bridgeState: "ready",
      readinessState: "ready",
      streamEpoch: "1",
    },
  };
}

function projectsOf() {
  return homeUiStateManager.getSnapshot().apiKeys.PROJECTS;
}

describe("applyHomeBootstrap runner scoping", () => {
  beforeEach(() => {
    homeUiStateManager.patch({ apiKeys: { ...DEFAULT_SERVER_SETTINGS } }, false);
  });

  it("replaces the project list when the bootstrap comes from a different server", () => {
    applyHomeBootstrap(
      bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]', OTHER_KEY: "a-only" }),
      false,
    );
    expect(projectsOf()).toBe('["/work/alpha"]');

    applyHomeBootstrap(
      bootstrapFor("runner-b", { PROJECTS: '["/srv/beta"]' }),
      false,
    );

    expect(projectsOf()).toBe('["/srv/beta"]');
    expect(homeUiStateManager.getSnapshot().apiKeys.OTHER_KEY).toBeUndefined();
  });

  it("clears the previous server's projects when the new server has none of its own", () => {
    applyHomeBootstrap(
      bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' }),
      false,
    );
    expect(projectsOf()).toBe('["/work/alpha"]');

    // A server that has never saved settings returns no PROJECTS row at all.
    applyHomeBootstrap(bootstrapFor("runner-b", {}), false);

    expect(projectsOf()).toBe(DEFAULT_SERVER_SETTINGS.PROJECTS);
  });

  it("clears the previous server's projects when the new server is still locked", () => {
    applyHomeBootstrap(
      bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' }),
      false,
    );

    applyHomeBootstrap(bootstrapFor("runner-b", null), false);

    expect(projectsOf()).toBe(DEFAULT_SERVER_SETTINGS.PROJECTS);
    expect(settingsDraftManager.getSnapshot().draft.PROJECTS).toBe(
      DEFAULT_SERVER_SETTINGS.PROJECTS,
    );
  });

  it("keeps live settings when the same server reconnects without initial settings", () => {
    applyHomeBootstrap(
      bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' }),
      false,
    );

    applyHomeBootstrap(bootstrapFor("runner-a", null), false);

    expect(projectsOf()).toBe('["/work/alpha"]');
  });

  it("returns to the original server's own projects when the user switches back", () => {
    // Switching back re-applies the connection's cached bootstrap, so the same
    // payload object arrives a second time with the id it already had.
    const alpha = bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' });
    applyHomeBootstrap(alpha, false);
    applyHomeBootstrap(bootstrapFor("runner-b", { PROJECTS: '["/srv/beta"]' }), false);
    expect(projectsOf()).toBe('["/srv/beta"]');

    applyHomeBootstrap(alpha, false);

    expect(projectsOf()).toBe('["/work/alpha"]');
  });

  it("restores each session's composer when navigating between servers", () => {
    const first = bootstrapFor("runner-a", {}, { selectedRunId: "pinned-a" });
    const second = bootstrapFor("runner-b", {}, { selectedRunId: "pinned-b" });
    const firstSelection = {
      conversationMode: "direct" as const,
      worker: "codex" as const,
      accountId: "codex-account",
      model: "gpt-5.6-sol",
      effort: "High",
    };
    const secondSelection = {
      conversationMode: "direct" as const,
      worker: "claude" as const,
      accountId: "claude-account",
      model: "claude-fable-5-1",
      effort: "Low",
    };

    applyHomeBootstrap(first, false);
    homeUiStateManager.hydrateComposerSelection({ runId: "pinned-a", selection: firstSelection, serverVersion: "a" });
    homeUiStateManager.setKey("command", "Draft on server A", false);

    applyHomeBootstrap(second, false);
    expect(homeUiStateManager.getSnapshot().command).toBe("");
    homeUiStateManager.hydrateComposerSelection({ runId: "pinned-b", selection: secondSelection, serverVersion: "b" });
    homeUiStateManager.setKey("command", "Draft on server B", false);

    applyHomeBootstrap(first, false);
    homeUiStateManager.hydrateComposerSelection({ runId: "pinned-a", selection: firstSelection, serverVersion: "a" });
    expect(homeUiStateManager.getSnapshot()).toMatchObject({
      selectedRunId: "pinned-a",
      hydratedRunSelectionId: "pinned-a",
      command: "Draft on server A",
      selectedCliAgent: "codex",
      selectedWorkerAccountId: "codex-account",
      selectedModel: "gpt-5.6-sol",
      selectedEffort: "High",
    });

    applyHomeBootstrap(second, false);
    expect(homeUiStateManager.getSnapshot()).toMatchObject({
      selectedRunId: "pinned-b",
      hydratedRunSelectionId: "pinned-b",
      command: "Draft on server B",
      selectedCliAgent: "claude",
      selectedWorkerAccountId: "claude-account",
      selectedModel: "claude-fable-5-1",
      selectedEffort: "Low",
    });
  });

  it("drops the previous server's draft project when the new server does not know it", () => {
    applyHomeBootstrap(
      bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' }, { draftProjectPath: "/work/alpha" }),
      false,
    );
    expect(homeUiStateManager.getSnapshot().draftProjectPath).toBe("/work/alpha");

    // The URL still carries `?project=/work/alpha` after the switch.
    applyHomeBootstrap(
      bootstrapFor("runner-b", { PROJECTS: '["/srv/beta"]' }, { draftProjectPath: "/work/alpha" }),
      false,
    );

    expect(homeUiStateManager.getSnapshot().draftProjectPath).toBeNull();
  });

  it("keeps a draft project the new server knows, as when opening a pinned project there", () => {
    applyHomeBootstrap(bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' }), false);

    applyHomeBootstrap(
      bootstrapFor("runner-b", { PROJECTS: '["/srv/beta/"]' }, { draftProjectPath: "/srv/beta" }),
      false,
    );
    expect(homeUiStateManager.getSnapshot().draftProjectPath).toBe("/srv/beta");

    applyHomeBootstrap(
      bootstrapFor("runner-c", { PROJECTS: "[]" }, { draftProjectPath: "/srv/gamma", runProjectPaths: ["/srv/gamma"] }),
      false,
    );
    expect(homeUiStateManager.getSnapshot().draftProjectPath).toBe("/srv/gamma");
  });

  it("keeps the draft project when the same server reconnects", () => {
    applyHomeBootstrap(
      bootstrapFor("runner-a", { PROJECTS: '["/work/alpha"]' }, { draftProjectPath: "/work/unlisted" }),
      false,
    );
    applyHomeBootstrap(
      bootstrapFor("runner-a", null, { draftProjectPath: "/work/unlisted" }),
      false,
    );

    expect(homeUiStateManager.getSnapshot().draftProjectPath).toBe("/work/unlisted");
  });
});
