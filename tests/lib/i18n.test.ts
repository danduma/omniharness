import { describe, expect, it } from "vitest";
import {
  OMNI_LOCALE_STORAGE_KEY,
  i18nManager,
  localeLoaders,
  supportedLocaleOptions,
  t,
} from "@/lib/i18n";

describe("OmniHarness i18n adapter", () => {
  it("loads application strings from the linked i18n resource", () => {
    expect(t("product.name")).toBe("OmniHarness");
    expect(t("settings.language.current", { language: "English" })).toBe("Current language: English");
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
    expect(t("settings.language.current", { language: "Español" })).toBe("Idioma actual: Español");
    expect(Object.keys(localeLoaders)).toEqual(["es", "fr", "de", "it", "pt", "zh-CN", "ja", "ko"]);
  });
});
