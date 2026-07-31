export type LocaleCode = string;
export type LocaleDictionary = Record<string, string>;
export type I18nParams = Record<string, unknown>;
export type I18nSnapshot<TLocale extends LocaleCode = LocaleCode> = {
  locale: TLocale;
  fallbackLocale: TLocale;
  supportedLocales: TLocale[];
  loadedLocales: TLocale[];
  missingKeys: string[];
};
export type LocaleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
export type CreateI18nManagerOptions<TLocale extends LocaleCode> = {
  dictionaries: Partial<Record<TLocale, LocaleDictionary>>;
  localeLoaders?: Partial<Record<
    TLocale,
    () => LocaleDictionary | Promise<LocaleDictionary>
  >>;
  fallbackLocale: TLocale;
  initialLocale?: string | null;
  storageKey?: string;
  storage?: LocaleStorage | null;
  getBrowserLocale?: (() => string | null | undefined) | null;
  syncDocumentLanguage?: boolean;
  fallbackToFallbackLocale?: boolean;
};

const interpolationPattern = /\{(\w+)\}/g;

export function formatTemplate(template: string, params: I18nParams = {}) {
  return template.replace(interpolationPattern, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

function languagePrefix(locale: string) {
  return locale.split("-")[0]?.toLowerCase() ?? "";
}

export function resolveSupportedLocale<TLocale extends LocaleCode>(
  requestedLocale: string | null | undefined,
  supportedLocales: readonly TLocale[],
  fallbackLocale: TLocale,
) {
  const normalized = requestedLocale?.trim().replace("_", "-") || "";
  if (!normalized) {
    return fallbackLocale;
  }
  return supportedLocales.find(
    (locale) => locale.toLowerCase() === normalized.toLowerCase(),
  ) ?? supportedLocales.find(
    (locale) => languagePrefix(locale) === languagePrefix(normalized),
  ) ?? fallbackLocale;
}

export class I18nManager<TLocale extends LocaleCode> {
  private locale: TLocale;
  private readonly dictionaries: Partial<Record<TLocale, LocaleDictionary>>;
  private readonly localeLoaders: NonNullable<
    CreateI18nManagerOptions<TLocale>["localeLoaders"]
  >;
  private readonly fallbackLocale: TLocale;
  private readonly supportedLocales: TLocale[];
  private readonly storageKey: string;
  private readonly storage: LocaleStorage | null;
  private readonly getBrowserLocale: (() => string | null | undefined) | null;
  private readonly syncDocumentLanguage: boolean;
  private readonly fallbackToFallbackLocale: boolean;
  private readonly listeners = new Set<() => void>();
  private readonly missingKeys = new Set<string>();

  constructor(options: CreateI18nManagerOptions<TLocale>) {
    this.dictionaries = { ...options.dictionaries };
    this.localeLoaders = options.localeLoaders ?? {};
    this.fallbackLocale = options.fallbackLocale;
    this.supportedLocales = Array.from(new Set([
      ...Object.keys(options.dictionaries),
      ...Object.keys(this.localeLoaders),
    ])) as TLocale[];
    this.storageKey = options.storageKey ?? "locale";
    this.storage = options.storage === undefined
      ? typeof window === "undefined" ? null : window.localStorage
      : options.storage;
    this.getBrowserLocale = options.getBrowserLocale === undefined
      ? () => typeof window === "undefined" ? null : window.navigator.language
      : options.getBrowserLocale;
    this.syncDocumentLanguage = options.syncDocumentLanguage ?? true;
    this.fallbackToFallbackLocale =
      options.fallbackToFallbackLocale ?? true;
    this.locale = resolveSupportedLocale(
      options.initialLocale,
      this.supportedLocales,
      this.fallbackLocale,
    );
    if (!this.dictionaries[this.fallbackLocale]) {
      throw new Error(
        `Missing fallback locale dictionary: ${this.fallbackLocale}`,
      );
    }
  }

  getSnapshot(): I18nSnapshot<TLocale> {
    return {
      locale: this.locale,
      fallbackLocale: this.fallbackLocale,
      supportedLocales: [...this.supportedLocales],
      loadedLocales: Object.keys(this.dictionaries) as TLocale[],
      missingKeys: [...this.missingKeys],
    };
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  hydrate() {
    const locale = resolveSupportedLocale(
      this.readStoredLocale() || this.getBrowserLocale?.(),
      this.supportedLocales,
      this.fallbackLocale,
    );
    this.applyLocale(locale, false);
    return locale;
  }

  async hydrateAsync() {
    const locale = resolveSupportedLocale(
      this.readStoredLocale() || this.getBrowserLocale?.(),
      this.supportedLocales,
      this.fallbackLocale,
    );
    await this.ensureLocale(locale);
    this.applyLocale(locale, false);
    return locale;
  }

  setLocale(locale: string) {
    const supported = resolveSupportedLocale(
      locale,
      this.supportedLocales,
      this.fallbackLocale,
    );
    this.applyLocale(supported, true);
    return supported;
  }

  async setLocaleAsync(locale: string) {
    const supported = resolveSupportedLocale(
      locale,
      this.supportedLocales,
      this.fallbackLocale,
    );
    await this.ensureLocale(supported);
    this.applyLocale(supported, true);
    return supported;
  }

  resetLocale() {
    this.removeStoredLocale();
    return this.hydrate();
  }

  async resetLocaleAsync() {
    this.removeStoredLocale();
    return this.hydrateAsync();
  }

  async ensureLocale(locale: string) {
    const supported = resolveSupportedLocale(
      locale,
      this.supportedLocales,
      this.fallbackLocale,
    );
    if (this.dictionaries[supported]) {
      return supported;
    }
    const loader = this.localeLoaders[supported];
    if (!loader) {
      return this.fallbackLocale;
    }
    this.dictionaries[supported] = await loader();
    this.notify();
    return supported;
  }

  t = (key: string, params: I18nParams = {}, defaultMessage?: string) => {
    const localized = this.dictionaries[this.locale]?.[key];
    const fallback = this.fallbackToFallbackLocale
      ? this.dictionaries[this.fallbackLocale]?.[key]
      : undefined;
    const template = localized ?? fallback ?? defaultMessage;
    if (template === undefined) {
      if (!this.missingKeys.has(key)) {
        this.missingKeys.add(key);
        this.notify();
      }
      return key;
    }
    return formatTemplate(template, params);
  };

  private applyLocale(locale: TLocale, persist: boolean) {
    const changed = this.locale !== locale;
    this.locale = locale;
    if (persist) {
      try {
        this.storage?.setItem(this.storageKey, locale);
      } catch {
        // Locale persistence is best effort.
      }
    }
    if (this.syncDocumentLanguage && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    if (changed) {
      this.notify();
    }
  }

  private readStoredLocale() {
    try {
      return this.storage?.getItem(this.storageKey) ?? null;
    } catch {
      return null;
    }
  }

  private removeStoredLocale() {
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      // Locale persistence is best effort.
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createI18nManager<TLocale extends LocaleCode>(
  options: CreateI18nManagerOptions<TLocale>,
) {
  return new I18nManager(options);
}
