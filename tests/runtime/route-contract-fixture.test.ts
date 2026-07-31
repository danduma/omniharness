import { describe, expect, it } from "vitest";
import fixture from "./fixtures/routes.v1.json";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import { discoverRuntimeRouteContract } from "./route-contract-fixture";

describe("runtime route contract fixture", () => {
  it("matches every route owned by the runner registry", () => {
    const registry = createOmniRuntimeHttpRegistry();
    expect(discoverRuntimeRouteContract(registry)).toEqual([...fixture.routes].sort());
  });
});
