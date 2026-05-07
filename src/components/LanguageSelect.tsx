"use client";

import { useCallback, useSyncExternalStore } from "react";
import { i18nManager, supportedLocaleOptions, t, type OmniLocale } from "@/lib/i18n";

export function LanguageSelect() {
  const localeSnapshot = useSyncExternalStore(
    useCallback((listener) => i18nManager.subscribe(listener), []),
    useCallback(() => i18nManager.getSnapshot(), []),
    () => i18nManager.getSnapshot(),
  );

  const handleLanguageChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18nManager.setLocaleAsync(event.target.value as OmniLocale);
  }, []);

  const currentLanguageLabel = t(`language.${localeSnapshot.locale}`);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNI_LANGUAGE">
        {t("settings.language.label")}
      </label>
      <select
        id="OMNI_LANGUAGE"
        className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        value={localeSnapshot.locale}
        onChange={handleLanguageChange}
      >
        {supportedLocaleOptions().map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">
        {t("settings.language.current", { language: currentLanguageLabel })}
      </p>
    </div>
  );
}
