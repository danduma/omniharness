import type { CSSProperties } from "react";
import { StateManager } from "@/lib/state-manager";

export const UI_TEXT_SIZE_STORAGE_KEY = "omni-ui-font-size";
export const CONVERSATION_TEXT_SIZE_STORAGE_KEY = "omni-conversation-font-size";
export const TERMINAL_TEXT_SIZE_STORAGE_KEY = "omni-terminal-text-size";
export const ALWAYS_EXPAND_THOUGHTS_STORAGE_KEY = "omni-always-expand-thoughts";
export const LEGACY_DIRECT_TEXT_SIZE_STORAGE_KEY = "omni-direct-text-size";

export const TEXT_SIZE_LEVELS = [
  { value: "tiny", labelKey: "settings.textSize.tiny", uiSize: 12, uiScale: 0.92, conversationSize: 12, conversationLineHeight: 20, terminalScale: 0.86 },
  { value: "small", labelKey: "settings.textSize.small", uiSize: 13, uiScale: 0.96, conversationSize: 13, conversationLineHeight: 22, terminalScale: 0.94 },
  { value: "default", labelKey: "settings.textSize.default", uiSize: 14, uiScale: 1, conversationSize: 14, conversationLineHeight: 24, terminalScale: 1 },
  { value: "large", labelKey: "settings.textSize.large", uiSize: 16, uiScale: 1.15, conversationSize: 16, conversationLineHeight: 28, terminalScale: 1.14 },
  { value: "huge", labelKey: "settings.textSize.huge", uiSize: 18, uiScale: 1.3, conversationSize: 18, conversationLineHeight: 32, terminalScale: 1.28 },
] as const;

export const UI_TEXT_SIZE_LEVELS = TEXT_SIZE_LEVELS;
export const CONVERSATION_TEXT_SIZE_LEVELS = TEXT_SIZE_LEVELS;
export const TERMINAL_TEXT_SIZE_LEVELS = TEXT_SIZE_LEVELS;

export type AppearanceTextSizeLevel = (typeof TEXT_SIZE_LEVELS)[number]["value"];
export type UiTextSizeLevel = AppearanceTextSizeLevel;
export type ConversationTextSizeLevel = AppearanceTextSizeLevel;
export type TerminalTextSizeLevel = (typeof TERMINAL_TEXT_SIZE_LEVELS)[number]["value"];

const APPEARANCE_PREFERENCE_KEYS = ["uiTextSize", "conversationTextSize", "terminalTextSize", "alwaysExpandThoughts"] as const;

type AppearancePreferenceKey = (typeof APPEARANCE_PREFERENCE_KEYS)[number];

type AppearanceDraftValues = {
  uiTextSize: UiTextSizeLevel;
  conversationTextSize: ConversationTextSizeLevel;
  terminalTextSize: TerminalTextSizeLevel;
  alwaysExpandThoughts: boolean;
};

type AppearancePreferencesState = AppearanceDraftValues & {
  savedUiTextSize: UiTextSizeLevel;
  savedConversationTextSize: ConversationTextSizeLevel;
  savedTerminalTextSize: TerminalTextSizeLevel;
  savedAlwaysExpandThoughts: boolean;
  dirtyKeys: Set<AppearancePreferenceKey>;
  hydrated: boolean;
};

const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferencesState = {
  uiTextSize: "default",
  conversationTextSize: "default",
  terminalTextSize: "default",
  alwaysExpandThoughts: false,
  savedUiTextSize: "default",
  savedConversationTextSize: "default",
  savedTerminalTextSize: "default",
  savedAlwaysExpandThoughts: false,
  dirtyKeys: new Set(),
  hydrated: false,
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseTextSize(value: string | null): AppearanceTextSizeLevel {
  if (TEXT_SIZE_LEVELS.some((level) => level.value === value)) {
    return value as AppearanceTextSizeLevel;
  }

  switch (value) {
    case "compact":
      return "small";
    case "larger":
    case "largest":
      return "huge";
    default:
      return "default";
  }
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

function draftValues(state: AppearancePreferencesState): AppearanceDraftValues {
  return {
    uiTextSize: state.uiTextSize,
    conversationTextSize: state.conversationTextSize,
    terminalTextSize: state.terminalTextSize,
    alwaysExpandThoughts: state.alwaysExpandThoughts,
  };
}

function savedValues(state: AppearancePreferencesState): AppearanceDraftValues {
  return {
    uiTextSize: state.savedUiTextSize,
    conversationTextSize: state.savedConversationTextSize,
    terminalTextSize: state.savedTerminalTextSize,
    alwaysExpandThoughts: state.savedAlwaysExpandThoughts,
  };
}

function getAppearanceDirtyKeys(draft: AppearanceDraftValues, saved: AppearanceDraftValues) {
  const dirtyKeys = new Set<AppearancePreferenceKey>();

  for (const key of APPEARANCE_PREFERENCE_KEYS) {
    if (draft[key] !== saved[key]) {
      dirtyKeys.add(key);
    }
  }

  return dirtyKeys;
}

function toScaledPx(baseSize: number, scale: number) {
  return `${Math.round(baseSize * scale * 10) / 10}px`;
}

function textSizeLevel(level: AppearanceTextSizeLevel) {
  return TEXT_SIZE_LEVELS.find((candidate) => candidate.value === level) ?? TEXT_SIZE_LEVELS[2];
}

function boostedPx(size: number, boostVariable: string) {
  return `calc(${size}px + var(${boostVariable}, 0px))`;
}

export function getUiTextSizeStyle(level: UiTextSizeLevel): CSSProperties {
  const textSize = textSizeLevel(level);

  return {
    "--omni-ui-scale": textSize.uiScale,
    // Tailwind v4 emits every spacing utility (h-*, w-*, p-*, gap-*, size-*) as
    // `calc(var(--spacing) * n)`, so overriding this single variable grows the
    // controls themselves — not just their labels — along with the text size.
    "--spacing": `calc(0.25rem * ${textSize.uiScale})`,
    "--omni-ui-font-size": boostedPx(textSize.uiSize, "--omni-mobile-ui-font-boost"),
    "--omni-ui-xxs-size": boostedPx(Math.max(10, textSize.uiSize - 4), "--omni-mobile-ui-font-boost"),
    "--omni-ui-xs-size": boostedPx(Math.max(11, textSize.uiSize - 2), "--omni-mobile-ui-font-boost"),
    "--omni-ui-sm-size": boostedPx(textSize.uiSize, "--omni-mobile-ui-font-boost"),
    "--omni-ui-base-size": boostedPx(textSize.uiSize + 2, "--omni-mobile-ui-font-boost"),
  } as CSSProperties;
}

export function getConversationTextSizeStyle(level: ConversationTextSizeLevel): CSSProperties {
  const textSize = textSizeLevel(level);

  return {
    "--omni-conversation-font-size": boostedPx(textSize.conversationSize, "--omni-mobile-conversation-font-boost"),
    "--omni-conversation-xs-size": boostedPx(Math.max(12, textSize.conversationSize - 2), "--omni-mobile-conversation-font-boost"),
    "--omni-conversation-sm-size": boostedPx(textSize.conversationSize, "--omni-mobile-conversation-font-boost"),
    "--omni-conversation-line-height": boostedPx(textSize.conversationLineHeight, "--omni-mobile-conversation-line-boost"),
    // The composer holds conversation text, so it follows the conversation size
    // (kept one step above it, which preserves the historical 15px default).
    "--omni-composer-font-size": boostedPx(textSize.conversationSize + 1, "--omni-mobile-conversation-font-boost"),
    "--omni-composer-line-height": boostedPx(textSize.conversationLineHeight, "--omni-mobile-conversation-line-boost"),
  } as CSSProperties;
}

export function getAppearanceTextSizeStyle(uiTextSize: UiTextSizeLevel, conversationTextSize: ConversationTextSizeLevel): CSSProperties {
  return {
    ...getUiTextSizeStyle(uiTextSize),
    ...getConversationTextSizeStyle(conversationTextSize),
  } as CSSProperties;
}

const TERMINAL_BASE_FONT_SIZES = {
  message: 14,
  thought: 13,
  thoughtLabel: 13,
  toolLabel: 13,
  toolTitle: 12,
  pane: 11,
  paneLabel: 10,
  badge: 10,
  permissionTitle: 13,
  permissionText: 12,
};

export function getTerminalTextSizeStyle(level: TerminalTextSizeLevel): CSSProperties {
  const scale = textSizeLevel(level).terminalScale;

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

export function getConversationTerminalTextSizeStyle(level: ConversationTextSizeLevel): CSSProperties {
  return getTerminalTextSizeStyle(level);
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

    const uiTextSize = parseTextSize(window.localStorage.getItem(UI_TEXT_SIZE_STORAGE_KEY));
    const conversationTextSize = parseTextSize(
      window.localStorage.getItem(CONVERSATION_TEXT_SIZE_STORAGE_KEY)
        ?? window.localStorage.getItem(LEGACY_DIRECT_TEXT_SIZE_STORAGE_KEY),
    );
    const terminalTextSize = parseTextSize(window.localStorage.getItem(TERMINAL_TEXT_SIZE_STORAGE_KEY));
    const alwaysExpandThoughts = window.localStorage.getItem(ALWAYS_EXPAND_THOUGHTS_STORAGE_KEY) === "true";

    this.patch({
      uiTextSize,
      conversationTextSize,
      terminalTextSize,
      alwaysExpandThoughts,
      savedUiTextSize: uiTextSize,
      savedConversationTextSize: conversationTextSize,
      savedTerminalTextSize: terminalTextSize,
      savedAlwaysExpandThoughts: alwaysExpandThoughts,
      dirtyKeys: new Set(),
      hydrated: true,
    });
  }

  private setDraft(values: Partial<AppearanceDraftValues>) {
    this.patch((current) => {
      const draft = { ...draftValues(current), ...values };

      return {
        ...draft,
        dirtyKeys: getAppearanceDirtyKeys(draft, savedValues(current)),
        hydrated: true,
      };
    });
  }

  setUiTextSize(uiTextSize: UiTextSizeLevel) {
    this.setDraft({ uiTextSize });
  }

  setConversationTextSize(conversationTextSize: ConversationTextSizeLevel) {
    this.setDraft({ conversationTextSize });
  }

  setTerminalTextSize(terminalTextSize: TerminalTextSizeLevel) {
    this.setDraft({ terminalTextSize });
  }

  setAlwaysExpandThoughts(alwaysExpandThoughts: boolean) {
    this.setDraft({ alwaysExpandThoughts });
  }

  saveDraft() {
    const { uiTextSize, conversationTextSize, terminalTextSize, alwaysExpandThoughts } = this.getSnapshot();
    writeLocalPreference(UI_TEXT_SIZE_STORAGE_KEY, uiTextSize);
    writeLocalPreference(CONVERSATION_TEXT_SIZE_STORAGE_KEY, conversationTextSize);
    writeLocalPreference(TERMINAL_TEXT_SIZE_STORAGE_KEY, terminalTextSize);
    writeLocalPreference(ALWAYS_EXPAND_THOUGHTS_STORAGE_KEY, alwaysExpandThoughts ? "true" : "false");
    this.patch({
      savedUiTextSize: uiTextSize,
      savedConversationTextSize: conversationTextSize,
      savedTerminalTextSize: terminalTextSize,
      savedAlwaysExpandThoughts: alwaysExpandThoughts,
      dirtyKeys: new Set(),
      hydrated: true,
    });
  }

  discardDraft() {
    this.patch((current) => ({
      ...savedValues(current),
      dirtyKeys: new Set(),
      hydrated: true,
    }));
  }

  reset() {
    removeLocalPreference(UI_TEXT_SIZE_STORAGE_KEY);
    removeLocalPreference(CONVERSATION_TEXT_SIZE_STORAGE_KEY);
    removeLocalPreference(TERMINAL_TEXT_SIZE_STORAGE_KEY);
    removeLocalPreference(ALWAYS_EXPAND_THOUGHTS_STORAGE_KEY);
    removeLocalPreference(LEGACY_DIRECT_TEXT_SIZE_STORAGE_KEY);
    this.patch({
      ...DEFAULT_APPEARANCE_PREFERENCES,
      dirtyKeys: new Set(),
    });
  }
}

export const appearancePreferencesManager = new AppearancePreferencesManager();
