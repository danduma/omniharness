"use client";

import { LoaderCircle } from "lucide-react";

export function BootShell() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,1))] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_40%),linear-gradient(180deg,_rgba(24,24,27,1),_rgba(10,10,10,1))]">
      <div className="w-full max-w-sm rounded-[28px] border border-border/60 bg-background/95 p-6 shadow-xl shadow-black/5 backdrop-blur">
        <div className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">OmniHarness</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Loading your workspace...
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
