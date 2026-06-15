type ComposerKeyDownIntent = {
  key: string;
  shiftKey: boolean;
  isMobileViewport: boolean;
};

type AlternateComposerKeyDownIntent = {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  isApplePlatform: boolean;
};

export function shouldSubmitComposerKeyDown({
  key,
  shiftKey,
  isMobileViewport,
}: ComposerKeyDownIntent) {
  return key === "Enter" && !shiftKey && !isMobileViewport;
}

export function shouldUseAlternateComposerSubmitKeyDown({
  key,
  shiftKey,
  metaKey,
  ctrlKey,
  isApplePlatform,
}: AlternateComposerKeyDownIntent) {
  if (key !== "Enter" || shiftKey) {
    return false;
  }

  return isApplePlatform ? metaKey : ctrlKey;
}

type InterruptComposerKeyDownIntent = {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing: boolean;
};

/**
 * Claude Code-style Escape-to-interrupt. Returns true only for a bare Escape
 * keypress: no modifiers and not mid-IME-composition. Callers must still gate
 * on mention-picker state (which consumes Escape first) and on whether there is
 * a busy turn plus draft/queued intent to deliver.
 */
export function shouldInterruptQueuedMessageKeyDown({
  key,
  shiftKey,
  metaKey,
  ctrlKey,
  altKey,
  isComposing,
}: InterruptComposerKeyDownIntent) {
  if (key !== "Escape") {
    return false;
  }
  if (isComposing) {
    return false;
  }
  return !shiftKey && !metaKey && !ctrlKey && !altKey;
}

export function getComposerSubmitShortcutLabel(isApplePlatform: boolean) {
  return isApplePlatform ? "Command+Enter" : "Ctrl+Enter";
}

export function isAppleComposerShortcutPlatform(platform?: string) {
  const detectedPlatform = platform
    ?? (typeof navigator === "undefined"
      ? ""
      : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform));

  return /\b(Mac|iPhone|iPad|iPod)\b/i.test(detectedPlatform);
}
