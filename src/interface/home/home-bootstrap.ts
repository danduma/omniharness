import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { DEFAULT_SERVER_SETTINGS } from "./constants";
import { homeUiStateManager } from "./HomeUiStateManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { parseBrowserConversationRoute, parseProjectList } from "./utils";
import { normalizeProjectPath } from "@/lib/project-paths";

let appliedHomeBootstrapId: string | null = null;
let appliedRunnerInstanceId: string | null = null;

export function applyHomeBootstrap(
  bootstrap: HomeBootstrapPayload | null | undefined,
  notify = true,
) {
  if (!bootstrap || appliedHomeBootstrapId === bootstrap.id) {
    return;
  }

  appliedHomeBootstrapId = bootstrap.id;
  const browserRoute = typeof window === "undefined"
    ? bootstrap.route
    : parseBrowserConversationRoute(window.location);
  const routeSelectedRunId = browserRoute.selectedRunId;
  const settingsValues = bootstrap.initialQueries.settings?.values ?? {};

  // Settings are per server, and a server only reports the keys it actually
  // stores. Merging a new server's settings over the previous server's leaves
  // every key the new one never saved — the project list above all — reading as
  // if it belonged to the server now on screen. Arriving from a different
  // server is therefore a replacement, not an update. A reconnect to the same
  // server stays a merge, so a bootstrap that arrives without settings (an
  // unauthenticated or degraded reply) cannot blank out live state.
  const runnerChanged = appliedRunnerInstanceId !== null
    && appliedRunnerInstanceId !== bootstrap.runner.runnerInstanceId;
  appliedRunnerInstanceId = bootstrap.runner.runnerInstanceId;

  if (bootstrap.initialQueries.settings || runnerChanged) {
    settingsDraftManager.hydrate(settingsValues, notify, runnerChanged ? "replace" : "refresh");
  }

  // Switching servers keeps the browser URL, so a `?project=` left there by the
  // previous server would name a project the new one has never heard of — the
  // welcome heading would keep offering it while listing the new server's
  // projects underneath. Keep it only when the new server knows the project
  // (a deep link written for that server, such as opening a pinned project).
  const routeDraftProjectPath = routeSelectedRunId ? null : browserRoute.draftProjectPath;
  const draftProjectPath = runnerChanged && routeDraftProjectPath
    && !isProjectKnownToServer(routeDraftProjectPath, bootstrap)
    ? null
    : routeDraftProjectPath;

  // A pinned session on another server is selected through the bootstrap route.
  // Swap the composer draft along with the run before publishing the route state.
  homeUiStateManager.selectRun(routeSelectedRunId, false);
  homeUiStateManager.patch((current) => ({
    routeReady: true,
    hasReceivedInitialEventStreamPayload: Boolean(bootstrap.initialEventState),
    draftProjectPath,
    pairTokenFromUrl: browserRoute.pairTokenFromUrl,
    apiKeys: runnerChanged
      ? { ...DEFAULT_SERVER_SETTINGS, ...settingsValues }
      : { ...current.apiKeys, ...settingsValues },
    settingsDiagnostics: runnerChanged
      ? bootstrap.initialQueries.settings?.diagnostics ?? []
      : bootstrap.initialQueries.settings?.diagnostics ?? current.settingsDiagnostics,
  }), notify);

  const initialSnapshotRunId = bootstrap.initialEventState?.snapshotRunId?.trim();
  if (bootstrap.initialEventState?.queuedMessages && initialSnapshotRunId) {
    busyMessageQueueManager.setQueuedMessages(bootstrap.initialEventState.queuedMessages, {
      runId: initialSnapshotRunId,
      notify,
    });
  }
}

function isProjectKnownToServer(projectPath: string, bootstrap: HomeBootstrapPayload) {
  const target = normalizeProjectPath(projectPath);
  const knownPaths = [
    ...parseProjectList(bootstrap.initialQueries.settings?.values?.PROJECTS),
    ...(bootstrap.initialEventState?.runs ?? []).map((run) => run.projectPath),
  ];
  return knownPaths.some((knownPath) => typeof knownPath === "string" && normalizeProjectPath(knownPath) === target);
}
