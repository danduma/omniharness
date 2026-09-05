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
): HomeBootstrapPayload {
  bootstrapSequence += 1;
  return {
    id: `bootstrap-${bootstrapSequence}`,
    route: {
      selectedRunId: null,
      draftProjectPath: null,
      pairTokenFromUrl: null,
    },
    initialEventState: null,
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
});
