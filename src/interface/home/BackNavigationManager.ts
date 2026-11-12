import { homeUiStateManager } from "./HomeUiStateManager";

const HISTORY_GUARD = "omniBackGuard";
const OPEN_LAYER_SELECTOR = [
  'dialog[open]',
  '[data-slot="dialog-content"][data-open]',
  '[data-slot="sheet-content"][data-open]',
  '[data-slot="dropdown-menu-content"][data-open]',
  '[data-slot="popover-content"][data-open]',
  '[data-slot="select-content"][data-open]',
  '[data-slot="context-menu-content"][data-open]',
].join(",");

export class BackNavigationManager {
  dismiss(win: Window) {
    // Let the existing primitives dismiss the top layer and restore focus.
    // Dispatch on the layer, never the composer (Escape there stops a worker).
    const layer = Array.from(win.document.querySelectorAll<HTMLElement>(OPEN_LAYER_SELECTOR)).at(-1);
    if (layer) {
      layer.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      return;
    }

    const state = homeUiStateManager.getSnapshot();
    const panels = win.matchMedia("(min-width: 1024px)").matches
      ? ["terminalPanelOpen", "rightSidebarOpen", "leftSidebarOpen"] as const
      : ["mobileTerminalOpen", "mobileWorkersOpen", "mobileNavOpen"] as const;
    const openPanel = panels.find((key) => state[key]);
    if (openPanel) homeUiStateManager.setKey(openPanel, false);
  }

  attach(win: Window) {
    // Keep a single sentinel above the app's entry. Restoring it with Forward
    // preserves session URL replacements and never accumulates history entries.
    if (!win.history.state?.[HISTORY_GUARD]) {
      win.history.pushState({ ...win.history.state, [HISTORY_GUARD]: true }, "");
    }
    const onPopState = (event: PopStateEvent) => {
      if (event.state?.[HISTORY_GUARD]) return;
      win.history.forward();
      this.dismiss(win);
    };
    const onNativeBack = () => this.dismiss(win);
    win.addEventListener("popstate", onPopState);
    win.addEventListener("omni:back", onNativeBack);
    return () => {
      win.removeEventListener("popstate", onPopState);
      win.removeEventListener("omni:back", onNativeBack);
    };
  }
}

export const backNavigationManager = new BackNavigationManager();
