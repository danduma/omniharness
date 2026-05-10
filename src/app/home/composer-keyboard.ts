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
