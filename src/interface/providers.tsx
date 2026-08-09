"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { appearancePreferencesManager } from "@/interface/home/AppearancePreferencesManager";
import { fileViewerPanelManager } from "@/components/component-state-managers";
import { i18nManager } from "@/lib/i18n";
import { clearPreviewCacheStorage } from "@/lib/browser-storage";

function makeQueryClient() {
  return new QueryClient();
}

const queryClient = makeQueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Remove preview bodies written by older builds before any preference
    // persistence gets a chance to encounter their quota usage.
    clearPreviewCacheStorage();
    appearancePreferencesManager.hydrateFromLocalStorage();
    fileViewerPanelManager.hydrateFromLocalStorage();
    void i18nManager.hydrateAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
