"use client";

import { lazy, Suspense, useMemo } from "react";
import { BootShell } from "@/components/BootShell";
import type { RunnerConnectionStatus } from "@/interface/runners/RunnerConnection";
import { RunnerControls } from "@/interface/runners/RunnerControls";
import { runnerStatusMessageKey } from "@/interface/runners/RunnerUiManager";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { RuntimeApiProvider, createDefaultWebRuntimeAPIs } from "@/runtime-api/provider";
import {
  RunnerRegistryProvider,
  createDefaultRunnerRegistry,
  useActiveRunnerConnection,
  useRunnerConnections,
} from "@/interface/runners/RunnerRegistryProvider";

const HomeApp = lazy(
  () => import("@/interface/home/HomeApp").then((module) => ({ default: module.HomeApp })),
);

export function OmniApp({
  bootstrap,
  runtimeApis,
}: {
  bootstrap: HomeBootstrapPayload;
  runtimeApis?: RuntimeAPIs;
}) {
  const defaultRuntimeApis = useMemo(() => runtimeApis ?? createDefaultWebRuntimeAPIs(), [runtimeApis]);
  const runnerSetup = useMemo(() => createDefaultRunnerRegistry(), []);

  if (defaultRuntimeApis.runtime.surface === "vscode") {
    return (
      <RuntimeApiProvider apis={defaultRuntimeApis}>
        <Suspense fallback={<BootShell />}>
          <HomeApp bootstrap={bootstrap} />
        </Suspense>
      </RuntimeApiProvider>
    );
  }

  return (
    <RunnerRegistryProvider
      registry={runnerSetup.registry}
      profileStore={runnerSetup.profiles}
      credentialStore={runnerSetup.credentials}
      uiManager={runnerSetup.uiManager}
    >
      <ActiveRunnerApp />
    </RunnerRegistryProvider>
  );
}

function ActiveRunnerApp() {
  useRunnerConnections();
  const connection = useActiveRunnerConnection();
  const connectionSnapshot = connection?.getSnapshot();
  const runtimeApis = connection?.getRuntimeAPIs();
  const bootstrap = connectionSnapshot?.bootstrap;

  if (!connection) {
    return <BootShell />;
  }

  if (!runtimeApis || !bootstrap) {
    return <RunnerRecoveryShell status={connectionSnapshot?.status ?? "connecting"} />;
  }

  return (
    <RuntimeApiProvider apis={runtimeApis}>
      <Suspense fallback={<BootShell />}>
        <HomeApp
          key={connectionSnapshot.profileId}
          bootstrap={bootstrap}
          runnerConnection={connection}
        />
      </Suspense>
    </RuntimeApiProvider>
  );
}

function RunnerRecoveryShell({
  status,
}: {
  status: RunnerConnectionStatus;
}) {
  useI18nSnapshot();
  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-3 sm:px-4">
        <span className="text-sm font-semibold">{t("product.name")}</span>
        <RunnerControls />
      </header>
      <section className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {t(runnerStatusMessageKey(status))}
        </p>
      </section>
    </main>
  );
}
