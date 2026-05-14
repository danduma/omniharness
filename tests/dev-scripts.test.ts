import fs from "fs";
import path from "path";
import { expect, test } from "vitest";
import nextConfig from "@/../next.config";
import { isNextDevReadyLine, prewarmDevPaths, resolveDevPrewarmBaseUrl, resolveDevPrewarmPaths } from "@/../scripts/dev-prewarm";
import { detectNextDevRouteEnoent } from "@/../scripts/dev-web-recovery";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
) as { scripts?: Record<string, string> };

test("dev:web uses the current Next dev command", () => {
  expect(packageJson.scripts?.["dev:web"]).toBe("next dev --turbo");
});

test("webpack config aliases optional encoding package away for local dev", () => {
  expect(typeof nextConfig.webpack).toBe("function");

  const config = { resolve: { alias: {} as Record<string, false | string> } };
  const result = nextConfig.webpack?.(config, { isServer: true, dev: true } as never);
  const resolved = (result ?? config).resolve?.alias as Record<string, false | string> | undefined;

  expect(resolved?.encoding).toBe(path.resolve(process.cwd(), "src/shims/empty-encoding.ts"));
});

test("dev web recovery detects missing Next app route artifacts under this repo", () => {
  const repoRoot = process.cwd();
  const line = `[Error: ENOENT: no such file or directory, open '${path.join(repoRoot, ".next/server/app/api/settings/route.js")}']`;

  expect(detectNextDevRouteEnoent(line, repoRoot)).toEqual({
    artifactDir: path.join(repoRoot, ".next/server/app/api/settings"),
    routeFile: path.join(repoRoot, ".next/server/app/api/settings/route.js"),
  });
});

test("dev web recovery ignores missing route artifacts outside this repo", () => {
  const line = "[Error: ENOENT: no such file or directory, open '/tmp/other/.next/server/app/api/settings/route.js']";

  expect(detectNextDevRouteEnoent(line, process.cwd())).toBeNull();
});

test("dev prewarm defaults include the live events snapshot route", () => {
  expect(resolveDevPrewarmPaths({})).toContain("/api/events?snapshot=1&persisted=1");
});

test("dev prewarm can be disabled or extended from env", () => {
  expect(resolveDevPrewarmPaths({ OMNIHARNESS_DEV_PREWARM: "0" })).toEqual([]);
  expect(resolveDevPrewarmPaths({
    OMNIHARNESS_DEV_PREWARM_PATHS: "/custom, api/custom-two",
    OMNIHARNESS_DEV_PREWARM_EXTRA_PATHS: "/api/events?snapshot=1",
  })).toEqual([
    "/custom",
    "/api/custom-two",
    "/api/events?snapshot=1",
  ]);
});

test("dev prewarm detects the Next ready log line", () => {
  expect(isNextDevReadyLine(" ✓ Ready in 1218ms")).toBe(true);
  expect(isNextDevReadyLine(" ○ Compiling /api/events ...")).toBe(false);
});

test("dev prewarm resolves wildcard hosts to localhost", () => {
  expect(resolveDevPrewarmBaseUrl("0.0.0.0", "3050")).toBe("http://127.0.0.1:3050");
  expect(resolveDevPrewarmBaseUrl("localhost", "3050")).toBe("http://localhost:3050");
});

test("dev prewarm requests routes sequentially", async () => {
  const activeRequests: string[] = [];
  const seen: string[] = [];

  const results = await prewarmDevPaths({
    baseUrl: "http://127.0.0.1:3050",
    paths: ["/one", "/two"],
    timeoutMs: 1000,
    fetchImpl: async (input) => {
      const path = new URL(String(input)).pathname;
      expect(activeRequests).toEqual([]);
      activeRequests.push(path);
      seen.push(path);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeRequests.pop();
      return new Response("ok", { status: 200 });
    },
  });

  expect(seen).toEqual(["/one", "/two"]);
  expect(results.map((result) => result.status)).toEqual([200, 200]);
});
