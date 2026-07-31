import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("shared interface ownership", () => {
  test("shared interface code lives outside the former Next app tree", () => {
    const sharedRoots = [
      path.join(repositoryRoot, "apps/interface"),
      path.join(repositoryRoot, "src/components"),
      path.join(repositoryRoot, "src/interface"),
      path.join(repositoryRoot, "src/ui"),
    ];
    const violations = sourceFiles(path.join(repositoryRoot, "src/app/home"))
      .filter((filePath) => path.basename(filePath) !== "bootstrap.server.ts")
      .map((filePath) => path.relative(repositoryRoot, filePath));

    for (const root of sharedRoots) {
      for (const filePath of sourceFiles(root)) {
        const source = fs.readFileSync(filePath, "utf8");
        if (/(?:from|import\()\s*["']@\/app(?:\/|["'])/.test(source)) {
          violations.push(path.relative(repositoryRoot, filePath));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
