import { useCallback, useSyncExternalStore } from "react";
export {
  OMNI_LOCALE_STORAGE_KEY,
  i18nManager,
  localeLoaders,
  supportedLocaleOptions,
  t,
  type OmniLocale,
} from "./i18n-core";
import { i18nManager } from "./i18n-core";

export function useI18nSnapshot() {
  return useSyncExternalStore(
    useCallback((listener) => i18nManager.subscribe(listener), []),
    useCallback(() => i18nManager.getSnapshot(), []),
    () => i18nManager.getSnapshot(),
  );
}
