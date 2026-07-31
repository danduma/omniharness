import { StateManager, type StateListener } from "@/lib/state-manager"
import { useManagerSnapshot } from "@/lib/use-manager-snapshot"

const MOBILE_BREAKPOINT = 768

class ViewportManager extends StateManager<{ isMobile: boolean }> {
  private mediaQuery: MediaQueryList | null = null
  private listenerCount = 0

  constructor() {
    super({ isMobile: false })
  }

  private readonly handleChange = () => {
    this.setKey("isMobile", window.innerWidth < MOBILE_BREAKPOINT)
  }

  override subscribe(listener: StateListener) {
    if (typeof window !== "undefined" && this.listenerCount === 0) {
      this.mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
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

export const viewportManager = new ViewportManager()

export function useIsMobile() {
  return useManagerSnapshot(viewportManager).isMobile
}
