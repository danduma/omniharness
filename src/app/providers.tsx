"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/components/component-state-managers";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
