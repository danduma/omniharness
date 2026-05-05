"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, Cpu, GitBranch, MessageSquare, ShieldCheck } from "lucide-react";

interface BootStatusItem {
  label: string;
  detail: string;
  Icon: LucideIcon;
}

interface BootSignalNode {
  label: string;
  className: string;
}

class BootShellDesignManager {
  private readonly statusItems: readonly BootStatusItem[] = Object.freeze([
    { label: "Session", detail: "Checking access", Icon: ShieldCheck },
    { label: "Workers", detail: "Indexing run context", Icon: Cpu },
    { label: "Messages", detail: "Syncing queues", Icon: MessageSquare },
  ]);

  private readonly signalNodes: readonly BootSignalNode[] = Object.freeze([
    { label: "auth", className: "left-[14%] top-[24%] [animation-delay:0ms]" },
    { label: "plan", className: "right-[18%] top-[17%] [animation-delay:260ms]" },
    { label: "run", className: "bottom-[21%] left-[23%] [animation-delay:520ms]" },
    { label: "events", className: "bottom-[27%] right-[16%] [animation-delay:780ms]" },
  ]);

  getStatusItems() {
    return this.statusItems;
  }

  getSignalNodes() {
    return this.signalNodes;
  }
}

const bootShellDesignManager = new BootShellDesignManager();

export function BootShell() {
  const statusItems = bootShellDesignManager.getStatusItems();
  const signalNodes = bootShellDesignManager.getSignalNodes();

  return (
    <main
      aria-busy="true"
      className="relative grid min-h-screen overflow-hidden bg-background px-4 py-8 text-foreground sm:px-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_50%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_46%,transparent)_1px,transparent_1px)] bg-[size:44px_44px] opacity-40 dark:opacity-[0.18]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-foreground/16 to-transparent animate-boot-sweep motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_oklch,var(--muted)_46%,transparent)_48%,transparent_100%)] opacity-70 dark:opacity-25"
      />

      <section
        role="status"
        aria-live="polite"
        aria-label="OmniHarness is loading"
        className="relative z-10 m-auto flex w-full max-w-[58rem] flex-col items-center gap-8 text-center"
      >
        <div className="relative flex aspect-square w-[min(72vw,22rem)] items-center justify-center">
          <div aria-hidden="true" className="absolute inset-0 rounded-lg border border-border/60 bg-muted/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:bg-white/[0.03]" />
          <div aria-hidden="true" className="absolute inset-7 rounded-lg border border-dashed border-border/70 dark:border-white/12" />
          <div aria-hidden="true" className="absolute inset-14 rounded-lg border border-border/70 bg-background/72 backdrop-blur-sm dark:border-white/10 dark:bg-[#111315]/84" />
          <div
            aria-hidden="true"
            className="absolute h-[74%] w-px bg-gradient-to-b from-transparent via-foreground/18 to-transparent animate-boot-scan motion-reduce:animate-none"
          />
          <div
            aria-hidden="true"
            className="absolute h-px w-[74%] bg-gradient-to-r from-transparent via-foreground/18 to-transparent animate-boot-scan-horizontal motion-reduce:animate-none"
          />

          {signalNodes.map((node) => (
            <span
              key={node.label}
              aria-hidden="true"
              className={`absolute flex h-3 w-3 items-center justify-center rounded bg-background shadow-[0_0_0_1px_color-mix(in_oklch,var(--border)_75%,transparent)] dark:bg-[#181a1d] ${node.className}`}
            >
              <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500/80 animate-boot-pulse motion-reduce:animate-none dark:bg-emerald-300/85" />
            </span>
          ))}

          <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-border bg-background shadow-[0_18px_70px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[#101214] dark:shadow-[0_18px_70px_rgba(0,0,0,0.36)]">
            <Activity aria-hidden="true" className="mb-2 h-5 w-5 text-emerald-700 dark:text-emerald-300" strokeWidth={1.8} />
            <span className="font-mono text-[10px] font-semibold text-muted-foreground">ONLINE</span>
          </div>
        </div>

        <div className="flex w-full max-w-[34rem] flex-col items-center gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
              <GitBranch aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
              Local control plane
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">OmniHarness</h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">Preparing workspace handoff</p>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-3">
            {statusItems.map(({ label, detail, Icon }) => (
              <div
                key={label}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-border/70 bg-background/80 px-3 py-3 text-left shadow-sm dark:border-white/10 dark:bg-white/[0.035]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200">
                  <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <div className="truncate text-xs text-muted-foreground">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
