"use client";

import { useQuery } from "@tanstack/react-query";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { requestJson } from "@/lib/app-errors";
import { homeUiSetters } from "./HomeUiStateManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import type { AuthSessionResponse, ProjectFilesResponse, SettingsResponse, WorkerCatalogResponse } from "./types";

export interface UseHomeQueriesParams {
  currentProjectScope: string | null;
}

export function useHomeQueries({ currentProjectScope }: UseHomeQueriesParams) {
  const { setApiKeys, setSettingsDiagnostics } = homeUiSetters;

  const sessionQuery = useQuery<AuthSessionResponse>({
    queryKey: ["auth-session"],
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => requestJson<AuthSessionResponse>("/api/auth/session", undefined, {
      source: "Auth",
      action: "Load session state",
    }),
  });

  const authEnabled = sessionQuery.data?.enabled ?? false;
  const authConfigurationError = sessionQuery.data?.configurationError ?? null;
  const appUnlocked = sessionQuery.data
    ? (!sessionQuery.data.enabled || sessionQuery.data.authenticated)
    : false;

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: appUnlocked,
    queryFn: async () => {
      const data = await requestJson<SettingsResponse>("/api/settings", undefined, {
        source: "Settings",
        action: "Load saved settings",
      });
      settingsDraftManager.hydrate(data.values || {});
      setApiKeys((prev) => ({ ...prev, ...settingsDraftManager.getSnapshot().draft }));
      setSettingsDiagnostics(data.diagnostics ?? []);
      return data;
    },
  });

  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
    queryKey: ["worker-catalog"],
    staleTime: 60_000,
    enabled: appUnlocked,
    refetchInterval: (query) => query.state.data?.workerModelsRefreshing ? 2_000 : false,
    queryFn: async () => requestJson<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>(
      "/api/agents/catalog",
      undefined,
      {
        source: "Agent runtime",
        action: "Load worker availability",
      },
    ),
  });

  const projectFilesQuery = useQuery<ProjectFilesResponse>({
    queryKey: ["project-files", currentProjectScope],
    queryFn: async () => requestJson<ProjectFilesResponse>(
      `/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`,
      undefined,
      {
        source: "Filesystem",
        action: "Load project files",
      },
    ),
    enabled: Boolean(currentProjectScope),
    staleTime: 60_000,
  });

  return {
    sessionQuery,
    settingsQuery,
    workerCatalogQuery,
    projectFilesQuery,
    authEnabled,
    authConfigurationError,
    appUnlocked,
  };
}
