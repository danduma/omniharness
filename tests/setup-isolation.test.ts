import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Vitest data-root isolation", () => {
  it("replaces an inherited runner root with a temporary test root", () => {
    const configuredRoot = path.resolve(process.env.OMNIHARNESS_ROOT || "");
    const temporaryRoot = path.resolve(os.tmpdir());

    expect(configuredRoot).not.toBe(path.resolve(process.cwd()));
    expect(configuredRoot.startsWith(`${temporaryRoot}${path.sep}`)).toBe(true);
  });
});
