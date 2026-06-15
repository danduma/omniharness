import { describe, expect, it } from "vitest";
import {
  shouldInterruptQueuedMessageKeyDown,
  shouldSubmitComposerKeyDown,
} from "@/app/home/composer-keyboard";

function intent(overrides: Partial<Parameters<typeof shouldInterruptQueuedMessageKeyDown>[0]> = {}) {
  return {
    key: "Escape",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    ...overrides,
  };
}

describe("shouldInterruptQueuedMessageKeyDown", () => {
  it("triggers on a bare Escape", () => {
    expect(shouldInterruptQueuedMessageKeyDown(intent())).toBe(true);
  });

  it("ignores non-Escape keys", () => {
    expect(shouldInterruptQueuedMessageKeyDown(intent({ key: "Enter" }))).toBe(false);
    expect(shouldInterruptQueuedMessageKeyDown(intent({ key: "a" }))).toBe(false);
  });

  it("ignores Escape while composing an IME sequence", () => {
    expect(shouldInterruptQueuedMessageKeyDown(intent({ isComposing: true }))).toBe(false);
  });

  it("ignores Escape combined with modifier keys", () => {
    expect(shouldInterruptQueuedMessageKeyDown(intent({ shiftKey: true }))).toBe(false);
    expect(shouldInterruptQueuedMessageKeyDown(intent({ metaKey: true }))).toBe(false);
    expect(shouldInterruptQueuedMessageKeyDown(intent({ ctrlKey: true }))).toBe(false);
    expect(shouldInterruptQueuedMessageKeyDown(intent({ altKey: true }))).toBe(false);
  });

  it("does not overlap with Enter submission intent", () => {
    expect(shouldSubmitComposerKeyDown({ key: "Escape", shiftKey: false, isMobileViewport: false })).toBe(false);
  });
});
