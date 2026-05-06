"use client";

import { LoaderCircle } from "lucide-react";

export function BootShell() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-background px-6 text-foreground"
    >
      <section
        role="status"
        aria-live="polite"
        aria-label="OmniHarness is loading"
        className="flex flex-col items-center gap-4 text-center"
      >
        <LoaderCircle
          aria-hidden="true"
          className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none"
          strokeWidth={1.75}
        />
        <div className="space-y-1">
          <h1 className="text-sm font-medium tracking-normal text-foreground">OmniHarness</h1>
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </section>
    </main>
  );
}
