"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { BootShell } from "@/components/BootShell";
import type { HomeBootstrapPayload } from "@/runtime/bootstrap";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { RuntimeApiProvider, createDefaultWebRuntimeAPIs } from "@/runtime-api/provider";

const HomeApp = dynamic(
  () => import("@/app/home/HomeApp").then((module) => module.HomeApp),
  {
    ssr: false,
    loading: () => <BootShell />,
  },
);

export function OmniApp({
  bootstrap,
  runtimeApis,
}: {
  bootstrap: HomeBootstrapPayload;
  runtimeApis?: RuntimeAPIs;
}) {
  const defaultRuntimeApis = useMemo(() => runtimeApis ?? createDefaultWebRuntimeAPIs(), [runtimeApis]);

  return (
    <RuntimeApiProvider apis={defaultRuntimeApis}>
      <HomeApp bootstrap={bootstrap} />
    </RuntimeApiProvider>
  );
}
