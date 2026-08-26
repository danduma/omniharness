import { describe, expect, it } from "vitest";
import { MobileConversationSwipeManager } from "@/interface/home/MobileConversationSwipeManager";

function touchPoint(clientX: number, clientY: number, pointerId = 1) {
  return {
    button: 0,
    clientX,
    clientY,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
  };
}

describe("MobileConversationSwipeManager", () => {
  it("triggers as soon as an active drag crosses the threshold", () => {
    const manager = new MobileConversationSwipeManager();

    expect(manager.start(touchPoint(24, 160), true)).toBe(true);
    expect(manager.move(touchPoint(64, 164))).toBe(false);
    expect(manager.move(touchPoint(104, 168))).toBe(true);
    expect(manager.move(touchPoint(120, 170))).toBe(false);
    expect(manager.finish(touchPoint(120, 170))).toBe(false);
  });

  it("opens after a deliberate right swipe on a compact layout", () => {
    const manager = new MobileConversationSwipeManager();

    expect(manager.start(touchPoint(24, 160), true)).toBe(true);
    expect(manager.finish(touchPoint(104, 168))).toBe(true);
  });

  it("ignores short and leftward drags", () => {
    const manager = new MobileConversationSwipeManager();

    manager.start(touchPoint(24, 160), true);
    expect(manager.finish(touchPoint(88, 164))).toBe(false);

    manager.start(touchPoint(104, 160), true);
    expect(manager.finish(touchPoint(24, 164))).toBe(false);
  });

  it("closes after a deliberate left swipe when requested", () => {
    const manager = new MobileConversationSwipeManager();

    manager.start(touchPoint(112, 160), true);
    expect(manager.finish(touchPoint(32, 168), "left")).toBe(true);

    manager.start(touchPoint(32, 160), true);
    expect(manager.finish(touchPoint(112, 168), "left")).toBe(false);
  });

  it("ignores drags that are primarily vertical", () => {
    const manager = new MobileConversationSwipeManager();

    manager.start(touchPoint(24, 80), true);
    expect(manager.finish(touchPoint(104, 150))).toBe(false);
  });

  it("ignores desktop pointers and non-compact layouts", () => {
    const manager = new MobileConversationSwipeManager();

    expect(manager.start({ ...touchPoint(24, 160), pointerType: "mouse" }, true)).toBe(false);
    expect(manager.finish(touchPoint(104, 164))).toBe(false);

    expect(manager.start(touchPoint(24, 160), false)).toBe(false);
    expect(manager.finish(touchPoint(104, 164))).toBe(false);
  });

  it("only finishes the primary pointer that began the gesture", () => {
    const manager = new MobileConversationSwipeManager();

    manager.start(touchPoint(24, 160, 1), true);
    expect(manager.finish(touchPoint(104, 164, 2))).toBe(false);
    expect(manager.finish(touchPoint(104, 164, 1))).toBe(true);

    manager.start(touchPoint(24, 160, 3), true);
    manager.cancel(3);
    expect(manager.finish(touchPoint(104, 164, 3))).toBe(false);
  });
});
