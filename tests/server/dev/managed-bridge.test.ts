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

  it("requests a build when the bridge daemon output is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "managed-bridge-"));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "daemon.ts"), "// src");

    expect(bridgeNeedsBuild(dir)).toBe(true);
  });

  it("requests a build when bridge source is newer than the built daemon", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "managed-bridge-"));
    tempDirs.push(dir);
    const srcDir = path.join(dir, "src");
    const distDir = path.join(dir, "dist");
    const srcPath = path.join(srcDir, "daemon.ts");
    const distPath = path.join(distDir, "daemon.js");

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(srcPath, "// src");
    fs.writeFileSync(distPath, "// dist");

    const now = new Date();
    const older = new Date(now.getTime() - 60_000);
    fs.utimesSync(distPath, older, older);
    fs.utimesSync(srcPath, now, now);

    expect(bridgeNeedsBuild(dir)).toBe(true);
  });

  it("skips the build when the built daemon is newer than the bridge source", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "managed-bridge-"));
    tempDirs.push(dir);
    const srcDir = path.join(dir, "src");
    const distDir = path.join(dir, "dist");
    const srcPath = path.join(srcDir, "daemon.ts");
    const distPath = path.join(distDir, "daemon.js");

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(srcPath, "// src");
    fs.writeFileSync(distPath, "// dist");

    const now = new Date();
    const older = new Date(now.getTime() - 60_000);
    fs.utimesSync(srcPath, older, older);
    fs.utimesSync(distPath, now, now);

    expect(bridgeNeedsBuild(dir)).toBe(false);
  });
});
