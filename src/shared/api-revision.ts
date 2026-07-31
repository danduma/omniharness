export const RUNNER_PACKAGE_VERSION = "0.1.0";

export const RUNNER_API_REVISION = {
  minimum: 1,
  current: 1,
} as const;

export const RUNNER_CAPABILITIES = [
  "browser_authorization_pkce",
  "cross_origin_stream_tickets",
  "runner_administration",
  "unified_worker_stream",
] as const;

export type RunnerCapabilityId = typeof RUNNER_CAPABILITIES[number];

export type ApiRevisionWindow = {
  minimum: number;
  current: number;
};

export type ApiCompatibilityResult = {
  compatible: boolean;
  reason: "revision_window_mismatch" | null;
  unknownCapabilities: string[];
};

export type ApiContractChangeClassification =
  | "additive-capability"
  | "transport-breaking";

export const ROUTE_CONTRACT_DECLARATION = {
  fixtureSchemaVersion: 1,
  fingerprint: "fnv1a32:05be65bf",
  classification: "additive-capability",
  capability: "runner_administration",
  apiRevision: 1,
} as const;

const KNOWN_CAPABILITIES = new Set<string>(RUNNER_CAPABILITIES);

export function stableRouteContractFingerprint(routes: readonly string[]) {
  let hash = 2_166_136_261;
  for (const character of [...routes].sort().join("\n")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function assessApiCompatibility(remote: {
  apiRevision: ApiRevisionWindow;
  capabilities: readonly string[];
}): ApiCompatibilityResult {
  const windowsOverlap = (
    remote.apiRevision.minimum <= RUNNER_API_REVISION.current
    && RUNNER_API_REVISION.minimum <= remote.apiRevision.current
  );
  return {
    compatible: windowsOverlap,
    reason: windowsOverlap ? null : "revision_window_mismatch",
    unknownCapabilities: remote.capabilities.filter(
      (capability) => !KNOWN_CAPABILITIES.has(capability),
    ),
  };
}

export function validateApiContractChange(change: {
  classification: ApiContractChangeClassification;
  capability?: string;
  previousRevision: number;
  nextRevision: number;
}): { valid: boolean; reason: string | null } {
  if (change.classification === "additive-capability") {
    if (!change.capability || !KNOWN_CAPABILITIES.has(change.capability)) {
      return {
        valid: false,
        reason: "Additive changes must name a declared capability.",
      };
    }
    if (change.nextRevision !== change.previousRevision) {
      return {
        valid: false,
        reason: "Additive changes must not bump the transport revision.",
      };
    }
    return { valid: true, reason: null };
  }

  if (change.nextRevision <= change.previousRevision) {
    return {
      valid: false,
      reason: "Transport-breaking changes must bump the revision.",
    };
  }
  return { valid: true, reason: null };
}
