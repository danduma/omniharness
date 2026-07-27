import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import nextConfig from "@/../next.config";

const nextConfigSource = fs.readFileSync(
  path.resolve(process.cwd(), "next.config.ts"),
  "utf8"
);

test("next config rewrites direct conversation ids onto the app shell", () => {
  expect(nextConfigSource).toContain("async rewrites()");
  expect(nextConfigSource).toContain('source: "/session/:runId([0-9a-fA-F]{12}|[0-9a-fA-F-]{36})"');
  expect(nextConfigSource).toContain('destination: "/?run=:runId"');
});

test("next config keeps metadata in the initial head for PWA installability", () => {
  expect(nextConfigSource).toContain("htmlLimitedBots: /.*/");
});

test("next dev allows JavaScript requests from the configured public origin", () => {
  const envSource = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  const publicOrigin = envSource.match(/^OMNIHARNESS_PUBLIC_ORIGIN=(.+)$/m)?.[1]?.trim();

  expect(publicOrigin).toBeTruthy();
  expect(nextConfig.allowedDevOrigins).toContain(new URL(publicOrigin!).hostname);
});
