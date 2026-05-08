import type React from "react";
import type { LlmProfileTab } from "@/app/home/types";
import { cn } from "@/lib/utils";
import { ModelProfileForm } from "./ModelProfileForm";

interface ModelsSettingsPanelProps {
  activeLlmProfileTab: LlmProfileTab;
  setActiveLlmProfileTab: React.Dispatch<React.SetStateAction<LlmProfileTab>>;
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  secretStates?: Record<string, { configured: boolean; updatedAt: string }>;
}

export function ModelsSettingsPanel({
  activeLlmProfileTab,
  setActiveLlmProfileTab,
  settings,
  setSetting,
  secretStates,
}: ModelsSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
        {([
          ["supervisor", "Supervisor Credentials"],
          ["fallback", "Fallback Credentials"],
        ] as Array<[LlmProfileTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeLlmProfileTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={activeLlmProfileTab === tab}
            onClick={() => setActiveLlmProfileTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeLlmProfileTab === "supervisor" ? (
        <ModelProfileForm
          prefix="SUPERVISOR_LLM"
          title="Supervisor LLM"
          description="Configure the provider, model, endpoint, and credentials used first for supervisor turns."
          settings={settings}
          setSetting={setSetting}
          secretStates={secretStates}
        />
      ) : (
        <ModelProfileForm
          prefix="SUPERVISOR_FALLBACK_LLM"
          title="Fallback LLM"
          description="Use a second provider profile if the primary supervisor credentials are unavailable."
          settings={settings}
          setSetting={setSetting}
          secretStates={secretStates}
        />
      )}

      <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-4">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="CREDIT_STRATEGY">
          Credit / failover strategy
        </label>
        <select
          id="CREDIT_STRATEGY"
          className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          value={settings.CREDIT_STRATEGY || "swap_account"}
          onChange={(event) => setSetting("CREDIT_STRATEGY", event.target.value)}
        >
          <option value="swap_account">Swap Account</option>
          <option value="fallback_api">Fallback API</option>
          <option value="wait_for_reset">Wait for Reset</option>
          <option value="cross_provider">Cross Provider</option>
        </select>
      </div>
    </div>
  );
}
