import { describe, expect, it } from "vitest";
import {
  OMNI_LOCALE_STORAGE_KEY,
  i18nManager,
  localeLoaders,
  supportedLocaleOptions,
  t,
} from "@/lib/i18n";
import de from "../../shared/locales/de.json";
import en from "../../shared/locales/en.json";
import es from "../../shared/locales/es.json";
import fr from "../../shared/locales/fr.json";
import itLocale from "../../shared/locales/it.json";
import ja from "../../shared/locales/ja.json";
import ko from "../../shared/locales/ko.json";
import pt from "../../shared/locales/pt.json";
import zhCN from "../../shared/locales/zh-CN.json";

describe("OmniHarness i18n adapter", () => {
  it("loads application strings through the shared i18n dependency", () => {
    expect(t("product.name")).toBe("OmniHarness");
    expect(t("settings.appearance.uiFontSizeDescription")).toBe("Navigation, sidebars, buttons, and settings.");
  });

  it("exposes the OmniHarness locale persistence key and supported locale options", () => {
    expect(OMNI_LOCALE_STORAGE_KEY).toBe("omni-locale");
    expect(i18nManager.getSnapshot().supportedLocales).toEqual(["en", "es", "fr", "de", "it", "pt", "zh-CN", "ja", "ko"]);
    expect(supportedLocaleOptions()).toEqual([
      { value: "en", label: "English" },
      { value: "es", label: "Spanish" },
      { value: "fr", label: "French" },
      { value: "de", label: "German" },
      { value: "it", label: "Italian" },
      { value: "pt", label: "Portuguese" },
      { value: "zh-CN", label: "Chinese Simplified" },
      { value: "ja", label: "Japanese" },
      { value: "ko", label: "Korean" },
    ]);
  });

  it("keeps the i18n snapshot reference stable between locale updates", () => {
    const snapshot = i18nManager.getSnapshot();

    expect(i18nManager.getSnapshot()).toBe(snapshot);
  });

  it("loads non-English locale resources on demand", async () => {
    expect(i18nManager.getSnapshot().loadedLocales).toEqual(["en"]);

    await i18nManager.setLocaleAsync("es");

    expect(i18nManager.getSnapshot().locale).toBe("es");
    expect(i18nManager.getSnapshot().loadedLocales).toContain("es");
    expect(t("settings.appearance.uiFontSize")).toBe("Interfaz");
    expect(Object.keys(localeLoaders)).toEqual(["es", "fr", "de", "it", "pt", "zh-CN", "ja", "ko"]);
  });

  it("keeps all locale files in key parity with English", () => {
    const englishKeys = Object.keys(en).sort();

    expect(Object.keys(es).sort()).toEqual(englishKeys);
    expect(Object.keys(fr).sort()).toEqual(englishKeys);
    expect(Object.keys(de).sort()).toEqual(englishKeys);
    expect(Object.keys(itLocale).sort()).toEqual(englishKeys);
    expect(Object.keys(pt).sort()).toEqual(englishKeys);
    expect(Object.keys(zhCN).sort()).toEqual(englishKeys);
    expect(Object.keys(ja).sort()).toEqual(englishKeys);
    expect(Object.keys(ko).sort()).toEqual(englishKeys);
  });

  it("defers missing key notifications until after translation returns", async () => {
    let notificationCount = 0;
    const unsubscribe = i18nManager.subscribe(() => {
      notificationCount += 1;
    });

    try {
      expect(t(`test.missing.${Date.now()}`)).toMatch(/^test\.missing\./);
      expect(notificationCount).toBe(0);

      await Promise.resolve();

      expect(notificationCount).toBe(1);
    } finally {
      unsubscribe();
    }
  });
});
