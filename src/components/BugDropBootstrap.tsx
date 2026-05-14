"use client";

import { useEffect } from "react";

const BUGDROP_SCRIPT_ID = "omni-bugdrop-widget-script";
const BUGDROP_SCRIPT_SRC = "https://bugdrop.neonwatty.workers.dev/widget.js";
const BUGDROP_REPO = "danduma/omniharness";
const BUGDROP_OPEN_EVENT = "omni:open-bugdrop";
const BUGDROP_THEME_PATCH_ID = "omni-bugdrop-theme-patch";
const OMNI_THEME_MODE_STORAGE_KEY = "omni-theme-mode";

type BugDropApi = {
  open: () => void;
  close?: () => void;
  hide?: () => void;
  setTheme?: (themeName: "light" | "dark" | "auto") => void;
};

declare global {
  interface Window {
    BugDrop?: BugDropApi;
  }
}

const BUGDROP_THEME_CONFIG = {
  light: {
    theme: "light",
    color: "#b56f21",
    bg: "#fdfcfb",
    text: "#24211d",
    borderColor: "#e4ded6",
    shadow: "0 12px 32px rgba(45, 36, 26, 0.14)",
  },
  dark: {
    theme: "dark",
    color: "#d99343",
    bg: "#202020",
    text: "#f3f2ef",
    borderColor: "#3b3834",
    shadow: "0 18px 44px rgba(0, 0, 0, 0.36)",
  },
} as const;

type BugDropThemeName = keyof typeof BUGDROP_THEME_CONFIG;

function currentBugDropTheme(): BugDropThemeName {
  try {
    if (window.localStorage.getItem(OMNI_THEME_MODE_STORAGE_KEY) === "night") {
      return "dark";
    }
  } catch {
    // The DOM class is the source of truth when storage is unavailable.
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function removeBugDropNodes() {
  const bugDropNodes = document.querySelectorAll(
    `[id*="bugdrop" i], [class*="bugdrop" i], #${BUGDROP_SCRIPT_ID}`,
  );

  bugDropNodes.forEach((node) => {
    node.parentElement?.removeChild(node);
  });
}

function createBugDropScript(themeName: BugDropThemeName) {
  const themeConfig = BUGDROP_THEME_CONFIG[themeName];
  const script = document.createElement("script");

  script.id = BUGDROP_SCRIPT_ID;
  script.src = BUGDROP_SCRIPT_SRC;
  script.async = true;
  script.dataset.repo = BUGDROP_REPO;
  script.dataset.button = "false";
  script.dataset.theme = themeConfig.theme;
  script.dataset.color = themeConfig.color;
  script.dataset.font = "inherit";
  script.dataset.radius = "10px";
  script.dataset.bg = themeConfig.bg;
  script.dataset.text = themeConfig.text;
  script.dataset.borderWidth = "1px";
  script.dataset.borderColor = themeConfig.borderColor;
  script.dataset.shadow = themeConfig.shadow;

  return script;
}

function applyBugDropThemePatch(themeName: BugDropThemeName) {
  const host = document.getElementById("bugdrop-host");
  const shadowRoot = host?.shadowRoot;

  if (!shadowRoot) {
    return;
  }

  const root = shadowRoot.querySelector(".bd-root");
  root?.classList.toggle("bd-dark", themeName === "dark");
  window.BugDrop?.setTheme?.(themeName);

  if (shadowRoot.getElementById(BUGDROP_THEME_PATCH_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = BUGDROP_THEME_PATCH_ID;
  style.textContent = `
    .bd-root {
      color: var(--bd-text-primary) !important;
    }

    .bd-category-option,
    .bd-category-option span,
    .bd-screenshot-row,
    .bd-screenshot-row label {
      color: var(--bd-text-primary) !important;
    }

    .bd-root.bd-dark .bd-modal,
    .bd-root.bd-dark .bd-header,
    .bd-root.bd-dark .bd-input,
    .bd-root.bd-dark .bd-textarea,
    .bd-root.bd-dark .bd-btn-secondary {
      background: var(--bd-bg-primary) !important;
      color: var(--bd-text-primary) !important;
    }

    .bd-root.bd-dark .bd-category-option {
      background: color-mix(in srgb, var(--bd-bg-primary) 90%, var(--bd-text-primary)) !important;
    }

    .bd-root.bd-dark .bd-input::placeholder,
    .bd-root.bd-dark .bd-textarea::placeholder {
      color: var(--bd-text-muted) !important;
    }
  `;
  shadowRoot.appendChild(style);
}

function openBugDropWhenReady() {
  if (window.BugDrop) {
    window.BugDrop.open();
    return false;
  }

  return true;
}

export function requestBugDropOpen() {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(new Event(BUGDROP_OPEN_EVENT));
}

export function BugDropBootstrap() {
  useEffect(() => {
    let activeTheme = currentBugDropTheme();
    let pendingOpen = false;

    const loadBugDrop = (themeName: BugDropThemeName) => {
      window.BugDrop?.close?.();
      window.BugDrop?.hide?.();
      removeBugDropNodes();
      delete window.BugDrop;
      document.body.appendChild(createBugDropScript(themeName));
      activeTheme = themeName;
    };

    const handleOpenRequest = () => {
      applyBugDropThemePatch(activeTheme);
      pendingOpen = openBugDropWhenReady();
    };

    const handleReady = () => {
      applyBugDropThemePatch(activeTheme);

      if (!pendingOpen) {
        return;
      }

      pendingOpen = false;
      window.BugDrop?.open();
    };

    const observer = new MutationObserver(() => {
      const nextTheme = currentBugDropTheme();
      if (nextTheme !== activeTheme) {
        loadBugDrop(nextTheme);
        return;
      }

      applyBugDropThemePatch(nextTheme);
    });

    document.addEventListener(BUGDROP_OPEN_EVENT, handleOpenRequest);
    document.addEventListener("bugdrop:ready", handleReady);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { childList: true, subtree: true });
    loadBugDrop(activeTheme);

    return () => {
      document.removeEventListener(BUGDROP_OPEN_EVENT, handleOpenRequest);
      document.removeEventListener("bugdrop:ready", handleReady);
      observer.disconnect();
    };
  }, []);

  return null;
}
