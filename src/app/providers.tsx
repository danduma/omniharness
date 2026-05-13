"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { appearancePreferencesManager } from "@/app/home/AppearancePreferencesManager";
import { i18nManager } from "@/lib/i18n";

function makeQueryClient() {
  return new QueryClient();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    appearancePreferencesManager.hydrateFromLocalStorage();
    void i18nManager.hydrateAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
