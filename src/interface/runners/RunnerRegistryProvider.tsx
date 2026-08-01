"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWebRuntimeAPIs } from "@/runtime-api/web";
import {
  createElectronProfileStorage,
  createElectronRuntimeForProfile,
  ElectronRunnerCredentialStore,
  isElectronNativeRuntime,
} from "@/runtime-api/electron";
import {
  CapacitorRunnerCredentialStore,
  createCapacitorRuntimeForProfile,
  isCapacitorNativeRuntime,
} from "@/runtime-api/capacitor";
import type { RuntimeAPIs } from "@/runtime-api/types";
import {
  RunnerConnection,
  type RunnerConnectionRuntime,
} from "./RunnerConnection";
import {
  WebRunnerCredentialStore,
  type RunnerCredentialStore,
} from "./RunnerCredentialStore";
import { RunnerProfileStore } from "./RunnerProfileStore";
import { RunnerRegistry } from "./RunnerRegistry";
import type { RunnerProfile } from "./RunnerProfile";
import { RunnerUiManager } from "./RunnerUiManager";
import { conversationNotificationManager } from "@/interface/home/ConversationNotificationManager";
import type { EventStreamState } from "@/interface/home/types";

type RunnerRegistryContextValue = {
  registry: RunnerRegistry;
  profileStore: RunnerProfileStore;
  credentialStore: RunnerCredentialStore;
  uiManager: RunnerUiManager;
};

const RunnerRegistryContext = createContext<RunnerRegistryContextValue | null>(null);
const fallbackQueryClient = new QueryClient();

type BrowserEventTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export function installRunnerBrowserLifecycleRecovery(options: {
  registry: Pick<RunnerRegistry, "retryRecoverableConnections">;
  windowTarget: BrowserEventTarget;
  documentTarget: BrowserEventTarget;
  isVisible: () => boolean;
}) {
  const retry = () => {
    options.registry.retryRecoverableConnections();
  };
  const retryWhenVisible = () => {
    if (options.isVisible()) {
      retry();
    }
  };
  options.windowTarget.addEventListener("pageshow", retry);
  options.windowTarget.addEventListener("online", retry);
  options.documentTarget.addEventListener("visibilitychange", retryWhenVisible);
  return () => {
    options.windowTarget.removeEventListener("pageshow", retry);
    options.windowTarget.removeEventListener("online", retry);
    options.documentTarget.removeEventListener("visibilitychange", retryWhenVisible);
  };
}

function adaptRuntime(runtime: RuntimeAPIs): RunnerConnectionRuntime {
  return {
    apis: runtime,
    bootstrap: runtime.bootstrap,
    events: {
      snapshot: runtime.events.snapshot,
      open(input, handlers) {
        return runtime.events.open(input, {
          onOpen: handlers.onOpen,
          onEvent: handlers.onEvent ?? (() => {}),
          onError: handlers.onError,
        });
      },
    },
    terminals: {
      openStream(input, handlers) {
        return runtime.terminals.openStream(input, {
          onOpen: handlers.onOpen,
          onEvent: handlers.onEvent ?? (() => {}),
          onError: handlers.onError,
        });
      },
    },
  };
}

export function createWebRunnerRuntimeFactory(
  credentialStore: RunnerCredentialStore,
) {
  return async (profile: RunnerProfile): Promise<RunnerConnectionRuntime> => {
    if (profile.authTransport === "cookie") {
      return adaptRuntime(createWebRuntimeAPIs({
        baseUrl: profile.isSameOrigin ? "" : profile.baseUrl,
      }));
    }
    if (!profile.credentialRef) {
      throw {
        code: "runtime.http_401",
        message: "Server authorization is required.",
      };
    }
    return credentialStore.useCredential(
      profile.credentialRef,
      {
        origin: profile.baseUrl,
        runnerInstanceId: profile.runnerInstanceId,
      },
      (token) => adaptRuntime(createWebRuntimeAPIs({
        baseUrl: profile.baseUrl,
        bearerToken: token,
      })),
    );
  };
}

export function createDefaultRunnerRegistry() {
  if (isCapacitorNativeRuntime()) {
    const credentials = new CapacitorRunnerCredentialStore();
    const profiles = new RunnerProfileStore({
      credentialStore: credentials,
      locationOrigin: "http://127.0.0.1:3050",
    });
    const registry = new RunnerRegistry({
      profileStore: profiles,
      connectionFactory: (profile) => new RunnerConnection({
        profile,
        persistence: profiles,
        runtimeFactory: async (item) => ({
          ...adaptRuntime(createCapacitorRuntimeForProfile(item)),
        }),
      }),
    });
    return {
      registry,
      profiles,
      credentials,
      uiManager: new RunnerUiManager(),
    };
  }
  if (isElectronNativeRuntime()) {
    const credentials = new ElectronRunnerCredentialStore();
    const storage = createElectronProfileStorage();
    if (!storage.getItem("omniharness.runnerProfiles")) {
      storage.setItem("omniharness.runnerProfiles", JSON.stringify({
        schemaVersion: 1,
        activeRunnerId: "electron-legacy-local",
        profiles: [{
          id: "electron-legacy-local",
          runnerInstanceId: null,
          label: "Local server",
          baseUrl: "http://127.0.0.1:3050",
          savedPassword: null,
          authTransport: "bearer",
          credentialRef: null,
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          lastConnectedAt: null,
          isSameOrigin: false,
        }],
        scopedState: {},
      }));
    }
    const profiles = new RunnerProfileStore({
      credentialStore: credentials,
      storage,
      locationOrigin: "http://127.0.0.1:3050",
    });
    const registry = new RunnerRegistry({
      profileStore: profiles,
      connectionFactory: (profile) => new RunnerConnection({
        profile,
        persistence: profiles,
        runtimeFactory: async (item) => ({
          ...adaptRuntime(createElectronRuntimeForProfile(item)),
        }),
      }),
    });
    return {
      registry,
      profiles,
      credentials,
      uiManager: new RunnerUiManager(),
    };
  }
  const credentials = new WebRunnerCredentialStore();
  const profiles = new RunnerProfileStore({
    credentialStore: credentials,
  });
  const runtimeFactory = createWebRunnerRuntimeFactory(credentials);
  const registry = new RunnerRegistry({
    profileStore: profiles,
    connectionFactory: (profile) => new RunnerConnection({
      profile,
      persistence: profiles,
      runtimeFactory,
    }),
  });
  const uiManager = new RunnerUiManager();
  return { registry, profiles, credentials, uiManager };
}

function useRegistrySnapshot(registry: RunnerRegistry) {
  return useSyncExternalStore(
    (listener) => registry.subscribe(listener),
    () => registry.getSnapshot(),
    () => registry.getInitialSnapshot(),
  );
}

export function RunnerRegistryProvider({
  registry,
  profileStore,
  credentialStore,
  uiManager,
  children,
}: PropsWithChildren<{
  registry: RunnerRegistry;
  profileStore: RunnerProfileStore;
  credentialStore: RunnerCredentialStore;
  uiManager: RunnerUiManager;
}>) {
  const snapshot = useRegistrySnapshot(registry);
  const activeConnection = snapshot.activeRunnerId
    ? registry.getConnection(snapshot.activeRunnerId)
    : null;
  const queryClient = activeConnection?.getQueryClient() ?? fallbackQueryClient;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await profileStore.hydrate();
      if (!cancelled) {
        await registry.start();
        const requestedRunnerId = typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search).get("runner");
        if (requestedRunnerId) {
          registry.switchActive(requestedRunnerId);
        }
      }
    })();
    return () => {
      cancelled = true;
      registry.stop();
    };
  }, [profileStore, registry]);

  useEffect(() => {
    const observedSnapshots = new Map<string, unknown>();
    const observe = () => {
      for (const connection of registry.getSnapshot().connections) {
        if (
          !connection.snapshot
          || observedSnapshots.get(connection.profileId) === connection.snapshot
        ) {
          continue;
        }
        observedSnapshots.set(connection.profileId, connection.snapshot);
        conversationNotificationManager.handleRunnerEventStreamState({
          profileId: connection.profileId,
          runnerInstanceId: connection.runnerInstanceId,
          runnerName: connection.runnerName,
        }, connection.snapshot as unknown as EventStreamState);
      }
    };
    observe();
    return registry.subscribe(observe);
  }, [registry]);

  useEffect(() => installRunnerBrowserLifecycleRecovery({
    registry,
    windowTarget: window,
    documentTarget: document,
    isVisible: () => document.visibilityState === "visible",
  }), [registry]);

  return (
    <RunnerRegistryContext.Provider value={{
      registry,
      profileStore,
      credentialStore,
      uiManager,
    }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </RunnerRegistryContext.Provider>
  );
}

export function useRunnerRegistry() {
  const value = useContext(RunnerRegistryContext);
  if (!value) {
    throw new Error("Server registry is not available.");
  }
  return value.registry;
}

export function useOptionalRunnerRegistryContext() {
  return useContext(RunnerRegistryContext);
}

export function useRunnerRegistryContext() {
  const value = useOptionalRunnerRegistryContext();
  if (!value) {
    throw new Error("Server registry is not available.");
  }
  return value;
}

export function useRunnerConnections() {
  const registry = useRunnerRegistry();
  return useRegistrySnapshot(registry).connections;
}

export function useActiveRunnerConnection() {
  const registry = useRunnerRegistry();
  const snapshot = useRegistrySnapshot(registry);
  return snapshot.activeRunnerId
    ? registry.getConnection(snapshot.activeRunnerId)
    : null;
}
