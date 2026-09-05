/**
 * Claude session model pinning.
 *
 * The agent runtime passes explicit model selections through `ANTHROPIC_MODEL`
 * before startup, then uses this resolver to verify the adapter's reported
 * identity. Providers may report a documented alias such as `opus[1m]` for the
 * canonical request `claude-opus-5`; that is acceptable only when one menu
 * entry unambiguously proves the same family and version. Unknown or
 * contradictory aliases fail closed.
 *
 * The Claude ACP adapter picks the session model itself when nothing pins it:
 * `ANTHROPIC_MODEL` first, then `settings.model` from the CLI config dir, then
 * the first entry of the account's model list. OmniHarness worker launches used
 * to fall through all three, so a worker launched as "Claude Opus 5" actually
 * ran on whatever the user's global `/model` last selected.
 *
 * When resolving adapter options, one rule dominates every other:
 *
 *   **Never leave the requested family.**
 *
 * Opus, Sonnet, Haiku and Fable are different products, not fallbacks for one
 * another. A run launched as Fable that executes on Opus is mislabelled at
 * every layer — the transcript, the cost, the answers themselves. Refuse
 * instead: a failed launch is recoverable, a silent family swap is not.
 *
 * Inside the family, require the requested version rather than guessing:
 *
 *  1. the requested **version**, in whichever context size the adapter has it.
 *     If the only Opus 5 is `claude-opus-5[1m]`, that is Opus 5 — run it;
 *  2. if that version is not offered at all, refuse the launch. Opus 4.8 is
 *     not Opus 5, even though both belong to the Opus family.
 *
 * Context size is an implementation detail the caller should never have to
 * think about. When one model is listed both ways, prefer the standard-context
 * entry — `[1m]` variants can bill against usage credits the subscription may
 * not include — but that preference must never change *which model runs*.
 * Answering an Opus 5 request with Opus 4.8 because 4.8 was the non-`[1m]`
 * entry is the same mislabelling bug wearing a different hat.
 *
 * Every substitution is reported through the outcome's `reason` so the launch
 * records what actually ran.
 */

export type ClaudeSessionModelOption = {
  value: string;
  name?: string | null;
  description?: string | null;
};

export type ClaudeSessionModelReason =
  /** The requested model matched an option we can run as-is. */
  | "requested"
  /** Same family, but the exact request was 1M-only; took the standard-context sibling. */
  | "standard_context_fallback"
  /** Same family, but the adapter offers it only as a `[1m]` variant. */
  | "one_million_only"
  /** Nothing was requested and the adapter's own default was a 1M variant. */
  | "avoid_1m_default";

export type ClaudeSessionModelResolution = {
  value: string;
  reason: ClaudeSessionModelReason;
};

export type ClaudeSessionModelOutcome =
  /** Pin this value on the session. */
  | { status: "pin"; value: string; reason: ClaudeSessionModelReason }
  /** The session is already on an acceptable model; change nothing. */
  | { status: "keep"; value: string | null; reason: ClaudeSessionModelReason }
  /** The requested family or exact version is not available. */
  | {
    status: "unavailable";
    reason: "family_unavailable" | "version_unavailable";
    requested: string;
    requestedFamily: string | null;
    requestedVersion: string | null;
    available: string[];
  };

const ONE_MILLION_CONTEXT_PATTERN = /\[1m\]/i;
/**
 * Prose form, for the option's human-facing text. The adapter's own
 * recommendation ships as `{ value: "default", description: "Opus 4.8 with 1M
 * context …" }` — the value alone says nothing about its context size, so a
 * value-only test reports the biggest 1M option in the list as standard.
 */
const ONE_MILLION_CONTEXT_TEXT_PATTERN = /\b(?:1m|1\s*million)\b/i;
const MODEL_FAMILIES = ["opus", "sonnet", "haiku", "fable"] as const;

/** Does this *value* spell out the 1M variant? Used to read the caller's request. */
export function isOneMillionContextModel(value: string) {
  return ONE_MILLION_CONTEXT_PATTERN.test(value);
}

/** Does this option run at 1M context, however the adapter chose to say so? */
export function isOneMillionContextOption(option: ClaudeSessionModelOption) {
  return isOneMillionContextModel(option.value)
    || ONE_MILLION_CONTEXT_TEXT_PATTERN.test(option.name ?? "")
    || ONE_MILLION_CONTEXT_TEXT_PATTERN.test(option.description ?? "");
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
function optionDescriptionIdentity(option: ClaudeSessionModelOption) {
  return (option.description ?? "").split(/\s+(?:·|•|—|–|\|)\s+/, 1)[0] ?? "";
}

function optionIdentityEvidence(option: ClaudeSessionModelOption) {
  const identityFields = [option.value, option.name ?? "", optionDescriptionIdentity(option)];
  const families = new Set(identityFields.map(modelFamily).filter((value): value is string => Boolean(value)));
  const versions = new Set(identityFields.map(versionFromModelText).filter((value): value is string => Boolean(value)));
  return {
    family: families.size === 1 ? [...families][0]! : null,
    version: versions.size === 1 ? [...versions][0]! : null,
    familyConsistent: families.size <= 1,
    versionConsistent: versions.size <= 1,
  };
}

function optionVersion(option: ClaudeSessionModelOption): string | null {
  const identity = optionIdentityEvidence(option);
  return identity.versionConsistent ? identity.version : null;
}

function optionFamily(option: ClaudeSessionModelOption) {
  const identity = optionIdentityEvidence(option);
  return identity.familyConsistent ? identity.family : null;
}

function findByValue(options: ClaudeSessionModelOption[], value: string) {
  const lower = value.trim().toLowerCase();
  return options.find((option) => option.value.trim().toLowerCase() === lower) ?? null;
}

function findAllByValue(options: ClaudeSessionModelOption[], value: string) {
  const lower = value.trim().toLowerCase();
  return options.filter((option) => option.value.trim().toLowerCase() === lower);
}

/**
 * The same model, listed at standard context. Deliberately narrow: it will not
 * reach across families or versions, so swapping onto it changes nothing the
 * caller can observe except the context size — and the usage-credit failures
 * that come with it.
 */
function standardContextSibling(
  options: ClaudeSessionModelOption[],
  option: ClaudeSessionModelOption,
) {
  const family = optionFamily(option);
  if (!family) {
    return null;
  }
  const version = optionVersion(option);
  return options.find((candidate) => (
    candidate.value !== option.value
    && !isOneMillionContextOption(candidate)
    && optionFamily(candidate) === family
    && optionVersion(candidate) === version
  )) ?? null;
}

export function resolveClaudeSessionModel(input: {
  options: ClaudeSessionModelOption[];
  requested?: string | null;
  current?: string | null;
}): ClaudeSessionModelOutcome {
  const options = input.options.filter((option) => typeof option?.value === "string" && option.value.trim() !== "");
  const requested = input.requested?.trim() || null;
  const current = input.current?.trim() || null;
  if (options.length === 0) {
    // A canonical provider value can prove itself without a menu, but an alias
    // cannot: there is no metadata available to connect it to the requested
    // family/version. Explicit requests therefore fail closed unless the
    // reported value is exactly the requested value.
    if (!requested) {
      return { status: "keep", value: current, reason: "requested" };
    }
    if (current?.toLowerCase() === requested.toLowerCase()) {
      return { status: "keep", value: current, reason: "requested" };
    }
    const requestedFamily = modelFamily(requested);
    const requestedVersion = versionFromModelText(requested);
    return {
      status: "unavailable",
      reason: requestedVersion ? "version_unavailable" : "family_unavailable",
      requested,
      requestedFamily,
      requestedVersion,
      available: current ? [current] : [],
    };
  }

  const currentOption = current ? findByValue(options, current) : null;
  const wantsOneMillion = requested !== null && isOneMillionContextModel(requested);

  const settle = (
    option: ClaudeSessionModelOption | null,
    reason: ClaudeSessionModelReason,
  ): ClaudeSessionModelOutcome => {
    if (!option) {
      return { status: "keep", value: current, reason };
    }
    if (option.value === current) {
      // Already there. Still report *why* this value is the right one, so the
      // launch can record the model it confirmed rather than the one it asked
      // for — that gap is how a session shows up in the database as Fable and
      // in its own transcript as Opus.
      return { status: "keep", value: option.value, reason };
    }
    return { status: "pin", value: option.value, reason };
  };

  if (!requested) {
    // Nothing was asked for, so there is no mandate to change the model the
    // user's own `/model` selected — only to spare them a usage-credit failure
    // when the identical model is also listed at standard context. Staying in
    // the family matters just as much here: silently moving an unrequested
    // Opus session onto Sonnet is the same substitution this module exists to
    // prevent, and with nothing requested there is nothing to justify it.
    if (!currentOption || !isOneMillionContextOption(currentOption)) {
      return { status: "keep", value: current, reason: "requested" };
    }
    const sibling = standardContextSibling(options, currentOption);
    return sibling
      ? settle(sibling, "avoid_1m_default")
      : { status: "keep", value: current, reason: "one_million_only" };
  }

  const exact = findByValue(options, requested);
  if (exact && (wantsOneMillion || !isOneMillionContextOption(exact))) {
    return settle(exact, "requested");
  }

  const family = modelFamily(requested);
  const requestedVersion = versionFromModelText(requested);
  const currentValueFamily = current ? modelFamily(current) : null;
  const currentValueVersion = current ? versionFromModelText(current) : null;
  const currentAliasOptions = current ? findAllByValue(options, current) : [];
  const currentAliasNeedsMetadata = Boolean(current && !currentValueVersion);
  const currentAliasEvidence = currentAliasNeedsMetadata && currentAliasOptions.length === 1
    ? currentAliasOptions[0]!
    : null;
  if (currentAliasNeedsMetadata && currentAliasOptions.length > 1) {
    return {
      status: "unavailable",
      reason: requestedVersion ? "version_unavailable" : "family_unavailable",
      requested,
      requestedFamily: family,
      requestedVersion,
      available: options.map((option) => option.value),
    };
  }
  const currentFamily = currentValueFamily ?? (currentAliasEvidence ? optionFamily(currentAliasEvidence) : null);
  const currentVersion = currentValueVersion ?? (currentAliasEvidence ? optionVersion(currentAliasEvidence) : null);
  const currentMatchesRequest = Boolean(
    current
    && family
    && currentFamily === family
    && (!requestedVersion || currentVersion === requestedVersion)
    && (!wantsOneMillion || isOneMillionContextModel(current)),
  );
  if (currentMatchesRequest && current) {
    return {
      status: "keep",
      value: current,
      reason: !wantsOneMillion && isOneMillionContextModel(current) ? "one_million_only" : "requested",
    };
  }

  const familyMatches = family ? options.filter((option) => optionFamily(option) === family) : [];
  if (familyMatches.length === 0) {
    // The requested family simply is not on offer. This is the one case we
    // refuse: any pick from here would be a different product.
    return {
      status: "unavailable",
      reason: "family_unavailable",
      requested,
      requestedFamily: family,
      requestedVersion,
      available: options.map((option) => option.value),
    };
  }

  // Version first. Narrow to the entries that actually run the version that was
  // asked for, and only widen to the rest of the family when that version is
  // not on offer at all. Doing this the other way round — filtering by context
  // size first — is what answers an Opus 5 request with Opus 4.8 whenever 4.8
  // happens to be the non-`[1m]` entry.
  const versionMatches = requestedVersion
    ? familyMatches.filter((option) => optionVersion(option) === requestedVersion)
    : [];
  if (requestedVersion && versionMatches.length === 0) {
    return {
      status: "unavailable",
      reason: "version_unavailable",
      requested,
      requestedFamily: family,
      requestedVersion,
      available: options.map((option) => option.value),
    };
  }
  const pool = requestedVersion ? versionMatches : familyMatches;

  // Only now does context size get a say, and only to choose between listings
  // of the same model.
  const standardInPool = pool.filter((option) => !isOneMillionContextOption(option));
  const preferred = wantsOneMillion || standardInPool.length === 0 ? pool : standardInPool;
  const choice = preferred.find((option) => option.value.trim().toLowerCase() === family) ?? preferred[0]!;

  const reason: ClaudeSessionModelReason =
    exact && choice.value !== exact.value
          // The requested value exists but only at 1M; this is the same model
          // listed at standard context, not a different model.
      ? "standard_context_fallback"
      : !wantsOneMillion && isOneMillionContextOption(choice)
        // The right model, available only as `[1m]`. Run it — the caller
        // asked for a model, not a context size.
        ? "one_million_only"
        : "requested";

  return settle(choice, reason);
}
