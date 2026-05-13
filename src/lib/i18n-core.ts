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

const notifyI18nListeners = (i18nManager as unknown as { notify: () => void }).notify.bind(i18nManager);
const enqueueMicrotask = typeof queueMicrotask === "function"
  ? queueMicrotask
  : (callback: () => void) => {
      void Promise.resolve().then(callback);
    };
let translationDepth = 0;
let hasDeferredI18nNotify = false;

(i18nManager as unknown as { notify: () => void }).notify = () => {
  if (translationDepth === 0) {
    notifyI18nListeners();
    return;
  }

  if (hasDeferredI18nNotify) {
    return;
  }

  hasDeferredI18nNotify = true;
  enqueueMicrotask(() => {
    hasDeferredI18nNotify = false;
    notifyI18nListeners();
  });
};

export const t: typeof i18nManager.t = (...args) => {
  translationDepth += 1;
  try {
    return i18nManager.t(...args);
  } finally {
    translationDepth -= 1;
  }
};

export function supportedLocaleOptions() {
  return i18nManager.getSnapshot().supportedLocales.map((locale) => ({
    value: locale,
    label: t(`language.${locale}`),
  }));
}
