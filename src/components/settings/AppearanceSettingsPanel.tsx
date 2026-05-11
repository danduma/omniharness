import {
  appearancePreferencesManager,
  CONVERSATION_TEXT_SIZE_LEVELS,
  TERMINAL_TEXT_SIZE_LEVELS,
  UI_TEXT_SIZE_LEVELS,
  type AppearanceTextSizeLevel,
} from "@/app/home/AppearancePreferencesManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";

interface TextSizeSliderProps {
  id: string;
  labelKey: string;
  descriptionKey: string;
  value: AppearanceTextSizeLevel;
  levels: typeof UI_TEXT_SIZE_LEVELS;
  onChange: (value: AppearanceTextSizeLevel) => void;
}

function TextSizeSlider({ id, labelKey, descriptionKey, value, levels, onChange }: TextSizeSliderProps) {
  const selectedIndex = Math.max(0, levels.findIndex((level) => level.value === value));
  const selectedLevel = levels[selectedIndex] ?? levels[0];
  const handleIndexChange = (index: number) => {
    const nextLevel = levels[index];
    if (nextLevel) {
      onChange(nextLevel.value);
    }
  };

  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[minmax(9rem,0.9fr)_minmax(14rem,1.35fr)] sm:items-center">
      <div className="min-w-0">
        <label className="block text-sm font-semibold text-foreground" htmlFor={id}>
          {t(labelKey)}
        </label>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t(descriptionKey)}</p>
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-end">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
            {t(selectedLevel.labelKey)}
          </span>
        </div>
        <div className="relative h-7">
          <input
            id={id}
            type="range"
            min={0}
            max={levels.length - 1}
            step={1}
            value={selectedIndex}
            aria-label={t(labelKey)}
            aria-valuetext={t(selectedLevel.labelKey)}
            onChange={(event) => handleIndexChange(Number(event.currentTarget.value))}
            onInput={(event) => handleIndexChange(Number(event.currentTarget.value))}
            className={cn(
              "absolute inset-x-0 top-1/2 z-10 h-2 -translate-y-1/2 cursor-pointer appearance-none rounded-full bg-transparent accent-primary",
              "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted",
              "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
              "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted",
              "[&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
            )}
          />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" aria-hidden="true" />
          {levels.map((level, index) => (
            <button
              key={level.value}
              type="button"
              aria-label={`${t(labelKey)}: ${t(level.labelKey)}`}
              aria-pressed={level.value === value}
              onClick={() => onChange(level.value)}
              className={cn(
                "absolute top-1/2 z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
              style={{ left: `${(index / (levels.length - 1)) * 100}%` }}
            >
              <span
                className={cn(
                  "mx-auto block h-1.5 w-1.5 rounded-full transition-colors",
                  level.value === value ? "bg-primary" : "bg-muted-foreground/35",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettingsPanel() {
  const { uiTextSize, conversationTextSize, terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
  useI18nSnapshot();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{t("settings.appearance.title")}</div>
      </div>
      <div className="grid gap-4">
        <TextSizeSlider
          id="OMNI_UI_TEXT_SIZE"
          labelKey="settings.appearance.uiFontSize"
          descriptionKey="settings.appearance.uiFontSizeDescription"
          value={uiTextSize}
          levels={UI_TEXT_SIZE_LEVELS}
          onChange={(nextValue) => appearancePreferencesManager.setUiTextSize(nextValue)}
        />
        <TextSizeSlider
          id="OMNI_CONVERSATION_TEXT_SIZE"
          labelKey="settings.appearance.conversationFontSize"
          descriptionKey="settings.appearance.conversationFontSizeDescription"
          value={conversationTextSize}
          levels={CONVERSATION_TEXT_SIZE_LEVELS}
          onChange={(nextValue) => appearancePreferencesManager.setConversationTextSize(nextValue)}
        />
        <TextSizeSlider
          id="OMNI_TERMINAL_TEXT_SIZE"
          labelKey="settings.appearance.terminalFontSize"
          descriptionKey="settings.appearance.terminalFontSizeDescription"
          value={terminalTextSize}
          levels={TERMINAL_TEXT_SIZE_LEVELS}
          onChange={(nextValue) => appearancePreferencesManager.setTerminalTextSize(nextValue)}
        />
      </div>
    </div>
  );
}
