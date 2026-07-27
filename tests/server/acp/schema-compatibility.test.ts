import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

function installedSdkPackage() {
  const packagePath = require.resolve("@agentclientprotocol/sdk/package.json");
  return JSON.parse(readFileSync(packagePath, "utf8")) as { version?: string };
}

describe("ACP schema compatibility", () => {
  it("uses the ACP 0.25 protocol baseline required by the installed Claude adapter", () => {
    expect(installedSdkPackage().version).toBe("0.25.0");
  });
});
