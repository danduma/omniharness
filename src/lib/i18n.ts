import { useCallback, useSyncExternalStore } from "react";
import { createI18nManager, type I18nSnapshot } from "@danduma/i18n";
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

function sameItems<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
}

function sameI18nSnapshot(left: I18nSnapshot<OmniLocale>, right: I18nSnapshot<OmniLocale>) {
  return left.locale === right.locale
    && left.fallbackLocale === right.fallbackLocale
    && sameItems(left.supportedLocales, right.supportedLocales)
    && sameItems(left.loadedLocales, right.loadedLocales)
    && sameItems(left.missingKeys, right.missingKeys);
}

const createStableI18nManager = () => {
  const manager = createI18nManager<OmniLocale>({
    dictionaries,
    localeLoaders,
    fallbackLocale: "en",
    storageKey: OMNI_LOCALE_STORAGE_KEY,
  });
  const getUncachedSnapshot = manager.getSnapshot.bind(manager);
  let cachedSnapshot = getUncachedSnapshot();

  manager.getSnapshot = () => {
    const nextSnapshot = getUncachedSnapshot();

    if (sameI18nSnapshot(cachedSnapshot, nextSnapshot)) {
      return cachedSnapshot;
    }

    cachedSnapshot = nextSnapshot;
    return cachedSnapshot;
  };

  return manager;
};

export const i18nManager = createStableI18nManager();

export const t = i18nManager.t;

export function useI18nSnapshot() {
  return useSyncExternalStore(
    useCallback((listener) => i18nManager.subscribe(listener), []),
    useCallback(() => i18nManager.getSnapshot(), []),
    () => i18nManager.getSnapshot(),
  );
}

export function supportedLocaleOptions() {
  return i18nManager.getSnapshot().supportedLocales.map((locale) => ({
    value: locale,
    label: t(`language.${locale}`),
  }));
}
