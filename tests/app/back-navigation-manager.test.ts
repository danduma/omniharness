import { afterEach, describe, expect, it, vi } from "vitest";
import { BackNavigationManager } from "@/interface/home/BackNavigationManager";
import { homeUiStateManager } from "@/interface/home/HomeUiStateManager";

function browser(desktop = false) {
  const listeners = new Map<string, EventListener>();
  const history = {
    state: { session: "preserved" },
    pushState: vi.fn(function (state: object) { history.state = state as typeof history.state; }),
    forward: vi.fn(),
  };
  const layers: { dispatchEvent: ReturnType<typeof vi.fn> }[] = [];
  const win = {
    history,
    document: { querySelectorAll: vi.fn(() => layers) },
    matchMedia: () => ({ matches: desktop }),
    addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
  } as unknown as Window;
  return { win, history, layers, listeners };
}

afterEach(() => {
  homeUiStateManager.update(homeUiStateManager.getInitialSnapshot());
  vi.unstubAllGlobals();
});

describe("BackNavigationManager", () => {
  it("dismisses only the top overlay before the navigation beneath it", () => {
    vi.stubGlobal("KeyboardEvent", class { constructor(public type: string, public options: object) {} });
    const { win, layers } = browser();
    layers.push({ dispatchEvent: vi.fn() }, { dispatchEvent: vi.fn() });
    homeUiStateManager.setKey("mobileNavOpen", true);
    new BackNavigationManager().dismiss(win);
    expect(layers[0].dispatchEvent).not.toHaveBeenCalled();
    expect(layers[1].dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "keydown", options: { key: "Escape", bubbles: true, cancelable: true },
    }));
    expect(homeUiStateManager.getSnapshot().mobileNavOpen).toBe(true);
  });

  it("closes mobile panels one at a time and leaves hidden desktop panels alone", () => {
    const { win } = browser();
    const manager = new BackNavigationManager();
    homeUiStateManager.patch({ mobileNavOpen: true, mobileWorkersOpen: true });
    manager.dismiss(win);
    expect(homeUiStateManager.getSnapshot()).toMatchObject({ mobileWorkersOpen: false, mobileNavOpen: true });
    manager.dismiss(win);
    manager.dismiss(win);
    expect(homeUiStateManager.getSnapshot()).toMatchObject({ mobileNavOpen: false, leftSidebarOpen: true });
  });

  it("closes a desktop preview before the conversation sidebar", () => {
    const { win } = browser(true);
    homeUiStateManager.setKey("rightSidebarOpen", true);
    const manager = new BackNavigationManager();
    manager.dismiss(win);
    expect(homeUiStateManager.getSnapshot()).toMatchObject({ rightSidebarOpen: false, leftSidebarOpen: true });
    manager.dismiss(win);
    expect(homeUiStateManager.getSnapshot().leftSidebarOpen).toBe(false);
  });

  it("restores the guarded entry on every Back without growing history", () => {
    const { win, listeners, history } = browser();
    const manager = new BackNavigationManager();
    manager.attach(win);
    expect(history.pushState).toHaveBeenCalledWith({ session: "preserved", omniBackGuard: true }, "");
    for (let attempt = 0; attempt < 3; attempt++) {
      homeUiStateManager.setKey("mobileNavOpen", true);
      listeners.get("popstate")!({ state: { session: "preserved" } } as unknown as Event);
      expect(homeUiStateManager.getSnapshot().mobileNavOpen).toBe(false);
      homeUiStateManager.setKey("mobileNavOpen", true);
      listeners.get("popstate")!({ state: history.state } as unknown as Event);
      expect(homeUiStateManager.getSnapshot().mobileNavOpen).toBe(true);
    }
    expect(history.forward).toHaveBeenCalledTimes(3);
    expect(history.pushState).toHaveBeenCalledTimes(1);
  });

  it("handles native Back and reattaches without duplicating the sentinel", () => {
    const { win, listeners, history } = browser();
    const manager = new BackNavigationManager();
    const detach = manager.attach(win);
    homeUiStateManager.setKey("mobileNavOpen", true);
    listeners.get("omni:back")!(new Event("omni:back"));
    expect(homeUiStateManager.getSnapshot().mobileNavOpen).toBe(false);
    detach();
    expect(listeners.size).toBe(0);
    manager.attach(win);
    expect(history.pushState).toHaveBeenCalledTimes(1);
  });
});
