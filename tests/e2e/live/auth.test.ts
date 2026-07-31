import { describe, expect, it } from "vitest";
import { resolveLiveAuthConfiguration } from "./auth";

describe("live browser authentication", () => {
  it("accepts a runtime password for the default loopback app", () => {
    expect(resolveLiveAuthConfiguration({
      OMNIHARNESS_LIVE_E2E: "1",
      OMNIHARNESS_LIVE_E2E_PASSWORD: "runtime-only",
    })).toEqual({
      baseURL: "http://127.0.0.1:3050",
      password: "runtime-only",
      reuseAuthenticatedState: false,
    });
  });

  it("accepts an explicitly authenticated existing browser state without a password", () => {
    expect(resolveLiveAuthConfiguration({
      OMNIHARNESS_LIVE_E2E: "1",
      OMNIHARNESS_LIVE_E2E_AUTHENTICATED: "1",
    })).toEqual({
      baseURL: "http://127.0.0.1:3050",
      password: null,
      reuseAuthenticatedState: true,
    });
  });

  it("rejects missing authorization, missing password, and remote targets", () => {
    expect(() => resolveLiveAuthConfiguration({})).toThrow(/OMNIHARNESS_LIVE_E2E=1/);
    expect(() => resolveLiveAuthConfiguration({ OMNIHARNESS_LIVE_E2E: "1" })).toThrow(/password|authenticated/i);
    expect(() => resolveLiveAuthConfiguration({
      OMNIHARNESS_LIVE_E2E: "1",
      OMNIHARNESS_LIVE_E2E_PASSWORD: "runtime-only",
      OMNIHARNESS_LIVE_E2E_BASE_URL: "https://example.com",
    })).toThrow(/loopback/i);
  });
});
