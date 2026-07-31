import fixture from "@/../tests/runtime/fixtures/routes.v1.json";
import { describe, expect, it } from "vitest";
import {
  RUNNER_API_REVISION,
  RUNNER_CAPABILITIES,
  ROUTE_CONTRACT_DECLARATION,
  assessApiCompatibility,
  stableRouteContractFingerprint,
  validateApiContractChange,
} from "@/shared/api-revision";

describe("runner API compatibility", () => {
  it("publishes an internally valid supported revision window", () => {
    expect(RUNNER_API_REVISION.minimum).toBeGreaterThan(0);
    expect(RUNNER_API_REVISION.current).toBeGreaterThanOrEqual(
      RUNNER_API_REVISION.minimum,
    );
  });

  it("does not reject unknown additive capabilities", () => {
    expect(assessApiCompatibility({
      apiRevision: RUNNER_API_REVISION,
      capabilities: [...RUNNER_CAPABILITIES, "future_optional_feature"],
    })).toEqual({
      compatible: true,
      reason: null,
      unknownCapabilities: ["future_optional_feature"],
    });
  });

  it("rejects revision windows with no overlap", () => {
    expect(assessApiCompatibility({
      apiRevision: {
        minimum: RUNNER_API_REVISION.current + 1,
        current: RUNNER_API_REVISION.current + 2,
      },
      capabilities: [],
    })).toMatchObject({
      compatible: false,
      reason: "revision_window_mismatch",
    });
  });

  it("requires additive changes to declare a known capability without bumping the revision", () => {
    expect(validateApiContractChange({
      classification: "additive-capability",
      capability: "unified_worker_stream",
      previousRevision: 1,
      nextRevision: 1,
    })).toEqual({ valid: true, reason: null });
    expect(validateApiContractChange({
      classification: "additive-capability",
      capability: "undeclared_capability",
      previousRevision: 1,
      nextRevision: 1,
    })).toMatchObject({ valid: false });
    expect(validateApiContractChange({
      classification: "additive-capability",
      capability: "unified_worker_stream",
      previousRevision: 1,
      nextRevision: 2,
    })).toMatchObject({ valid: false });
  });

  it("requires transport-breaking changes to bump the revision", () => {
    expect(validateApiContractChange({
      classification: "transport-breaking",
      previousRevision: 1,
      nextRevision: 2,
    })).toEqual({ valid: true, reason: null });
    expect(validateApiContractChange({
      classification: "transport-breaking",
      previousRevision: 1,
      nextRevision: 1,
    })).toMatchObject({ valid: false });
  });

  it("fails when the route fixture changes without updating its declaration", () => {
    expect(stableRouteContractFingerprint(fixture.routes)).toBe(
      ROUTE_CONTRACT_DECLARATION.fingerprint,
    );
    expect(ROUTE_CONTRACT_DECLARATION.fixtureSchemaVersion).toBe(
      fixture.schemaVersion,
    );
    expect(validateApiContractChange({
      classification: ROUTE_CONTRACT_DECLARATION.classification,
      capability: ROUTE_CONTRACT_DECLARATION.capability,
      previousRevision: ROUTE_CONTRACT_DECLARATION.apiRevision,
      nextRevision: RUNNER_API_REVISION.current,
    })).toEqual({ valid: true, reason: null });
  });
});
