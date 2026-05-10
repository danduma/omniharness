import { describe, expect, it } from "vitest";
import {
  getComposerSubmitShortcutLabel,
  shouldSubmitComposerKeyDown,
  shouldUseAlternateComposerSubmitKeyDown,
} from "@/app/home/composer-keyboard";

describe("shouldSubmitComposerKeyDown", () => {
  it("does not submit plain Enter on mobile viewports", () => {
    expect(shouldSubmitComposerKeyDown({
      key: "Enter",
      shiftKey: false,
      isMobileViewport: true,
    })).toBe(false);
  });

  it("submits plain Enter on desktop viewports", () => {
    expect(shouldSubmitComposerKeyDown({
      key: "Enter",
      shiftKey: false,
      isMobileViewport: false,
    })).toBe(true);
  });

  it("keeps Shift+Enter as text entry on every viewport", () => {
    expect(shouldSubmitComposerKeyDown({
      key: "Enter",
      shiftKey: true,
      isMobileViewport: false,
    })).toBe(false);
    expect(shouldSubmitComposerKeyDown({
      key: "Enter",
      shiftKey: true,
      isMobileViewport: true,
    })).toBe(false);
  });

  it("uses Command+Enter as the alternate submit shortcut on Apple platforms", () => {
    expect(shouldUseAlternateComposerSubmitKeyDown({
      key: "Enter",
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isApplePlatform: true,
    })).toBe(true);
    expect(shouldUseAlternateComposerSubmitKeyDown({
      key: "Enter",
      shiftKey: false,
      metaKey: false,
      ctrlKey: true,
      isApplePlatform: true,
    })).toBe(false);
  });

  it("uses Ctrl+Enter as the alternate submit shortcut on non-Apple platforms", () => {
    expect(shouldUseAlternateComposerSubmitKeyDown({
      key: "Enter",
      shiftKey: false,
      metaKey: false,
      ctrlKey: true,
      isApplePlatform: false,
    })).toBe(true);
    expect(shouldUseAlternateComposerSubmitKeyDown({
      key: "Enter",
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isApplePlatform: false,
    })).toBe(false);
  });

  it("does not use the alternate submit shortcut for shifted or non-enter keys", () => {
    expect(shouldUseAlternateComposerSubmitKeyDown({
      key: "Enter",
      shiftKey: true,
      metaKey: true,
      ctrlKey: true,
      isApplePlatform: true,
    })).toBe(false);
    expect(shouldUseAlternateComposerSubmitKeyDown({
      key: "a",
      shiftKey: false,
      metaKey: true,
      ctrlKey: true,
      isApplePlatform: false,
    })).toBe(false);
  });

  it("labels the alternate submit shortcut for the current platform", () => {
    expect(getComposerSubmitShortcutLabel(true)).toBe("Command+Enter");
    expect(getComposerSubmitShortcutLabel(false)).toBe("Ctrl+Enter");
  });
});
