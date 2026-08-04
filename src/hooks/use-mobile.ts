import { StateManager, type StateListener } from "@/lib/state-manager"
import { useManagerSnapshot } from "@/lib/use-manager-snapshot"

const MOBILE_BREAKPOINT = 768
const COMPACT_LAYOUT_BREAKPOINT = 1024

class ViewportManager extends StateManager<{ isBelowBreakpoint: boolean }> {
  private mediaQuery: MediaQueryList | null = null
  private listenerCount = 0

  constructor(private readonly breakpoint: number) {
    super({ isBelowBreakpoint: false })
  }

  private readonly handleChange = () => {
    this.setKey("isBelowBreakpoint", window.innerWidth < this.breakpoint)
  }

  override subscribe(listener: StateListener) {
    if (typeof window !== "undefined" && this.listenerCount === 0) {
      this.mediaQuery = window.matchMedia(`(max-width: ${this.breakpoint - 1}px)`)
      this.mediaQuery.addEventListener("change", this.handleChange)
      this.handleChange()
    }
    this.listenerCount += 1
    const unsubscribe = super.subscribe(listener)
    return () => {
      unsubscribe()
      this.listenerCount -= 1
      if (this.listenerCount === 0) {
        this.mediaQuery?.removeEventListener("change", this.handleChange)
        this.mediaQuery = null
      }
    }
  }
}

export const viewportManager = new ViewportManager(MOBILE_BREAKPOINT)

/** Matches the `lg:` breakpoint the app uses to switch to its phone/tablet chrome. */
export const compactLayoutManager = new ViewportManager(COMPACT_LAYOUT_BREAKPOINT)

export function useIsMobile() {
  return useManagerSnapshot(viewportManager).isBelowBreakpoint
}

export function useIsCompactLayout() {
  return useManagerSnapshot(compactLayoutManager).isBelowBreakpoint
}
