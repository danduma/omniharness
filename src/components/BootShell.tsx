"use client";

const bootSteps = [
  { label: "Session", detail: "Verifying access" },
  { label: "Workspace", detail: "Indexing context" },
  { label: "Workers", detail: "Priming agent bus" },
];

const signalNodes = ["Supervisor", "Planner", "Builder", "Validator"];

export function BootShell() {
  return (
    <main
      aria-busy="true"
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#f2eee4] px-4 py-8 text-[#171914] dark:bg-[#080a09] dark:text-zinc-100 sm:px-6"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(47,102,82,0.26),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(180,116,48,0.18),transparent_28%),linear-gradient(135deg,#f7f0df_0%,#ece7dd_45%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_20%_14%,rgba(69,145,112,0.32),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(214,157,78,0.16),transparent_30%),linear-gradient(135deg,#050706_0%,#101412_48%,#070809_100%)]" />
        <div className="absolute inset-0 opacity-[0.24] [background-image:linear-gradient(rgba(23,25,20,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(23,25,20,0.11)_1px,transparent_1px)] [background-size:54px_54px] dark:opacity-[0.18] dark:[background-image:linear-gradient(rgba(255,255,255,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.13)_1px,transparent_1px)]" />
        <div className="omni-boot-sweep absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_120deg,transparent,rgba(47,102,82,0.18),transparent,rgba(180,116,48,0.14),transparent)] blur-3xl dark:bg-[conic-gradient(from_120deg,transparent,rgba(84,178,137,0.18),transparent,rgba(214,157,78,0.13),transparent)]" />
      </div>

      <section
        role="status"
        aria-live="polite"
        aria-label="OmniHarness is loading"
        className="relative z-10 grid w-full max-w-5xl gap-5 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-[#171914]/10 bg-[#fffaf0]/82 p-6 shadow-[0_26px_90px_rgba(23,25,20,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#101412]/78 dark:shadow-[0_26px_90px_rgba(0,0,0,0.48)] sm:p-8">
          <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#2f6652]/70 to-transparent dark:via-emerald-200/40" />
          <div className="relative space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2f6652]/18 bg-[#2f6652]/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6652] dark:border-emerald-200/15 dark:bg-emerald-200/8 dark:text-emerald-100">
                <span className="omni-boot-node h-1.5 w-1.5 rounded-full bg-current" />
                Live boot
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#171914]/45 dark:text-zinc-500">
                OH-00
              </div>
            </div>

            <div className="max-w-xl space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-[-0.055em] text-[#10120f] dark:text-zinc-50 sm:text-5xl">
                OmniHarness is coming online
              </h1>
              <p className="max-w-lg text-sm leading-7 text-[#4f574c] dark:text-zinc-400 sm:text-base">
                Preparing your supervised coding workspace, linking context,
                agents, and validation into one ready command surface.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-[#171914]/54 dark:text-zinc-500">
                  Launch sequence
                </div>
                <div className="font-mono text-xs text-[#2f6652] dark:text-emerald-200">calibrating</div>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-[#171914]/10 dark:bg-white/10">
                <div className="omni-boot-flow absolute inset-y-0 left-0 w-2/3 rounded-full bg-gradient-to-r from-[#2f6652] via-[#79a787] to-[#d69d4e] dark:from-emerald-300 dark:via-teal-200 dark:to-amber-200" />
                <div className="omni-boot-scan absolute inset-y-0 w-20 bg-white/55 blur-sm dark:bg-white/35" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {bootSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="rounded-2xl border border-[#171914]/10 bg-white/45 p-4 dark:border-white/8 dark:bg-white/[0.04]"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#171914]/42 dark:text-zinc-600">
                      0{index + 1}
                    </span>
                    <span className={`omni-boot-node omni-boot-node-delay-${index} h-2 w-2 rounded-full bg-[#2f6652] dark:bg-emerald-200`} />
                  </div>
                  <div className="text-sm font-semibold text-[#171914] dark:text-zinc-100">{step.label}</div>
                  <div className="mt-1 text-xs text-[#5e6659] dark:text-zinc-500">{step.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-[#171914]/10 bg-[#151811]/88 p-6 text-zinc-100 shadow-[0_26px_90px_rgba(23,25,20,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0c0f0d]/82 dark:shadow-[0_26px_90px_rgba(0,0,0,0.54)] sm:p-8">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(120,167,135,0.24),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.07),transparent)]" />
          <div className="relative flex min-h-[25rem] flex-col justify-between gap-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-100/60">Agent mesh</div>
                <div className="mt-2 text-sm text-zinc-300">Four workers standing by</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] text-emerald-100/80">
                sync
              </div>
            </div>

            <div aria-hidden="true" className="relative mx-auto grid h-64 w-64 place-items-center sm:h-72 sm:w-72">
              <div className="omni-boot-ring absolute inset-0 rounded-full border border-dashed border-emerald-100/20" />
              <div className="omni-boot-ring omni-boot-ring-reverse absolute inset-8 rounded-full border border-dashed border-amber-100/20" />
              <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-emerald-100/20 to-transparent" />
              <div className="absolute h-full w-px bg-gradient-to-b from-transparent via-emerald-100/20 to-transparent" />
              <div className="omni-boot-breathe grid h-28 w-28 place-items-center rounded-[2rem] border border-emerald-100/20 bg-[#eaf6df]/10 shadow-[0_0_60px_rgba(120,167,135,0.34)]">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#eaf6df] font-mono text-lg font-semibold tracking-[-0.08em] text-[#182015] shadow-[inset_0_0_22px_rgba(47,102,82,0.22)]">
                  OH
                </div>
              </div>
              {signalNodes.map((node, index) => (
                <div
                  key={node}
                  className={`omni-boot-orbit omni-boot-orbit-${index} absolute rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[10px] font-medium text-zinc-200 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur`}
                >
                  {node}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <div className="text-zinc-500">Context</div>
                <div className="mt-1 font-mono text-emerald-100">warming cache</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <div className="text-zinc-500">Validation</div>
                <div className="mt-1 font-mono text-amber-100">queued</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
