import { LanguageSelect } from "@/components/LanguageSelect";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";

export function GeneralSettingsPanel() {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <LanguageSelect />
      <AppearanceSettingsPanel />
    </div>
  );
}
