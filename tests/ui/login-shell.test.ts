import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/LoginShell.tsx"),
  "utf8",
);

test("login shell exposes the unlock flow and pair redemption state", () => {
  expect(source).toContain("Unlock OmniHarness");
  expect(source).toContain("Redeeming pairing code...");
  expect(source).toContain("Enter instance password");
  expect(source).toContain("Connecting this phone");
  expect(source).toContain("Authentication setup required");
});
