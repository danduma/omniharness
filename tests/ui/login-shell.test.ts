import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/LoginShell.tsx"),
  "utf8",
);

test("login shell exposes the unlock flow and pair redemption state", () => {
  expect(source).toContain("login.submit");
  expect(source).toContain("login.pair.redeemingCode");
  expect(source).toContain("login.password.placeholder");
  expect(source).toContain("login.pair.description");
  expect(source).toContain("login.configError.title");
});
