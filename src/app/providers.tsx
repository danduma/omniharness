"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { appearancePreferencesManager } from "@/app/home/AppearancePreferencesManager";
import { fileViewerPanelManager } from "@/components/component-state-managers";
import { i18nManager } from "@/lib/i18n";

function makeQueryClient() {
  return new QueryClient();
}

const queryClient = makeQueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    appearancePreferencesManager.hydrateFromLocalStorage();
    fileViewerPanelManager.hydrateFromLocalStorage();
    void i18nManager.hydrateAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
