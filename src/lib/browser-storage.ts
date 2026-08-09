export type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * These entries are disposable previews. Server state and the live event
 * stream remain authoritative, so they must never be allowed to crowd out
 * preferences, runner profiles, or credentials in the origin quota.
 */
export const PREVIEW_CACHE_STORAGE_KEYS = [
  "omni-event-stream-snapshot-cache:v1",
  "omni-worker-entries-cache:v2",
  "omni-worker-entries-cache:v1",
] as const;

export function getBrowserLocalStorage(): BrowserStorage | null {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function clearPreviewCacheStorage(storage: BrowserStorage | null = getBrowserLocalStorage()) {
  if (!storage) {
    return;
  }

  for (const key of PREVIEW_CACHE_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be readable but refuse mutations; keep the live app usable.
    }
  }
}

function isQuotaExceededError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { name?: unknown; code?: unknown };
  return record.name === "QuotaExceededError"
    || record.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || record.code === 22
    || record.code === 1014;
}

/**
 * Persist small browser preferences without allowing localStorage failures to
 * escape into React rendering. A quota failure gets one targeted recovery:
 * remove only disposable preview caches, then retry the original write.
 */
export function safeSetBrowserStorageItem(
  storage: BrowserStorage | null | undefined,
  key: string,
  value: string,
) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      return false;
    }

    clearPreviewCacheStorage(storage);
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}
