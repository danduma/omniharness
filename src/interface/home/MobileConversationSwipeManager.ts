const MIN_HORIZONTAL_DISTANCE_PX = 72;
const HORIZONTAL_DOMINANCE_RATIO = 1.5;

type SwipePointer = {
  button: number;
  clientX: number;
  clientY: number;
  isPrimary: boolean;
  pointerId: number;
  pointerType: string;
};

type ActiveSwipe = {
  pointerId: number;
  startX: number;
  startY: number;
};

type SwipeDirection = "left" | "right";

export class MobileConversationSwipeManager {
  private activeSwipe: ActiveSwipe | null = null;

  private matches(pointer: SwipePointer, direction: SwipeDirection) {
    const activeSwipe = this.activeSwipe;
    if (!activeSwipe || pointer.pointerId !== activeSwipe.pointerId) {
      return false;
    }

    const horizontalDelta = pointer.clientX - activeSwipe.startX;
    const horizontalDistance = direction === "right" ? horizontalDelta : -horizontalDelta;
    const verticalDistance = Math.abs(pointer.clientY - activeSwipe.startY);
    return horizontalDistance >= MIN_HORIZONTAL_DISTANCE_PX
      && horizontalDistance >= verticalDistance * HORIZONTAL_DOMINANCE_RATIO;
  }

  start(pointer: SwipePointer, compactLayout: boolean) {
    this.activeSwipe = null;
    if (
      !compactLayout
      || pointer.pointerType !== "touch"
      || !pointer.isPrimary
      || pointer.button !== 0
    ) {
      return false;
    }

    this.activeSwipe = {
      pointerId: pointer.pointerId,
      startX: pointer.clientX,
      startY: pointer.clientY,
    };
    return true;
  }

  move(pointer: SwipePointer, direction: SwipeDirection = "right") {
    if (!this.matches(pointer, direction)) {
      return false;
    }

    this.activeSwipe = null;
    return true;
  }

  finish(pointer: SwipePointer, direction: SwipeDirection = "right") {
    const activeSwipe = this.activeSwipe;
    if (!activeSwipe || pointer.pointerId !== activeSwipe.pointerId) {
      return false;
    }

    const matches = this.matches(pointer, direction);
    this.activeSwipe = null;
    return matches;
  }

  cancel(pointerId: number) {
    if (this.activeSwipe?.pointerId === pointerId) {
      this.activeSwipe = null;
    }
  }
}

export const mobileConversationSwipeManager = new MobileConversationSwipeManager();
