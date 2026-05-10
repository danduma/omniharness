import type React from "react";
import type { LlmProfileTab } from "@/app/home/types";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
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
  useI18nSnapshot();
  const creditStrategyOptions = [
    { value: "swap_account", label: t("settings.models.creditStrategy.swapAccount") },
    { value: "fallback_api", label: t("settings.models.creditStrategy.fallbackApi") },
    { value: "wait_for_reset", label: t("settings.models.creditStrategy.waitForReset") },
    { value: "cross_provider", label: t("settings.models.creditStrategy.crossProvider") },
  ];

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
        {([
          ["supervisor", t("settings.models.tabs.supervisorCredentials")],
          ["fallback", t("settings.models.tabs.fallbackCredentials")],
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
          title={t("settings.models.supervisorTitle")}
          settings={settings}
          setSetting={setSetting}
          secretStates={secretStates}
        />
      ) : (
        <ModelProfileForm
          prefix="SUPERVISOR_FALLBACK_LLM"
          title={t("settings.models.fallbackTitle")}
          settings={settings}
          setSetting={setSetting}
          secretStates={secretStates}
        />
      )}

      <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-4">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="CREDIT_STRATEGY">
          {t("settings.models.creditStrategy.label")}
        </label>
        <Select
          id="CREDIT_STRATEGY"
          value={settings.CREDIT_STRATEGY || "swap_account"}
          options={creditStrategyOptions}
          onValueChange={(value) => setSetting("CREDIT_STRATEGY", value)}
        />
      </div>
    </div>
  );
}
