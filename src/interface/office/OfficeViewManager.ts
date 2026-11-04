import { StateManager } from "@/lib/state-manager";
import { safeSetBrowserStorageItem, type BrowserStorage } from "@/lib/browser-storage";

export type WorkersViewMode = "list" | "office";

export const WORKERS_VIEW_MODE_STORAGE_KEY = "omniharness:workers-view-mode";

/**
 * Per-viewer choice between the worker list and the office view. The office
 * is opt-in (PRODUCT.md rejects gratuitous motion), so the default is "list".
 * Stored per browser only; it is a viewing convenience, not shared state.
 */
export class OfficeViewManager extends StateManager<{ viewMode: WorkersViewMode }> {
  constructor(private readonly storage: BrowserStorage | null = null) {
    super({ viewMode: "list" });
  }

  hydrate(storage: Pick<Storage, "getItem"> | null = this.storage ?? browserStorage()) {
    let stored: string | null = null;
    try {
      stored = storage?.getItem(WORKERS_VIEW_MODE_STORAGE_KEY) ?? null;
    } catch {
      // Storage can throw in private windows; keep the default view.
      stored = null;
    }
    if (stored === "list" || stored === "office") {
      this.setKey("viewMode", stored);
    }
  }

  setViewMode = (viewMode: WorkersViewMode) => {
    this.setKey("viewMode", viewMode);
    safeSetBrowserStorageItem(this.storage ?? browserStorage(), WORKERS_VIEW_MODE_STORAGE_KEY, viewMode);
  };
}

function browserStorage(): BrowserStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const officeViewManager = new OfficeViewManager();
