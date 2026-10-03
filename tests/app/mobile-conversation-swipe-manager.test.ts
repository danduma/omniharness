import { describe, expect, it } from "vitest";
import { MobileConversationSwipeManager } from "@/interface/home/MobileConversationSwipeManager";

const DRAWER_WIDTH = 300;

function touchPoint(clientX: number, clientY: number, timeStamp = 0, pointerId = 1) {
  return {
    button: 0,
    clientX,
    clientY,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
    timeStamp,
  };
}

function createManager() {
  const manager = new MobileConversationSwipeManager();
  manager.setDrawerWidth(DRAWER_WIDTH);
  return manager;
}

describe("MobileConversationSwipeManager", () => {
  it("starts dragging once a horizontal swipe clears the slop, then tracks the finger", () => {
    const manager = createManager();

    expect(manager.start(touchPoint(24, 160), true, "open")).toBe(true);
    expect(manager.move(touchPoint(28, 161, 10))).toBe(false);
    expect(manager.getSnapshot()).toEqual({ phase: "idle" });

    expect(manager.move(touchPoint(40, 162, 20))).toBe(true);
    expect(manager.getSnapshot()).toEqual({ phase: "dragging", offsetPx: 0, progress: 0 });

    expect(manager.move(touchPoint(115, 164, 200))).toBe(false);
    expect(manager.getSnapshot()).toEqual({ phase: "dragging", offsetPx: 75, progress: 0.25 });

    manager.move(touchPoint(900, 164, 400));
    expect(manager.getSnapshot()).toMatchObject({ offsetPx: DRAWER_WIDTH, progress: 1 });
  });

  it("springs back closed when an open drag is released before a quarter of the way", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(100, 162, 400));
    expect(manager.finish(touchPoint(100, 162, 600))).toBe("close");
    expect(manager.getSnapshot()).toEqual({ phase: "closing" });

    manager.handleDrawerOpenChangeComplete(false);
    expect(manager.getSnapshot()).toEqual({ phase: "idle" });
  });

  it("opens fully when an open drag is released past a quarter of the way", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(130, 162, 600));
    expect(manager.finish(touchPoint(130, 162, 800))).toBe("open");
    expect(manager.getSnapshot()).toEqual({ phase: "idle" });
  });

  it("lets a quick flick decide the outcome regardless of distance", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(70, 160, 40));
    expect(manager.finish(touchPoint(100, 160, 60))).toBe("open");

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(240, 160, 600));
    manager.move(touchPoint(200, 160, 620));
    expect(manager.finish(touchPoint(170, 160, 640))).toBe("close");
  });

  it("ignores a flick that stalled before the finger lifted", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(100, 160, 40));
    expect(manager.finish(touchPoint(100, 160, 500))).toBe("close");
  });

  it("drags the open drawer closed from inside it", () => {
    const manager = createManager();

    manager.start(touchPoint(280, 160), true, "close");
    expect(manager.move(touchPoint(260, 160, 20))).toBe(true);
    expect(manager.getSnapshot()).toEqual({ phase: "dragging", offsetPx: DRAWER_WIDTH, progress: 1 });

    manager.move(touchPoint(200, 162, 600));
    expect(manager.getSnapshot()).toEqual({ phase: "dragging", offsetPx: 240, progress: 0.8 });
    expect(manager.finish(touchPoint(200, 162, 800))).toBe("open");

    manager.start(touchPoint(280, 160), true, "close");
    manager.move(touchPoint(260, 160, 20));
    manager.move(touchPoint(170, 162, 600));
    expect(manager.finish(touchPoint(170, 162, 800))).toBe("close");

    manager.start(touchPoint(280, 160), true, "close");
    manager.move(touchPoint(260, 160, 20));
    manager.move(touchPoint(60, 162, 600));
    expect(manager.finish(touchPoint(60, 162, 800))).toBe("close");
  });

  it("does not drag the drawer the wrong way", () => {
    const manager = createManager();

    manager.start(touchPoint(104, 160), true, "open");
    expect(manager.move(touchPoint(24, 164, 20))).toBe(false);
    expect(manager.finish(touchPoint(24, 164, 40))).toBeNull();

    manager.start(touchPoint(32, 160), true, "close");
    expect(manager.move(touchPoint(112, 168, 20))).toBe(false);
    expect(manager.finish(touchPoint(112, 168, 40))).toBeNull();
  });

  it("abandons drags that are primarily vertical", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 80), true, "open");
    expect(manager.move(touchPoint(30, 120, 20))).toBe(false);
    expect(manager.move(touchPoint(140, 130, 40))).toBe(false);
    expect(manager.finish(touchPoint(140, 130, 60))).toBeNull();
    expect(manager.getSnapshot()).toEqual({ phase: "idle" });
  });

  it("ignores desktop pointers and non-compact layouts", () => {
    const manager = createManager();

    expect(manager.start({ ...touchPoint(24, 160), pointerType: "mouse" }, true)).toBe(false);
    expect(manager.move(touchPoint(104, 164, 20))).toBe(false);

    expect(manager.start(touchPoint(24, 160), false)).toBe(false);
    expect(manager.move(touchPoint(104, 164, 20))).toBe(false);
  });

  it("only tracks the primary pointer that began the gesture", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 160, 0, 1), true, "open");
    expect(manager.move(touchPoint(104, 164, 20, 2))).toBe(false);
    expect(manager.move(touchPoint(104, 164, 20, 1))).toBe(true);
    expect(manager.finish(touchPoint(104, 164, 400, 2))).toBeNull();
  });

  it("settles a cancelled drag by position alone", () => {
    const manager = createManager();

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(100, 160, 40));
    expect(manager.cancel({ pointerId: 1 })).toBe("close");
    expect(manager.getSnapshot()).toEqual({ phase: "closing" });

    manager.start(touchPoint(24, 160), true, "open");
    manager.cancel({ pointerId: 1 });
    expect(manager.getSnapshot()).toEqual({ phase: "idle" });
  });

  it("notifies subscribers as the drag progresses", () => {
    const manager = createManager();
    let notifications = 0;
    const unsubscribe = manager.subscribe(() => {
      notifications += 1;
    });

    manager.start(touchPoint(24, 160), true, "open");
    manager.move(touchPoint(40, 160, 20));
    manager.move(touchPoint(60, 160, 40));
    expect(notifications).toBe(2);

    unsubscribe();
    manager.move(touchPoint(80, 160, 60));
    expect(notifications).toBe(2);
  });
});
