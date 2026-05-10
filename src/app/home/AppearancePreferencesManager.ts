import type { CSSProperties } from "react";
import { StateManager } from "@/lib/state-manager";

export const DIRECT_TEXT_SIZE_STORAGE_KEY = "omni-direct-text-size";
export const TERMINAL_TEXT_SIZE_STORAGE_KEY = "omni-terminal-text-size";

export const DIRECT_TEXT_SIZE_LEVELS = [
  { value: "compact", label: "Compact", messageSize: 13, lineHeight: 22 },
  { value: "default", label: "Default", messageSize: 14, lineHeight: 24 },
  { value: "large", label: "Large", messageSize: 15, lineHeight: 26 },
  { value: "larger", label: "Larger", messageSize: 16, lineHeight: 28 },
] as const;

export const TERMINAL_TEXT_SIZE_LEVELS = [
  { value: "tiny", label: "Tiny", notch: -1, scale: 0.82 },
  { value: "default", label: "Default", notch: 0, scale: 1 },
  { value: "large", label: "Large", notch: 1, scale: 1.12 },
  { value: "larger", label: "Larger", notch: 2, scale: 1.24 },
  { value: "largest", label: "Largest", notch: 3, scale: 1.36 },
] as const;

export type DirectTextSizeLevel = (typeof DIRECT_TEXT_SIZE_LEVELS)[number]["value"];
export type TerminalTextSizeLevel = (typeof TERMINAL_TEXT_SIZE_LEVELS)[number]["value"];

type AppearancePreferencesState = {
  directTextSize: DirectTextSizeLevel;
  terminalTextSize: TerminalTextSizeLevel;
  savedDirectTextSize: DirectTextSizeLevel;
  savedTerminalTextSize: TerminalTextSizeLevel;
  dirtyKeys: Set<"directTextSize" | "terminalTextSize">;
  hydrated: boolean;
};

const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferencesState = {
  directTextSize: "default",
  terminalTextSize: "default",
  savedDirectTextSize: "default",
  savedTerminalTextSize: "default",
  dirtyKeys: new Set(),
  hydrated: false,
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseDirectTextSize(value: string | null): DirectTextSizeLevel {
  return DIRECT_TEXT_SIZE_LEVELS.some((level) => level.value === value)
    ? value as DirectTextSizeLevel
    : DEFAULT_APPEARANCE_PREFERENCES.directTextSize;
}

function parseTerminalTextSize(value: string | null): TerminalTextSizeLevel {
  return TERMINAL_TEXT_SIZE_LEVELS.some((level) => level.value === value)
    ? value as TerminalTextSizeLevel
    : DEFAULT_APPEARANCE_PREFERENCES.terminalTextSize;
}

function writeLocalPreference(key: string, value: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, value);
}

function removeLocalPreference(key: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

function getAppearanceDirtyKeys(
  directTextSize: DirectTextSizeLevel,
  terminalTextSize: TerminalTextSizeLevel,
  savedDirectTextSize: DirectTextSizeLevel,
  savedTerminalTextSize: TerminalTextSizeLevel,
) {
  const dirtyKeys = new Set<"directTextSize" | "terminalTextSize">();

  if (directTextSize !== savedDirectTextSize) {
    dirtyKeys.add("directTextSize");
  }

  if (terminalTextSize !== savedTerminalTextSize) {
    dirtyKeys.add("terminalTextSize");
  }

  return dirtyKeys;
}

function toScaledPx(baseSize: number, scale: number) {
  return `${Math.round(baseSize * scale * 10) / 10}px`;
}

export function getDirectTextSizeStyle(level: DirectTextSizeLevel): CSSProperties {
  const textSize = DIRECT_TEXT_SIZE_LEVELS.find((candidate) => candidate.value === level) ?? DIRECT_TEXT_SIZE_LEVELS[1];

  return {
    "--direct-control-message-size": `${textSize.messageSize}px`,
    "--direct-control-message-line-height": `${textSize.lineHeight}px`,
  } as CSSProperties;
}

const TERMINAL_BASE_FONT_SIZES = {
  message: 13,
  thought: 12,
  thoughtLabel: 12,
  toolLabel: 12,
  toolTitle: 11,
  pane: 10,
  paneLabel: 9,
  badge: 9,
  permissionTitle: 12,
  permissionText: 11,
};

export function getTerminalTextSizeStyle(level: TerminalTextSizeLevel): CSSProperties {
  const textSize = TERMINAL_TEXT_SIZE_LEVELS.find((candidate) => candidate.value === level) ?? TERMINAL_TEXT_SIZE_LEVELS[1];
  const { scale } = textSize;

  return {
    "--terminal-message-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.message, scale),
    "--terminal-thought-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.thought, scale),
    "--terminal-thought-label-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.thoughtLabel, scale),
    "--terminal-tool-label-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.toolLabel, scale),
    "--terminal-tool-title-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.toolTitle, scale),
    "--terminal-pane-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.pane, scale),
    "--terminal-pane-label-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.paneLabel, scale),
    "--terminal-badge-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.badge, scale),
    "--terminal-permission-title-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.permissionTitle, scale),
    "--terminal-permission-text-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.permissionText, scale),
  } as CSSProperties;
}

export function getDirectTerminalTextSizeStyle(level: DirectTextSizeLevel): CSSProperties {
  const directStyle = getDirectTextSizeStyle(level) as Record<string, string>;

  return {
    ...getTerminalTextSizeStyle("default"),
    "--terminal-message-size": directStyle["--direct-control-message-size"],
  } as CSSProperties;
}

export class AppearancePreferencesManager extends StateManager<AppearancePreferencesState> {
  constructor() {
    super(DEFAULT_APPEARANCE_PREFERENCES);
  }

  hydrateFromLocalStorage() {
    if (!canUseLocalStorage()) {
      this.setKey("hydrated", true);
      return;
    }

    const directTextSize = parseDirectTextSize(window.localStorage.getItem(DIRECT_TEXT_SIZE_STORAGE_KEY));
    const terminalTextSize = parseTerminalTextSize(window.localStorage.getItem(TERMINAL_TEXT_SIZE_STORAGE_KEY));

    this.patch({
      directTextSize,
      terminalTextSize,
      savedDirectTextSize: directTextSize,
      savedTerminalTextSize: terminalTextSize,
      dirtyKeys: new Set(),
      hydrated: true,
    });
  }

  setDirectTextSize(directTextSize: DirectTextSizeLevel) {
    this.patch((current) => ({
      directTextSize,
      dirtyKeys: getAppearanceDirtyKeys(
        directTextSize,
        current.terminalTextSize,
        current.savedDirectTextSize,
        current.savedTerminalTextSize,
      ),
      hydrated: true,
    }));
  }

  setTerminalTextSize(terminalTextSize: TerminalTextSizeLevel) {
    this.patch((current) => ({
      terminalTextSize,
      dirtyKeys: getAppearanceDirtyKeys(
        current.directTextSize,
        terminalTextSize,
        current.savedDirectTextSize,
        current.savedTerminalTextSize,
      ),
      hydrated: true,
    }));
  }

  saveDraft() {
    const { directTextSize, terminalTextSize } = this.getSnapshot();
    writeLocalPreference(DIRECT_TEXT_SIZE_STORAGE_KEY, directTextSize);
    writeLocalPreference(TERMINAL_TEXT_SIZE_STORAGE_KEY, terminalTextSize);
    this.patch({
      savedDirectTextSize: directTextSize,
      savedTerminalTextSize: terminalTextSize,
      dirtyKeys: new Set(),
      hydrated: true,
    });
  }

  discardDraft() {
    this.patch((current) => ({
      directTextSize: current.savedDirectTextSize,
      terminalTextSize: current.savedTerminalTextSize,
      dirtyKeys: new Set(),
      hydrated: true,
    }));
  }

  reset() {
    removeLocalPreference(DIRECT_TEXT_SIZE_STORAGE_KEY);
    removeLocalPreference(TERMINAL_TEXT_SIZE_STORAGE_KEY);
    this.patch({
      ...DEFAULT_APPEARANCE_PREFERENCES,
      dirtyKeys: new Set(),
    });
  }
}

export const appearancePreferencesManager = new AppearancePreferencesManager();
