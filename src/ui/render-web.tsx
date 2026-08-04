"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "@/interface/providers";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { BugDropBootstrap } from "@/components/BugDropBootstrap";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import { TooltipProvider } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { OmniApp } from "@/ui/OmniApp";
import { createRendererRuntimeAPIs } from "@/runtime-api/electron";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";
import { RuntimeApiProvider } from "@/runtime-api/provider";
import { InterfaceAuthorizationScreen } from "@/interface/auth/InterfaceAuthorizationScreen";

export function parseInterfaceRoute(location: Pick<Location, "pathname" | "search">) {
  const params = new URLSearchParams(location.search);
  const queryRunId = params.get("run")?.trim() || null;
  const sessionMatch = location.pathname.match(/^\/session\/([^/]+)\/?$/);
  const pathRunId = sessionMatch
    ? decodeURIComponent(sessionMatch[1] ?? "").trim() || null
    : null;
  return {
    selectedRunId: queryRunId ?? pathRunId,
    draftProjectPath: params.get("project"),
    pairToken: params.get("pair"),
  };
}

export function parseInlineBootstrap(text: string | null) {
  if (!text?.trim()) {
    return null;
  }
  return JSON.parse(text) as HomeBootstrapPayload;
}

function createShellBootstrap(
  runtimeApis: ReturnType<typeof createRendererRuntimeAPIs>,
  route: ReturnType<typeof parseInterfaceRoute>,
): HomeBootstrapPayload {
  return {
    id: `${runtimeApis.runtime.surface}-shell`,
    route: {
      selectedRunId: route.selectedRunId,
      draftProjectPath: route.draftProjectPath,
      pairTokenFromUrl: route.pairToken,
    },
    initialEventState: null,
    initialLastEventId: "",
    initialQueries: { session: null, settings: null },
    features: { unifiedWorkerStream: true },
    runner: {
      runnerInstanceId: `${runtimeApis.runtime.surface}-shell`,
      name: runtimeApis.runtime.label,
      version: "0.1.0",
      apiRevision: { minimum: 1, current: 1 },
      capabilities: [],
      bridgeState: "degraded",
      readinessState: "starting",
      streamEpoch: runtimeApis.runtime.surface,
    },
  };
}

async function mount() {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  root.textContent = t("boot.loading.message");
  try {
    const runtimeApis = createRendererRuntimeAPIs();
    if (window.location.pathname === "/authorize-interface") {
      const params = new URLSearchParams(window.location.search);
      createRoot(root).render(
        <AppErrorBoundary>
          <Providers>
            <RuntimeApiProvider apis={runtimeApis}>
              <InterfaceAuthorizationScreen request={{
                origin: params.get("origin") ?? "",
                state: params.get("state") ?? "",
                challenge: params.get("challenge") ?? "",
                method: params.get("method") ?? "",
              }} />
            </RuntimeApiProvider>
          </Providers>
        </AppErrorBoundary>,
      );
      return;
    }
    const route = parseInterfaceRoute(window.location);
    let bootstrap = (
      runtimeApis.runtime.surface === "electron"
      || runtimeApis.runtime.surface === "capacitor"
    )
      ? createShellBootstrap(runtimeApis, route)
      : parseInlineBootstrap(
        document.getElementById("omni-bootstrap")?.textContent ?? null,
      );
    if (!bootstrap) {
      try {
        bootstrap = await runtimeApis.bootstrap.load(route) as HomeBootstrapPayload;
      } catch {
        bootstrap = createShellBootstrap(runtimeApis, route);
      }
    }
    createRoot(root).render(
      <>
        <BugDropBootstrap />
        <PwaBootstrap />
        <AppErrorBoundary>
          <Providers>
            <TooltipProvider>
              <OmniApp bootstrap={bootstrap} runtimeApis={runtimeApis} />
            </TooltipProvider>
          </Providers>
        </AppErrorBoundary>
      </>,
    );
  } catch (error) {
    root.textContent = error instanceof Error ? error.message : String(error);
  }
}

if (typeof document !== "undefined") {
  void mount();
}
