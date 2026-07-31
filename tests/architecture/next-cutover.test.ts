import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");

function filesUnder(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("Next cutover", () => {
  test("the runner and interface have no Next owner or dependency", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(packageJson.dependencies).not.toHaveProperty("next");
    expect(packageJson.devDependencies).not.toHaveProperty("eslint-config-next");
    expect(Object.values(packageJson.scripts ?? {}).join("\n")).not.toMatch(
      /\bnext(?:\s|$)|dev:web|dev:proxy/,
    );

    const forbiddenPaths = [
      ".next",
      "next-env.d.ts",
      "next.config.ts",
      "src/app",
      "public/manifest.webmanifest",
      "public/sw.js",
      "public/offline.html",
    ];
    expect(
      forbiddenPaths.filter((relativePath) =>
        fs.existsSync(path.join(repositoryRoot, relativePath))),
    ).toEqual([]);

    const sourceRoots = [
      "apps/interface",
      "src/components",
      "src/interface",
      "src/runtime",
      "src/server",
      "src/ui",
    ];
    const violations: string[] = [];
    for (const sourceRoot of sourceRoots) {
      for (const filePath of filesUnder(path.join(repositoryRoot, sourceRoot))) {
        if (!/\.[cm]?[jt]sx?$/.test(filePath)) {
          continue;
        }
        const source = fs.readFileSync(filePath, "utf8");
        if (
          /(?:from|import\()\s*["']next(?:\/|["'])/.test(source)
          || /\bNEXT_PUBLIC_[A-Z0-9_]+\b/.test(source)
        ) {
          violations.push(path.relative(repositoryRoot, filePath));
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
