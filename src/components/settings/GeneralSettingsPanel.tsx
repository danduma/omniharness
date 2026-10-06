import { LanguageSelect } from "@/components/LanguageSelect";
import { useI18nSnapshot } from "@/lib/i18n";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { NotificationsSettingsPanel } from "./NotificationsSettingsPanel";

export function GeneralSettingsPanel() {
  useI18nSnapshot();

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <LanguageSelect />
      <AppearanceSettingsPanel />
      <NotificationsSettingsPanel />
    </div>
  );
}
