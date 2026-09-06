/**
 * Normalize user-facing and legacy reasoning-effort aliases before they cross
 * a provider protocol boundary. UI labels intentionally remain human-readable,
 * while Codex and ACP use the compact `xhigh` enum value.
 */
export function normalizeReasoningEffort(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() || "";
  if (!normalized) {
    return null;
  }

  if (normalized === "extra high" || normalized === "extra-high") {
    return "xhigh";
  }

  return normalized;
}
