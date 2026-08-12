import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { homeUiStateManager } from "./HomeUiStateManager";
import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { parseBrowserConversationRoute } from "./utils";

let appliedHomeBootstrapId: string | null = null;

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

  if (bootstrap.initialQueries.settings) {
    settingsDraftManager.hydrate(settingsValues, notify);
    planningReviewPreferencesManager.hydrate(settingsValues);
  }

  homeUiStateManager.patch((current) => ({
    routeReady: true,
    hasReceivedInitialEventStreamPayload: Boolean(bootstrap.initialEventState),
    selectedRunId: routeSelectedRunId,
    draftProjectPath: routeSelectedRunId ? null : browserRoute.draftProjectPath,
    pairTokenFromUrl: browserRoute.pairTokenFromUrl,
    apiKeys: { ...current.apiKeys, ...settingsValues },
    settingsDiagnostics: bootstrap.initialQueries.settings?.diagnostics ?? current.settingsDiagnostics,
  }), notify);

  const initialSnapshotRunId = bootstrap.initialEventState?.snapshotRunId?.trim();
  if (bootstrap.initialEventState?.queuedMessages && initialSnapshotRunId) {
    busyMessageQueueManager.setQueuedMessages(bootstrap.initialEventState.queuedMessages, {
      runId: initialSnapshotRunId,
      notify,
    });
  }
}
