"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import { t } from "@/lib/i18n";
import { OmniApp } from "@/ui/OmniApp";
import { createElectronRuntimeAPIs } from "@/runtime-api/electron";
import { createWebRuntimeAPIs } from "@/runtime-api/web";

function createRuntimeApis() {
  if (typeof window !== "undefined" && window.omniElectron) {
    return createElectronRuntimeAPIs();
  }
  return createWebRuntimeAPIs();
}

async function mount() {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  root.textContent = t("boot.loading.message");
  try {
    const runtimeApis = createRuntimeApis();
    const params = new URLSearchParams(window.location.search);
    const bootstrap = await runtimeApis.bootstrap.load({
      selectedRunId: params.get("run"),
      draftProjectPath: params.get("project"),
      pairToken: params.get("pair"),
    });
    createRoot(root).render(<OmniApp bootstrap={bootstrap} runtimeApis={runtimeApis} />);
  } catch (error) {
    root.textContent = error instanceof Error ? error.message : String(error);
  }
}

void mount();
