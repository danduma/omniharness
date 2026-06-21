/**
 * Shared predicates for recognizing when an Omni request already points at an
 * existing plan/spec (so it can skip the interactive planning phase and go
 * straight to supervised implementation). Imported by both the CLI arg parser
 * (`src/server/cli/options.ts`) and conversation creation
 * (`src/server/conversations/modes.ts`) so the two never drift.
 */

export function looksLikePlanPath(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("/") || trimmed.endsWith(".md") || trimmed.endsWith(".txt");
}

/**
 * True when an Omni command should be treated as "a plan already exists" — i.e.
 * the user explicitly asked to implement, or handed over a plan/spec file path.
 */
export function omniRequestIsPlanReady(command: string) {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().startsWith("implement ")) return true;
  // A bare single-token path (no spaces) that looks like a file reference.
  return !/\s/.test(trimmed) && looksLikePlanPath(trimmed);
}
