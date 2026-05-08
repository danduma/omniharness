import { LanguageSelect } from "@/components/LanguageSelect";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";

export function GeneralSettingsPanel() {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">General</div>
        <p className="text-xs text-muted-foreground">
          Configure browser-local preferences. Theme stays in the header for quick day/night switching.
        </p>
      </div>
      <LanguageSelect />
      <AppearanceSettingsPanel />
    </div>
  );
}
