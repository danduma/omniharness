import fs from "fs";
import path from "path";
import { expect, test } from "vitest";
import nextConfig from "@/../next.config";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
) as { scripts?: Record<string, string> };

test("dev:web does not opt into Turbopack while Next dev HMR ping messages are incompatible", () => {
  expect(packageJson.scripts?.["dev:web"]).toBe("next dev");
});

test("webpack config aliases optional encoding package away for local dev", () => {
  expect(typeof nextConfig.webpack).toBe("function");

  const config = { resolve: { alias: {} as Record<string, false | string> } };
  const result = nextConfig.webpack?.(config, { isServer: true, dev: true } as never);
  const resolved = (result ?? config).resolve?.alias as Record<string, false | string> | undefined;

  expect(resolved?.encoding).toBe(false);
});
