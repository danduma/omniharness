import path from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRIDGE_URL, resolveBridgeDir, resolveBridgeUrl, shouldAutoStartBridge } from "@/server/dev/managed-bridge";

describe("managed bridge helpers", () => {
  it("defaults to the local bridge url", () => {
    expect(resolveBridgeUrl({})).toBe(DEFAULT_BRIDGE_URL);
  });

  it("honors explicit bridge url overrides", () => {
    expect(resolveBridgeUrl({ OMNIHARNESS_BRIDGE_URL: "http://127.0.0.1:9999" })).toBe("http://127.0.0.1:9999");
  });

  it("resolves the sibling bridge directory by default", () => {
    expect(resolveBridgeDir("/repo/omniharness", {})).toBe(path.resolve("/repo/acp-bridge"));
  });

  it("honors an explicit bridge directory override", () => {
    expect(resolveBridgeDir("/repo/omniharness", { OMNIHARNESS_BRIDGE_DIR: "/tmp/custom-bridge" })).toBe(path.resolve("/tmp/custom-bridge"));
  });

  it("auto-starts only for local http bridge urls", () => {
    expect(shouldAutoStartBridge({}, "http://127.0.0.1:7800")).toBe(true);
    expect(shouldAutoStartBridge({}, "http://localhost:7800")).toBe(true);
    expect(shouldAutoStartBridge({}, "https://localhost:7800")).toBe(false);
    expect(shouldAutoStartBridge({}, "http://bridge.example.com:7800")).toBe(false);
  });

  it("lets env disable automatic bridge management", () => {
    expect(shouldAutoStartBridge({ OMNIHARNESS_MANAGE_BRIDGE: "false" }, "http://127.0.0.1:7800")).toBe(false);
  });
});
