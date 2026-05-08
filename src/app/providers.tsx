"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { appearancePreferencesManager } from "@/app/home/AppearancePreferencesManager";
import { queryClient } from "@/components/component-state-managers";
import { i18nManager } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    appearancePreferencesManager.hydrateFromLocalStorage();
    void i18nManager.hydrateAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
