import { StateManager, type StateListener } from "@/lib/state-manager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export type VisualViewportSnapshot = {
  height: number | null;
  offsetTop: number;
};

const initialSnapshot: VisualViewportSnapshot = {
  height: null,
  offsetTop: 0,
};

class VisualViewportManager extends StateManager<VisualViewportSnapshot> {
  private listenerCount = 0;
  private visualViewport: VisualViewport | null = null;

  constructor() {
    super(initialSnapshot);
  }

  private readonly handleChange = () => {
    if (typeof window === "undefined") {
      return;
    }

    const viewport = window.visualViewport;
    this.update({
      height: viewport?.height ?? window.innerHeight,
      offsetTop: viewport?.offsetTop ?? 0,
    });
  };

  override subscribe(listener: StateListener) {
    if (typeof window !== "undefined" && this.listenerCount === 0) {
      this.visualViewport = window.visualViewport;
      window.addEventListener("resize", this.handleChange);
      window.addEventListener("scroll", this.handleChange);
      this.visualViewport?.addEventListener("resize", this.handleChange);
      this.visualViewport?.addEventListener("scroll", this.handleChange);
      this.handleChange();
    }

    this.listenerCount += 1;
    const unsubscribe = super.subscribe(listener);
    return () => {
      unsubscribe();
      this.listenerCount -= 1;
      if (this.listenerCount === 0) {
        window.removeEventListener("resize", this.handleChange);
        window.removeEventListener("scroll", this.handleChange);
        this.visualViewport?.removeEventListener("resize", this.handleChange);
        this.visualViewport?.removeEventListener("scroll", this.handleChange);
        this.visualViewport = null;
      }
    };
  }
}

const visualViewportManager = new VisualViewportManager();

export function useVisualViewportSnapshot() {
  return useManagerSnapshot(visualViewportManager);
}

export function getVisualViewportDialogStyle(
  viewport: VisualViewportSnapshot,
): { top: string; maxHeight: string } | undefined {
  if (viewport.height === null) {
    return undefined;
  }

  return {
    top: `${viewport.offsetTop + viewport.height / 2}px`,
    maxHeight: `${Math.max(viewport.height - 32, 0)}px`,
  };
}
