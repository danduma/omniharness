export const SUPPORTED_WORKER_TYPES = ["codex", "claude", "gemini", "opencode"] as const;
export type SupportedWorkerType = (typeof SUPPORTED_WORKER_TYPES)[number];
export const WORKER_TYPE_LABELS: Record<SupportedWorkerType, string> = {
  codex: "Codex",
  claude: "Claude Code",
  gemini: "Gemini",
  opencode: "OpenCode",
};

const WORKER_TYPE_ALIASES: Record<string, SupportedWorkerType> = {
  "claude": "claude",
  "claude-code": "claude",
  "claude_code": "claude",
  "claudecode": "claude",
  "codex": "codex",
  "codex-cli": "codex",
  "codex_acp": "codex",
  "codex-acp": "codex",
  "gemini": "gemini",
  "gemini-cli": "gemini",
  "open-code": "opencode",
  "open_code": "opencode",
  "opencode": "opencode",
};

export function normalizeWorkerType(type: string) {
  const normalized = type.trim().toLowerCase();
  return WORKER_TYPE_ALIASES[normalized] ?? normalized;
}

export function parseAllowedWorkerTypes(value: string | null | undefined): SupportedWorkerType[] {
  if (!value?.trim()) {
    return [...SUPPORTED_WORKER_TYPES];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [...SUPPORTED_WORKER_TYPES];
    }

    const normalized = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeWorkerType(entry))
      .filter((entry): entry is SupportedWorkerType => SUPPORTED_WORKER_TYPES.includes(entry as SupportedWorkerType));

    return normalized.length > 0 ? Array.from(new Set(normalized)) : [...SUPPORTED_WORKER_TYPES];
  } catch {
    return [...SUPPORTED_WORKER_TYPES];
  }
}
