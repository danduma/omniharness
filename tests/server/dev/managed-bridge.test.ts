import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BRIDGE_URL, bridgeNeedsBuild, resolveBridgeDir, resolveBridgeUrl, shouldAutoStartBridge } from "@/server/dev/managed-bridge";

describe("managed bridge helpers", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("defaults to the local bridge url", () => {
    expect(resolveBridgeUrl({})).toBe(DEFAULT_BRIDGE_URL);
  });

  it("honors explicit bridge url overrides", () => {
    expect(resolveBridgeUrl({ OMNIHARNESS_BRIDGE_URL: "http://127.0.0.1:9999" })).toBe("http://127.0.0.1:9999");
  });

  it("uses the OmniHarness repo root as the managed runtime directory by default", () => {
    expect(resolveBridgeDir("/repo/omniharness", {})).toBe(path.resolve("/repo/omniharness"));
  });

  it("honors an explicit runtime directory override", () => {
    expect(resolveBridgeDir("/repo/omniharness", { OMNIHARNESS_RUNTIME_DIR: "/tmp/custom-runtime" })).toBe(path.resolve("/tmp/custom-runtime"));
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

  it("does not require a prebuilt daemon because the internal runtime is launched with tsx", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "managed-runtime-"));
    tempDirs.push(dir);

    expect(bridgeNeedsBuild(dir)).toBe(false);
  });

  it("still honors the legacy bridge directory override during migration", () => {
    expect(resolveBridgeDir("/repo/omniharness", { OMNIHARNESS_BRIDGE_DIR: "/tmp/legacy-bridge" })).toBe(path.resolve("/tmp/legacy-bridge"));
  });
});
