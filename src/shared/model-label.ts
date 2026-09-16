/**
 * Human-readable labels for provider model ids.
 *
 * Two surfaces name the same model and must not drift: the launch pickers,
 * which label the catalog a CLI reported, and the conversation transcript,
 * which labels the model a message was produced under. The picker path keeps
 * whatever label the provider supplied; the transcript path only ever has the
 * raw id from the session's own config, so both go through the same rules.
 */

// "Claude Opus 5" reads as "Opus 5" in the picker: the vendor prefix is noise
// next to the worker name. Only dropped when a word follows, so an id like
// "claude-3" still labels as "Claude 3" rather than a bare "3".
function dropClaudePrefix(label: string) {
  return label.replace(/^claude\s+(?=[A-Za-z])/i, "");
}

// Model ids spell versions with the same hyphen that separates every other
// segment, so a plain split renders "claude-opus-4-8" as "Opus 4 8". Adjacent
// numeric segments are one version number: rejoin them with a dot. Bounded to
// three digits so a dated snapshot like "claude-haiku-4-5-20251001" reads as
// "Haiku 4.5 20251001" — the date is a separate fact, not a version component.
function isVersionSegment(part: string) {
  return /^\d{1,3}$/.test(part);
}

function titleCaseModelIdPart(part: string) {
  const lower = part.toLowerCase();
  if (lower === "gpt") return "GPT";
  if (lower === "cli") return "CLI";
  if (/^\d+(?:\.\d+)*$/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function labelFromModelId(id: string) {
  const bareId = id.includes("/") ? id.split("/").at(-1) ?? id : id;
  const parts = bareId.split("-");
  const label = parts.reduce((accumulated, part, index) => {
    if (index === 0) {
      return titleCaseModelIdPart(part);
    }
    const separator = isVersionSegment(part) && isVersionSegment(parts[index - 1]!) ? "." : " ";
    return `${accumulated}${separator}${titleCaseModelIdPart(part)}`;
  }, "");
  return dropClaudePrefix(label);
}

export function normalizeWorkerModelLabel(id: string, label?: string) {
  const bareId = id.includes("/") ? id.split("/").at(-1) ?? id : id;
  const modelLabelOverrides: Record<string, string> = {
    "gpt-5.6-sol": "GPT-5.6 Sol",
    "gpt-5.6-terra": "GPT-5.6 Terra",
    "gpt-5.6-luna": "GPT-5.6 Luna",
    "gpt-6-astra": "GPT-6 Astra",
  };
  if (modelLabelOverrides[bareId]) {
    return modelLabelOverrides[bareId];
  }

  if (!label?.trim()) {
    return labelFromModelId(id);
  }

  return dropClaudePrefix(label.trim())
    .replace(/^gpt\b/i, "GPT")
    .replace(/\bcodex\b/i, "Codex")
    .replace(/\bcli\b/i, "CLI");
}

/**
 * Label a model id read back from a live session's own config.
 *
 * The context-window marker (`claude-opus-5[1m]`) is a launch variant of one
 * model, not a different one, so it is dropped here rather than rendered as
 * "Opus 5[1m]". The picker keeps it: two catalog entries that differ only by
 * window would otherwise collapse into the same visible name.
 */
export function formatSessionModelLabel(value: string | null | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    return null;
  }

  const withoutContextMarker = trimmed.replace(/\[[^\]]*\]\s*$/, "").trim();
  return normalizeWorkerModelLabel(withoutContextMarker || trimmed) || null;
}
