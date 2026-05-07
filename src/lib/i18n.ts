import { createI18nManager } from "@danduma/i18n";
import en from "../../shared/locales/en.json";

export const OMNI_LOCALE_STORAGE_KEY = "omni-locale";

export const localeLoaders = {
  es: async () => (await import("../../shared/locales/es.json")).default,
  fr: async () => (await import("../../shared/locales/fr.json")).default,
  de: async () => (await import("../../shared/locales/de.json")).default,
  it: async () => (await import("../../shared/locales/it.json")).default,
  pt: async () => (await import("../../shared/locales/pt.json")).default,
  "zh-CN": async () => (await import("../../shared/locales/zh-CN.json")).default,
  ja: async () => (await import("../../shared/locales/ja.json")).default,
  ko: async () => (await import("../../shared/locales/ko.json")).default,
} as const;

const dictionaries = {
  en,
} as const;

export type OmniLocale = keyof typeof dictionaries | keyof typeof localeLoaders;

export const i18nManager = createI18nManager<OmniLocale>({
  dictionaries,
  localeLoaders,
  fallbackLocale: "en",
  storageKey: OMNI_LOCALE_STORAGE_KEY,
});

export const t = i18nManager.t;

export function supportedLocaleOptions() {
  return i18nManager.getSnapshot().supportedLocales.map((locale) => ({
    value: locale,
    label: t(`language.${locale}`),
  }));
}
