import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const nextConfigSource = fs.readFileSync(
  path.resolve(process.cwd(), "next.config.ts"),
  "utf8"
);

test("next config rewrites direct conversation ids onto the app shell", () => {
  expect(nextConfigSource).toContain("async rewrites()");
  expect(nextConfigSource).toContain('source: "/session/:runId([0-9a-fA-F-]{36})"');
  expect(nextConfigSource).toContain('destination: "/?run=:runId"');
});

test("next config keeps metadata in the initial head for PWA installability", () => {
  expect(nextConfigSource).toContain("htmlLimitedBots: /.*/");
});
