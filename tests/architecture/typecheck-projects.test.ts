import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8")) as Record<string, unknown>;
}

describe("independent TypeScript projects", () => {
  it.each([
    "tsconfig.shared.json",
    "tsconfig.runner.json",
    "tsconfig.interface.json",
  ])("defines %s", (relativePath) => {
    expect(existsSync(path.join(REPOSITORY_ROOT, relativePath))).toBe(true);
    const config = readJson(relativePath);
    expect(config.compilerOptions).toMatchObject({
      noEmit: true,
    });
    expect(config.include).toBeInstanceOf(Array);
  });

  it("runs every boundary project from the root typecheck script", () => {
    const packageJson = readJson("package.json") as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.typecheck).toContain("tsconfig.shared.json");
    expect(packageJson.scripts?.typecheck).toContain("tsconfig.runner.json");
    expect(packageJson.scripts?.typecheck).toContain("tsconfig.interface.json");
  });
});

describe("generated mobile and interface output", () => {
  it("is excluded without ignoring native project source", () => {
    const gitignore = readFileSync(path.join(REPOSITORY_ROOT, ".gitignore"), "utf8");
    const ignoredLines = new Set(gitignore.split(/\r?\n/).map((line) => line.trim()));

    expect(gitignore).toContain("/dist/");
    expect(gitignore).toContain("/apps/mobile/ios/App/Pods/");
    expect(gitignore).toContain("/apps/mobile/ios/DerivedData/");
    expect(gitignore).toContain("/apps/mobile/android/.gradle/");
    expect(gitignore).toContain("/apps/mobile/android/**/build/");
    expect(gitignore).toContain("/apps/mobile/android/local.properties");
    expect(ignoredLines.has("/apps/mobile/ios/")).toBe(false);
    expect(ignoredLines.has("/apps/mobile/android/")).toBe(false);
  });
});
