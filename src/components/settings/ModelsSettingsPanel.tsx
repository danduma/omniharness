import type React from "react";
import type { LlmProfileTab } from "@/app/home/types";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Select, type SelectOption } from "@/components/ui/select";
import { ModelProfileForm } from "./ModelProfileForm";

interface ModelsSettingsPanelProps {
  activeLlmProfileTab: LlmProfileTab;
  setActiveLlmProfileTab: React.Dispatch<React.SetStateAction<LlmProfileTab>>;
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  secretStates?: Record<string, { configured: boolean; updatedAt: string; preview?: string }>;
}

const CREDIT_STRATEGY_VALUES = ["swap_account", "fallback_api", "wait_for_reset", "cross_provider"] as const;
type CreditStrategyValue = (typeof CREDIT_STRATEGY_VALUES)[number];

export function ModelsSettingsPanel({
  activeLlmProfileTab,
  setActiveLlmProfileTab,
  settings,
  setSetting,
  secretStates,
}: ModelsSettingsPanelProps) {
  useI18nSnapshot();
  const creditStrategyOptions: SelectOption[] = CREDIT_STRATEGY_VALUES.map((value) => ({
    value,
    label: t(`settings.models.creditStrategy.${toCamel(value)}`),
  }));
  const currentStrategy = (CREDIT_STRATEGY_VALUES as readonly string[]).includes(settings.CREDIT_STRATEGY)
    ? (settings.CREDIT_STRATEGY as CreditStrategyValue)
    : "swap_account";
  const strategyExplanation = t(`settings.models.creditStrategy.explanation.${toCamel(currentStrategy)}`);

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

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-start">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="CREDIT_STRATEGY">
              {t("settings.models.creditStrategy.label")}
            </label>
            <Select
              id="CREDIT_STRATEGY"
              value={currentStrategy}
              options={creditStrategyOptions}
              onValueChange={(value) => setSetting("CREDIT_STRATEGY", value)}
              className="w-full"
              contentClassName="min-w-[16rem]"
            />
          </div>
          <div
            role="note"
            aria-live="polite"
            className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground sm:mt-[1.625rem]"
          >
            {strategyExplanation}
          </div>
        </div>
      </div>
    </div>
  );
}

function toCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}
