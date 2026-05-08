import { appearancePreferencesManager, DIRECT_TEXT_SIZE_LEVELS, TERMINAL_TEXT_SIZE_LEVELS } from "@/app/home/AppearancePreferencesManager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export function AppearanceSettingsPanel() {
  const { directTextSize, terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">Appearance</div>
        <p className="text-xs text-muted-foreground">
          Personal readability preferences apply immediately in this browser.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNI_DIRECT_TEXT_SIZE">
            Direct-control text size
          </label>
          <select
            id="OMNI_DIRECT_TEXT_SIZE"
            className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={directTextSize}
            onChange={(event) => appearancePreferencesManager.setDirectTextSize(event.target.value as typeof directTextSize)}
          >
            {DIRECT_TEXT_SIZE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNI_TERMINAL_TEXT_SIZE">
            Terminal / agent-output text size
          </label>
          <select
            id="OMNI_TERMINAL_TEXT_SIZE"
            className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={terminalTextSize}
            onChange={(event) => appearancePreferencesManager.setTerminalTextSize(event.target.value as typeof terminalTextSize)}
          >
            {TERMINAL_TEXT_SIZE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
