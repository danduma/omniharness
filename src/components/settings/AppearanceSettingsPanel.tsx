import { appearancePreferencesManager, DIRECT_TEXT_SIZE_LEVELS, TERMINAL_TEXT_SIZE_LEVELS } from "@/app/home/AppearancePreferencesManager";
import { Select } from "@/components/ui/select";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export function AppearanceSettingsPanel() {
  const { directTextSize, terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
  useI18nSnapshot();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{t("settings.appearance.title")}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNI_DIRECT_TEXT_SIZE">
            {t("settings.appearance.directTextSize")}
          </label>
          <Select
            id="OMNI_DIRECT_TEXT_SIZE"
            value={directTextSize}
            options={DIRECT_TEXT_SIZE_LEVELS}
            onValueChange={(value) => appearancePreferencesManager.setDirectTextSize(value as typeof directTextSize)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNI_TERMINAL_TEXT_SIZE">
            {t("settings.appearance.terminalTextSize")}
          </label>
          <Select
            id="OMNI_TERMINAL_TEXT_SIZE"
            value={terminalTextSize}
            options={TERMINAL_TEXT_SIZE_LEVELS}
            onValueChange={(value) => appearancePreferencesManager.setTerminalTextSize(value as typeof terminalTextSize)}
          />
        </div>
      </div>
    </div>
  );
}
