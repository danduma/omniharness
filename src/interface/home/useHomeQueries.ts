"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { homeUiSetters } from "./HomeUiStateManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
import type { AuthSessionResponse, ProjectFilesResponse, SettingsResponse, WorkerCatalogResponse } from "./types";

export interface UseHomeQueriesParams {
  currentProjectScope: string | null;
  bootstrapId?: string | null;
  loadProjectFiles?: boolean;
  loadWorkerCatalog?: boolean;
  initialQueries?: {
    session?: AuthSessionResponse | null;
    settings?: SettingsResponse | null;
  };
}

export function shouldEnableWorkerCatalogQuery(args: {
  appUnlocked: boolean;
  loadWorkerCatalog: boolean;
}) {
  return args.appUnlocked && args.loadWorkerCatalog;
}

export function useHomeQueries({
  currentProjectScope,
  bootstrapId,
  loadProjectFiles = false,
  loadWorkerCatalog = false,
  initialQueries,
}: UseHomeQueriesParams) {
  const { setApiKeys, setSettingsDiagnostics } = homeUiSetters;
  const queryClient = useQueryClient();
  const runtimeApis = useRuntimeAPIs();
  planningReviewPreferencesManager.configure(runtimeApis.settings.save);
  const primedBootstrapIdRef = useRef<string | null>(null);

  if (
    bootstrapId
    && primedBootstrapIdRef.current !== bootstrapId
  ) {
    if (initialQueries?.session) {
      queryClient.setQueryData(["auth-session"], initialQueries.session);
    }
    if (initialQueries?.settings) {
      queryClient.setQueryData(["settings"], initialQueries.settings);
    }
    primedBootstrapIdRef.current = bootstrapId;
  }

  const sessionQuery = useQuery<AuthSessionResponse>({
    queryKey: ["auth-session"],
    retry: false,
    refetchOnWindowFocus: true,
    initialData: initialQueries?.session ?? undefined,
    staleTime: initialQueries?.session ? 5_000 : 0,
    queryFn: async () => runtimeApis.auth.session() as Promise<AuthSessionResponse>,
  });

  const authEnabled = sessionQuery.data?.enabled ?? false;
  const authConfigurationError = sessionQuery.data?.configurationError ?? null;
  const appUnlocked = sessionQuery.data
    ? (!sessionQuery.data.enabled || sessionQuery.data.authenticated)
    : false;

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: appUnlocked,
    initialData: initialQueries?.settings ?? undefined,
    staleTime: initialQueries?.settings ? 5_000 : 0,
    queryFn: async () => {
      const data = await runtimeApis.settings.load() as SettingsResponse;
      settingsDraftManager.hydrate(data.values || {});
      planningReviewPreferencesManager.hydrate(data.values || {});
      setApiKeys((prev) => ({ ...prev, ...settingsDraftManager.getSnapshot().draft }));
      setSettingsDiagnostics(data.diagnostics ?? []);
      return data;
    },
  });

  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
    queryKey: ["worker-catalog"],
    staleTime: 5 * 60_000,
    enabled: shouldEnableWorkerCatalogQuery({ appUnlocked, loadWorkerCatalog }),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => query.state.data?.workerModelsRefreshing ? 2_000 : false,
    queryFn: async () => runtimeApis.workers.catalog() as Promise<
      WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }
    >,
  });

  const refreshWorkerCatalog = useMutation({
    mutationFn: async () => runtimeApis.workers.catalog({ refresh: true }) as Promise<
      WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }
    >,
    onSuccess: (data) => {
      queryClient.setQueryData(["worker-catalog"], data);
    },
  });

  const projectFilesQuery = useQuery<ProjectFilesResponse>({
    queryKey: ["project-files", currentProjectScope],
    queryFn: async () => runtimeApis.files.list({
      root: currentProjectScope || "",
    }) as Promise<ProjectFilesResponse>,
    enabled: Boolean(loadProjectFiles && currentProjectScope),
    staleTime: 60_000,
  });

  return {
    sessionQuery,
    settingsQuery,
    workerCatalogQuery,
    refreshWorkerCatalog,
    projectFilesQuery,
    authEnabled,
    authConfigurationError,
    appUnlocked,
  };
}
