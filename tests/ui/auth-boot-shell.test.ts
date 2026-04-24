import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/home/HomeApp.tsx"),
  "utf8",
);

test("app uses a neutral boot shell while auth state is still loading", () => {
  expect(pageSource).toContain("if (!routeReady || sessionQuery.isLoading");
  expect(pageSource).toContain("<BootShell");
});
