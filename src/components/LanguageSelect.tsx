"use client";

import { useCallback } from "react";
import { i18nManager, supportedLocaleOptions, t, useI18nSnapshot, type OmniLocale } from "@/lib/i18n";
import { Select } from "@/components/ui/select";

export function LanguageSelect() {
  const { locale } = useI18nSnapshot();

  const handleLanguageChange = useCallback((value: string) => {
    void i18nManager.setLocaleAsync(value as OmniLocale);
  }, []);

  return (
    <div className="inline-grid max-w-full space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor="OMNI_LANGUAGE">
        {t("settings.language.label")}
      </label>
      <Select
        id="OMNI_LANGUAGE"
        className="w-auto min-w-40 max-w-full"
        value={locale}
        options={supportedLocaleOptions()}
        onValueChange={handleLanguageChange}
      />
    </div>
  );
}
