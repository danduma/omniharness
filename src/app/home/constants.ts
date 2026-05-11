import type { ComposerWorkerOption, WorkerModelCatalog, WorkerType } from "./types";
import { GIT_AUTO_COMMIT_MILESTONES_SETTING, GIT_PUSH_ON_COMMIT_SETTING } from "@/lib/commit-workflow";

export const PRODUCT_NAME = "OmniHarness";
export const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 280;
export const DESKTOP_CONVERSATION_SIDEBAR_WIDTH = DEFAULT_CONVERSATION_SIDEBAR_WIDTH;
export const CONVERSATION_SIDEBAR_MIN_WIDTH = 220;
export const CONVERSATION_SIDEBAR_MAX_WIDTH_FALLBACK = 640;
export const WORKERS_SIDEBAR_MIN_WIDTH = 320;
export const WORKERS_SIDEBAR_MIN_MAIN_WIDTH = 360;
export const WORKERS_SIDEBAR_MAX_WIDTH_FALLBACK = 1120;
export const DEFAULT_WORKERS_SIDEBAR_WIDTH = 580;

function isFiniteViewportWidth(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getWorkersSidebarMaxWidth(viewportWidth?: number | null) {
  if (!isFiniteViewportWidth(viewportWidth)) {
    return WORKERS_SIDEBAR_MAX_WIDTH_FALLBACK;
  }

  return Math.max(
    WORKERS_SIDEBAR_MIN_WIDTH,
    Math.round(viewportWidth - DESKTOP_CONVERSATION_SIDEBAR_WIDTH - WORKERS_SIDEBAR_MIN_MAIN_WIDTH),
  );
}

export function clampWorkersSidebarWidth(width: number, viewportWidth?: number | null) {
  return Math.min(
    getWorkersSidebarMaxWidth(viewportWidth),
    Math.max(WORKERS_SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

export function getConversationSidebarMaxWidth(viewportWidth?: number | null) {
  if (!isFiniteViewportWidth(viewportWidth)) {
    return CONVERSATION_SIDEBAR_MAX_WIDTH_FALLBACK;
  }

  return Math.max(
    CONVERSATION_SIDEBAR_MIN_WIDTH,
    Math.round(viewportWidth - WORKERS_SIDEBAR_MIN_WIDTH - WORKERS_SIDEBAR_MIN_MAIN_WIDTH),
  );
}

export function clampConversationSidebarWidth(width: number, viewportWidth?: number | null) {
  return Math.min(
    getConversationSidebarMaxWidth(viewportWidth),
    Math.max(CONVERSATION_SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

export function getDefaultConversationSidebarWidth(viewportWidth?: number | null) {
  return clampConversationSidebarWidth(DEFAULT_CONVERSATION_SIDEBAR_WIDTH, viewportWidth);
}

export function getDefaultWorkersSidebarWidth(viewportWidth?: number | null) {
  if (!isFiniteViewportWidth(viewportWidth)) {
    return DEFAULT_WORKERS_SIDEBAR_WIDTH;
  }

  const remainingAfterConversationSidebar = Math.max(
    0,
    viewportWidth - DESKTOP_CONVERSATION_SIDEBAR_WIDTH,
  );
  return clampWorkersSidebarWidth(remainingAfterConversationSidebar / 2, viewportWidth);
}

export const DEFAULT_SERVER_SETTINGS: Record<string, string> = {
  SUPERVISOR_LLM_PROVIDER: "gemini",
  SUPERVISOR_LLM_MODEL: "gemini-3.1-pro-preview",
  SUPERVISOR_LLM_BASE_URL: "",
  SUPERVISOR_LLM_API_KEY: "",
  SUPERVISOR_FALLBACK_LLM_PROVIDER: "openai",
  SUPERVISOR_FALLBACK_LLM_MODEL: "gpt-5.4-mini",
  SUPERVISOR_FALLBACK_LLM_BASE_URL: "",
  SUPERVISOR_FALLBACK_LLM_API_KEY: "",
  CREDIT_STRATEGY: "swap_account",
  WORKER_DEFAULT_TYPE: "codex",
  WORKER_ALLOWED_TYPES: "",
  WORKER_YOLO_MODE: "true",
  BUSY_MESSAGE_ACTION: "queue",
  [GIT_AUTO_COMMIT_MILESTONES_SETTING]: "false",
  [GIT_PUSH_ON_COMMIT_SETTING]: "false",
  RECOVERY_POLICY: JSON.stringify({
    autoRecoverImplementationRuns: true,
    autoRecoverDirectRuns: false,
    maxAutoAttemptsPerIncident: 3,
    baseBackoffMs: 5000,
    maxBackoffMs: 60000,
    sessionResumeFirst: true,
    restartFromCheckpointWhenSessionMissing: true,
    preserveQueuedMessages: true,
  }),
  PROJECTS: "[]",
};
export const WORKER_OPTIONS: Array<{ value: WorkerType; label: string }> = [
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude Code" },
  { value: "gemini", label: "Gemini" },
  { value: "opencode", label: "OpenCode" },
] as const;
export const COMPOSER_WORKER_OPTIONS: Array<{ value: ComposerWorkerOption; label: string }> = [
  { value: "auto", label: "Auto" },
  ...WORKER_OPTIONS,
] as const;
export const DEFAULT_ALLOWED_WORKER_TYPES = JSON.stringify(WORKER_OPTIONS.map((option) => option.value));
DEFAULT_SERVER_SETTINGS.WORKER_ALLOWED_TYPES = DEFAULT_ALLOWED_WORKER_TYPES;
export const FALLBACK_WORKER_MODEL_OPTIONS: WorkerModelCatalog = {
  codex: [
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
  claude: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
  gemini: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  ],
  opencode: [
    { value: "openai/gpt-5.5", label: "GPT-5.5" },
    { value: "openai/gpt-5.4", label: "GPT-5.4" },
    { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "openai/gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
};
export const EFFORT_OPTIONS = ["Low", "Medium", "High"];
export const COMPOSER_WORKER_STORAGE_KEY = "omni-composer-worker";
export const COMPOSER_MODEL_STORAGE_KEY = "omni-composer-model";
export const COMPOSER_EFFORT_STORAGE_KEY = "omni-composer-effort";
export const COMPOSER_MODE_STORAGE_KEY = "omni-composer-mode";
export const RUN_PATH_PATTERN = /^\/session\/([0-9a-fA-F]{12}|[0-9a-fA-F-]{36})\/?$/;

export const LLM_PROVIDER_OPTIONS = [
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai-compatible", label: "OpenAI-Compatible" },
] as const;
