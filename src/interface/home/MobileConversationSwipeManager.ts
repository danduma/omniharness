const DRAG_INTENT_SLOP_PX = 10;
const HORIZONTAL_DOMINANCE_RATIO = 1.5;
// Fraction of the drawer width a drag must travel, in its own direction, to
// commit when released without a flick.
const COMMIT_DISTANCE_RATIO = 0.25;
const FLING_VELOCITY_PX_PER_MS = 0.5;
const FALLBACK_DRAWER_WIDTH_RATIO = 0.85;

type SwipePointer = {
  button: number;
  clientX: number;
  clientY: number;
  isPrimary: boolean;
  pointerId: number;
  pointerType: string;
  timeStamp: number;
};

// "open" drags start on the conversation with the drawer closed;
// "close" drags start inside the open drawer.
export type MobileDrawerSwipeMode = "open" | "close";

// The open state the drawer should settle into once a drag ends.
export type MobileDrawerSwipeOutcome = "open" | "close";

type ActiveSwipe = {
  pointerId: number;
  mode: MobileDrawerSwipeMode;
  startX: number;
  startY: number;
  dragging: boolean;
  lastX: number;
  lastTime: number;
  velocityX: number;
};

export type MobileDrawerDragSnapshot =
  | { phase: "idle" }
  // offsetPx is how much of the drawer is revealed, from 0 to its width.
  | { phase: "dragging"; offsetPx: number; progress: number }
  // The drag was released short of opening; slide fully out while the sheet closes.
  | { phase: "closing" };

const IDLE_SNAPSHOT: MobileDrawerDragSnapshot = { phase: "idle" };

export class MobileConversationSwipeManager {
  private activeSwipe: ActiveSwipe | null = null;
  private drawerWidth: number | null = null;
  private snapshot: MobileDrawerDragSnapshot = IDLE_SNAPSHOT;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private setSnapshot(snapshot: MobileDrawerDragSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }

  setDrawerWidth(width: number | null) {
    this.drawerWidth = width && width > 0 ? width : null;
  }

  private resolveDrawerWidth() {
    if (this.drawerWidth) {
      return this.drawerWidth;
    }
    const viewportWidth = typeof window === "undefined" ? 390 : window.innerWidth;
    return viewportWidth * FALLBACK_DRAWER_WIDTH_RATIO;
  }

  private offsetFor(swipe: ActiveSwipe, clientX: number) {
    const width = this.resolveDrawerWidth();
    const delta = clientX - swipe.startX;
    const offset = swipe.mode === "open" ? delta : width + delta;
    return Math.min(width, Math.max(0, offset));
  }

  private publishDrag(swipe: ActiveSwipe, clientX: number) {
    const offsetPx = this.offsetFor(swipe, clientX);
    this.setSnapshot({
      phase: "dragging",
      offsetPx,
      progress: offsetPx / this.resolveDrawerWidth(),
    });
  }

  start(pointer: SwipePointer, compactLayout: boolean, mode: MobileDrawerSwipeMode = "open") {
    this.activeSwipe = null;
    if (
      !compactLayout
      || pointer.pointerType !== "touch"
      || !pointer.isPrimary
      || pointer.button !== 0
    ) {
      return false;
    }

    if (this.snapshot.phase !== "idle") {
      this.setSnapshot(IDLE_SNAPSHOT);
    }
    this.activeSwipe = {
      pointerId: pointer.pointerId,
      mode,
      startX: pointer.clientX,
      startY: pointer.clientY,
      dragging: false,
      lastX: pointer.clientX,
      lastTime: pointer.timeStamp,
      velocityX: 0,
    };
    return true;
  }

  // Returns true on the move that turns the touch into a drawer drag, so an
  // "open" caller can mount the drawer and let it follow the finger.
  move(pointer: SwipePointer) {
    const swipe = this.activeSwipe;
    if (!swipe || pointer.pointerId !== swipe.pointerId) {
      return false;
    }

    const elapsed = pointer.timeStamp - swipe.lastTime;
    if (elapsed > 0) {
      swipe.velocityX = (pointer.clientX - swipe.lastX) / elapsed;
    }
    swipe.lastX = pointer.clientX;
    swipe.lastTime = pointer.timeStamp;

    if (swipe.dragging) {
      this.publishDrag(swipe, pointer.clientX);
      return false;
    }

    const horizontalDelta = pointer.clientX - swipe.startX;
    const horizontalDistance = swipe.mode === "open" ? horizontalDelta : -horizontalDelta;
    const verticalDistance = Math.abs(pointer.clientY - swipe.startY);
    if (horizontalDistance >= DRAG_INTENT_SLOP_PX && horizontalDistance >= verticalDistance * HORIZONTAL_DOMINANCE_RATIO) {
      swipe.dragging = true;
      // Measure from the point the drag was recognised so the drawer edge
      // tracks the finger instead of jumping by the slop distance.
      swipe.startX = pointer.clientX;
      this.publishDrag(swipe, pointer.clientX);
      return true;
    }
    if (verticalDistance >= DRAG_INTENT_SLOP_PX && verticalDistance > Math.abs(horizontalDelta)) {
      this.activeSwipe = null;
    }
    return false;
  }

  private settle(pointer: Pick<SwipePointer, "pointerId">, allowFling: boolean): MobileDrawerSwipeOutcome | null {
    const swipe = this.activeSwipe;
    if (!swipe || pointer.pointerId !== swipe.pointerId) {
      return null;
    }
    this.activeSwipe = null;
    if (!swipe.dragging) {
      return null;
    }

    const snapshot = this.snapshot;
    const progress = snapshot.phase === "dragging" ? snapshot.progress : 0;
    const flingVelocity = allowFling ? swipe.velocityX : 0;
    let outcome: MobileDrawerSwipeOutcome;
    if (flingVelocity >= FLING_VELOCITY_PX_PER_MS) {
      outcome = "open";
    } else if (flingVelocity <= -FLING_VELOCITY_PX_PER_MS) {
      outcome = "close";
    } else {
      const travelled = swipe.mode === "open" ? progress : 1 - progress;
      const committed = travelled >= COMMIT_DISTANCE_RATIO;
      outcome = committed === (swipe.mode === "open") ? "open" : "close";
    }

    // Opening drops the inline drag transform so the sheet's own transition
    // carries it the rest of the way in. Closing keeps it pinned off-screen
    // until the sheet finishes unmounting.
    this.setSnapshot(outcome === "open" ? IDLE_SNAPSHOT : { phase: "closing" });
    return outcome;
  }

  finish(pointer: SwipePointer) {
    if (this.activeSwipe?.dragging && pointer.pointerId === this.activeSwipe.pointerId) {
      this.move(pointer);
    }
    return this.settle(pointer, true);
  }

  cancel(pointer: Pick<SwipePointer, "pointerId">) {
    return this.settle(pointer, false);
  }

  handleDrawerOpenChangeComplete(open: boolean) {
    if (!open && this.snapshot.phase === "closing") {
      this.setSnapshot(IDLE_SNAPSHOT);
    }
  }
}

export const mobileConversationSwipeManager = new MobileConversationSwipeManager();
