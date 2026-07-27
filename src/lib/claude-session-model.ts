/**
 * Claude session model pinning.
 *
 * The Claude ACP adapter picks the session model itself when nothing pins it:
 * `ANTHROPIC_MODEL` first, then `settings.model` from the CLI config dir, then
 * the first entry of the account's model list. OmniHarness worker launches used
 * to fall through all three, so a worker launched as "Claude Opus 5" actually
 * ran on whatever the user's global `/model` last selected — including the
 * 1M-context variants (`opus[1m]`, `claude-fable-5[1m]`). Those variants bill
 * against usage credits, so a subscription-only account fails every turn with
 * "API Error: Usage credits required for 1M context".
 *
 * This resolver maps the model OmniHarness asked for onto one of the values the
 * adapter actually offers, and never lands on a 1M-context variant unless the
 * caller spelled out the `[1m]` suffix.
 */

export type ClaudeSessionModelOption = {
  value: string;
  name?: string | null;
  description?: string | null;
};

export type ClaudeSessionModelReason =
  /** The requested model matched an option we can run as-is. */
  | "requested"
  /** The requested model only exists as a 1M variant; picked a runnable one instead. */
  | "standard_context_fallback"
  /** Nothing was requested and the adapter's own default was a 1M variant. */
  | "avoid_1m_default"
  /**
   * The request named a version but the adapter's matching option advertises no
   * version at all, so we pinned the family alias without being able to prove it
   * is the version that was asked for.
   */
  | "family_alias_unverified";

export type ClaudeSessionModelResolution = {
  value: string;
  reason: ClaudeSessionModelReason;
};

export type ClaudeSessionModelOutcome =
  /** Pin this value on the session. */
  | { status: "pin"; value: string; reason: ClaudeSessionModelReason }
  /** The session is already on an acceptable model; change nothing. */
  | { status: "keep" }
  /**
   * The requested version is not on offer. Never substitute a different version
   * of the same family here — silently answering an Opus 5 request with the
   * `opus` alias is how a run recorded as Opus 5 actually executed on Opus 4.8.
   */
  | {
    status: "unavailable";
    requested: string;
    requestedVersion: string;
    offeredVersion: string;
    available: string[];
  };

const ONE_MILLION_CONTEXT_PATTERN = /\[1m\]/i;
const MODEL_FAMILIES = ["opus", "sonnet", "haiku", "fable"] as const;

export function isOneMillionContextModel(value: string) {
  return ONE_MILLION_CONTEXT_PATTERN.test(value);
}

function modelFamily(value: string): string | null {
  const lower = value.toLowerCase();
  return MODEL_FAMILIES.find((family) => lower.includes(family)) ?? null;
}

/**
 * Pull the version that follows a family name: `claude-opus-4-8` and the
 * description `Opus 4.8 · Best for everyday tasks` both yield "4.8". Returns
 * null for bare aliases like `opus`, which name a family but no version.
 */
function versionFromModelText(value: string): string | null {
  const cleaned = value.toLowerCase().replace(/\[1m\]/g, " ");
  const family = modelFamily(cleaned);
  if (!family) {
    return null;
  }

  const tail = cleaned.slice(cleaned.indexOf(family) + family.length);
  const match = tail.match(/^[-_\s]*(\d+(?:[-.]\d+)*)/);
  return match ? match[1].replace(/-/g, ".") : null;
}

/**
 * The version an option actually runs. The adapter often ships a bare alias
 * (`opus`) whose version only appears in the human-facing description, so fall
 * through value → name → description.
 */
function optionVersion(option: ClaudeSessionModelOption): string | null {
  return versionFromModelText(option.value)
    ?? versionFromModelText(option.name ?? "")
    ?? versionFromModelText(option.description ?? "");
}

function optionHaystack(option: ClaudeSessionModelOption) {
  return `${option.value} ${option.name ?? ""} ${option.description ?? ""}`.toLowerCase();
}

function findByValue(options: ClaudeSessionModelOption[], value: string) {
  const lower = value.trim().toLowerCase();
  return options.find((option) => option.value.trim().toLowerCase() === lower) ?? null;
}

/**
 * Best option we can run without usage credits: the adapter's own "default"
 * (the plan's recommended model) when it is offered, otherwise the first
 * standard-context entry.
 */
function bestStandardContextOption(options: ClaudeSessionModelOption[]) {
  const standard = options.filter((option) => !isOneMillionContextModel(option.value));
  return standard.find((option) => option.value.trim().toLowerCase() === "default") ?? standard[0] ?? null;
}

export function resolveClaudeSessionModel(input: {
  options: ClaudeSessionModelOption[];
  requested?: string | null;
  current?: string | null;
}): ClaudeSessionModelOutcome {
  const options = input.options.filter((option) => typeof option?.value === "string" && option.value.trim() !== "");
  if (options.length === 0) {
    return { status: "keep" };
  }

  const requested = input.requested?.trim() || null;
  const current = input.current?.trim() || null;
  const wantsOneMillion = requested !== null && isOneMillionContextModel(requested);

  const settle = (
    option: ClaudeSessionModelOption | null,
    reason: ClaudeSessionModelReason,
  ): ClaudeSessionModelOutcome => {
    if (!option || option.value === current) {
      return { status: "keep" };
    }
    return { status: "pin", value: option.value, reason };
  };

  if (!requested) {
    // Nothing to pin, so only step in when the model the adapter settled on is
    // one the subscription cannot pay for.
    return current && isOneMillionContextModel(current)
      ? settle(bestStandardContextOption(options), "avoid_1m_default")
      : { status: "keep" };
  }

  const exact = findByValue(options, requested);
  if (exact && (wantsOneMillion || !isOneMillionContextModel(exact.value))) {
    return settle(exact, "requested");
  }

  // No usable exact hit: stay inside the requested family (opus stays opus)
  // instead of dropping to an unrelated model.
  const family = modelFamily(requested);
  const familyMatches = family ? options.filter((option) => optionHaystack(option).includes(family)) : [];
  const candidates = wantsOneMillion
    ? familyMatches
    : familyMatches.filter((option) => !isOneMillionContextModel(option.value));
  const familyChoice = candidates.find((option) => option.value.trim().toLowerCase() === family) ?? candidates[0] ?? null;
  if (familyChoice) {
    if (exact) {
      // The exact hit existed but was 1M-only; the family fallback is a
      // deliberate context-size substitution, not a version substitution.
      return settle(familyChoice, "standard_context_fallback");
    }

    // Staying in the family is only correct if it is also the same version.
    // `opus` is an alias whose meaning moves with the CLI build, so matching
    // "claude-opus-5" against it can silently run Opus 4.8.
    const requestedVersion = versionFromModelText(requested);
    const offeredVersion = optionVersion(familyChoice);
    if (requestedVersion && offeredVersion && offeredVersion !== requestedVersion) {
      return {
        status: "unavailable",
        requested,
        requestedVersion,
        offeredVersion,
        available: options.map((option) => option.value),
      };
    }

    return settle(
      familyChoice,
      requestedVersion && !offeredVersion ? "family_alias_unverified" : "requested",
    );
  }

  // The requested family is either unavailable or 1M-only (Fable ships as
  // `claude-fable-5[1m]`), so fall back to something that actually runs.
  return settle(bestStandardContextOption(options), "standard_context_fallback");
}
