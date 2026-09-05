import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { DEFAULT_SERVER_SETTINGS } from "./constants";
import { homeUiStateManager } from "./HomeUiStateManager";
import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { parseBrowserConversationRoute } from "./utils";

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
    settingsDraftManager.hydrate(settingsValues, notify);
    planningReviewPreferencesManager.hydrate(settingsValues);
  }

  homeUiStateManager.patch((current) => ({
    routeReady: true,
    hasReceivedInitialEventStreamPayload: Boolean(bootstrap.initialEventState),
    selectedRunId: routeSelectedRunId,
    draftProjectPath: routeSelectedRunId ? null : browserRoute.draftProjectPath,
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
