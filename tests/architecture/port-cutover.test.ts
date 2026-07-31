import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");
const legacyPort = ["303", "5"].join("");
const portContext = new RegExp(
  `(?:localhost|127\\.0\\.0\\.1|PORT|port|:)\\D{0,20}${legacyPort}`,
  "i",
);
const excludedDirectories = new Set([
  ".git",
  ".next",
  ".omniharness",
  "app-data",
  "dist",
  "node_modules",
  "vibes",
]);
const excludedDocuments = new Set([
  "docs/architecture/conversation-ui-regression-lessons.md",
  "docs/architecture/frontend-state-and-rendering.md",
  "docs/architecture/hot-path-responsiveness-and-resource-leaks.md",
]);

function scan(directory: string, violations: string[]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(repositoryRoot, absolutePath).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if (
        excludedDirectories.has(entry.name)
        || relativePath === "docs/codex-history"
        || relativePath === "docs/superpowers"
      ) {
        continue;
      }
      scan(absolutePath, violations);
      continue;
    }
    if (
      excludedDocuments.has(relativePath)
      || !/\.(?:c?js|json|md|mjs|sh|ts|tsx|yaml|yml)$/.test(entry.name)
    ) {
      continue;
    }
    let source: string;
    try {
      source = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }
    if (portContext.test(source)) {
      violations.push(relativePath);
    }
  }
}

describe("legacy interface port cutover", () => {
  test("no live operator source treats the old proxy port as an endpoint", () => {
    const violations: string[] = [];
    scan(repositoryRoot, violations);
    expect(violations).toEqual([]);
  });
});
