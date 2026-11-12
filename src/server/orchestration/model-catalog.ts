import { decodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
import { validateExplicitWorkerAccount } from "@/server/accounts/account-allocator";
import { readDecisionLayerStatus } from "@/server/decisions/config";
import { isWorkerTypeQuotaBlocked } from "@/server/quota/type-blocking";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { getBuiltInWorkerModelOptions, type WorkerModelCatalog, type WorkerModelOption } from "@/server/worker-models";
import type { ModelBinding, WorkerModelBinding } from "@/shared/orchestration-policy";
import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "@/shared/worker-types";

/**
 * Binding preflight: resolve a configured binding against what is actually
 * installed before any dispatch. Pure inspection — it never starts an
 * agent, reserves budget, or writes a stage.
 *
 * Model identity: the requested id must resolve unambiguously to one model
 * of the binding's own CLI family. Exact ids pass; a display-name alias
 * passes only when it names exactly one model of that family; anything
 * that matches another family, or several models, is refused rather than
 * guessed.
 */

export type BindingPreflightStatus = "ready" | "unavailable" | "identity_mismatch" | "quota_blocked" | "credential_missing";

export type BindingPreflightDiagnostic =
  | "binary_missing"
  | "credentials_missing"
  | "account_invalid"
  | "quota_blocked"
  | "model_unknown"
  | "model_ambiguous"
  | "model_cross_family"
  | "gateway_not_supported"
  | "decision_key_missing"
  | "alias_resolved"
  | "gateway_model";

export type BindingPreflightResult = {
  status: BindingPreflightStatus;
  binding: ModelBinding;
  /** Normalized requested identity; null when it could not be resolved. */
  canonicalModel: string | null;
  diagnostics: BindingPreflightDiagnostic[];
};

export type WorkerAvailability = { installed: boolean; credentials: boolean };

export type BindingPreflightContext = {
  catalog: WorkerModelCatalog;
  availability: (workerType: SupportedWorkerType) => WorkerAvailability;
  isQuotaBlocked: (workerType: SupportedWorkerType) => Promise<boolean>;
  /** Resolves when the explicit account may launch this CLI; rejects otherwise. */
  validateAccount: (workerType: SupportedWorkerType, accountId: string) => Promise<unknown>;
  decisionKeyConfigured: boolean;
};

function defaultAvailability(workerType: SupportedWorkerType): WorkerAvailability {
  const result = isSpawnableWorkerType(workerType);
  if (result.ok) return { installed: true, credentials: true };
  // `isSpawnableWorkerType` checks the binary first, then the key.
  const missingKey = /missing its API key/i.test(result.reason ?? "");
  return { installed: missingKey, credentials: false };
}

export function createDefaultPreflightContext(overrides: Partial<BindingPreflightContext> = {}): BindingPreflightContext {
  const catalog = Object.fromEntries(
    SUPPORTED_WORKER_TYPES.map((type) => [type, getBuiltInWorkerModelOptions(type)]),
  ) as WorkerModelCatalog;
  return {
    catalog,
    availability: defaultAvailability,
    isQuotaBlocked: (workerType) => isWorkerTypeQuotaBlocked(workerType),
    validateAccount: (workerType, accountId) => validateExplicitWorkerAccount({ workerType, accountId }),
    decisionKeyConfigured: readDecisionLayerStatus().gatewayKeyConfigured,
    ...overrides,
  };
}

function aliasKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_.-]+/g, "");
}

function matchOptions(options: readonly WorkerModelOption[], model: string) {
  const exact = options.filter((option) => option.value === model);
  if (exact.length > 0) return { exact, alias: [] as WorkerModelOption[] };
  const key = aliasKey(model);
  const alias = options.filter((option) => aliasKey(option.label) === key || aliasKey(option.value) === key);
  return { exact, alias: dedupe(alias) };
}

function dedupe(options: WorkerModelOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => (seen.has(option.value) ? false : (seen.add(option.value), true)));
}

/** Family hints for ids that are clearly another provider's, even when uncatalogued. */
function foreignFamilyHint(workerType: SupportedWorkerType, model: string) {
  const lowered = model.toLowerCase();
  if (workerType === "codex" && (lowered.startsWith("claude") || lowered.startsWith("anthropic/") || lowered.startsWith("gemini"))) return true;
  if (workerType === "claude" && (lowered.startsWith("gpt-") || lowered.startsWith("openai/") || lowered.startsWith("gemini"))) return true;
  if (workerType === "gemini" && (lowered.startsWith("gpt-") || lowered.startsWith("claude"))) return true;
  return false;
}

export function resolveRequestedModel(binding: WorkerModelBinding, catalog: WorkerModelCatalog): {
  canonicalModel: string | null;
  diagnostics: BindingPreflightDiagnostic[];
  status: "ready" | "unavailable" | "identity_mismatch";
} {
  const gatewayModel = decodeClaudeGatewayModel(binding.model);
  if (gatewayModel !== null || binding.credentialSource === "gateway") {
    if (binding.workerType !== "claude") {
      return { canonicalModel: null, diagnostics: ["gateway_not_supported"], status: "identity_mismatch" };
    }
    if (gatewayModel === null) {
      return { canonicalModel: null, diagnostics: ["model_unknown"], status: "unavailable" };
    }
    return { canonicalModel: binding.model, diagnostics: ["gateway_model"], status: "ready" };
  }

  const own = matchOptions(catalog[binding.workerType] ?? [], binding.model);
  if (own.exact.length > 0) return { canonicalModel: own.exact[0]!.value, diagnostics: [], status: "ready" };

  const foreign = SUPPORTED_WORKER_TYPES
    .filter((type) => type !== binding.workerType)
    .some((type) => {
      const match = matchOptions(catalog[type] ?? [], binding.model);
      return match.exact.length > 0 || match.alias.length > 0;
    });

  if (own.alias.length === 1 && !foreign) {
    return { canonicalModel: own.alias[0]!.value, diagnostics: ["alias_resolved"], status: "ready" };
  }
  if (own.alias.length > 1 || (own.alias.length === 1 && foreign)) {
    return { canonicalModel: null, diagnostics: ["model_ambiguous"], status: "identity_mismatch" };
  }
  if (foreign || foreignFamilyHint(binding.workerType, binding.model)) {
    return { canonicalModel: null, diagnostics: ["model_cross_family"], status: "identity_mismatch" };
  }
  return { canonicalModel: null, diagnostics: ["model_unknown"], status: "unavailable" };
}

export async function preflightBinding(binding: ModelBinding, context: BindingPreflightContext): Promise<BindingPreflightResult> {
  if (binding.kind === "decision") {
    return context.decisionKeyConfigured
      ? { status: "ready", binding, canonicalModel: binding.model, diagnostics: [] }
      : { status: "credential_missing", binding, canonicalModel: binding.model, diagnostics: ["decision_key_missing"] };
  }

  const identity = resolveRequestedModel(binding, context.catalog);
  if (identity.status !== "ready") {
    return { status: identity.status, binding, canonicalModel: identity.canonicalModel, diagnostics: identity.diagnostics };
  }

  const availability = context.availability(binding.workerType);
  if (!availability.installed) {
    return { status: "unavailable", binding, canonicalModel: identity.canonicalModel, diagnostics: [...identity.diagnostics, "binary_missing"] };
  }
  const gateway = identity.diagnostics.includes("gateway_model");
  if (binding.accountId && !gateway) {
    try {
      await context.validateAccount(binding.workerType, binding.accountId);
    } catch {
      return { status: "credential_missing", binding, canonicalModel: identity.canonicalModel, diagnostics: [...identity.diagnostics, "account_invalid"] };
    }
  } else if (!availability.credentials && !gateway) {
    return { status: "credential_missing", binding, canonicalModel: identity.canonicalModel, diagnostics: [...identity.diagnostics, "credentials_missing"] };
  }
  if (await context.isQuotaBlocked(binding.workerType)) {
    return { status: "quota_blocked", binding, canonicalModel: identity.canonicalModel, diagnostics: [...identity.diagnostics, "quota_blocked"] };
  }
  return { status: "ready", binding, canonicalModel: identity.canonicalModel, diagnostics: identity.diagnostics };
}

/**
 * Preflight a stage: the primary binding, then (unless the profile forbids
 * automatic replacement) each fallback in order. Returns the first ready
 * one plus every attempt for diagnostics.
 */
export async function preflightStageBindings(
  bindings: { primary: ModelBinding; fallbacks: readonly ModelBinding[]; allowFallbacks: boolean },
  context: BindingPreflightContext,
): Promise<{ selected: BindingPreflightResult | null; usedFallback: boolean; attempts: BindingPreflightResult[] }> {
  const attempts: BindingPreflightResult[] = [];
  const candidates = bindings.allowFallbacks ? [bindings.primary, ...bindings.fallbacks] : [bindings.primary];
  for (const [index, candidate] of candidates.entries()) {
    const result = await preflightBinding(candidate, context);
    attempts.push(result);
    // Identity problems are configuration errors: never paper over them with a fallback.
    if (result.status === "identity_mismatch") return { selected: null, usedFallback: false, attempts };
    if (result.status === "ready") return { selected: result, usedFallback: index > 0, attempts };
  }
  return { selected: null, usedFallback: false, attempts };
}
