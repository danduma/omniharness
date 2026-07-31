import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../..");
const INTERFACE_ROOTS = [
  "src/interface/home",
  "src/components",
  "src/lib",
  "src/runtime-api",
  "src/ui",
] as const;

function listTypeScriptFiles(relativeRoot: string): string[] {
  const absoluteRoot = path.join(REPOSITORY_ROOT, relativeRoot);
  const files: string[] = [];

  for (const entry of readdirSync(absoluteRoot)) {
    const absolutePath = path.join(absoluteRoot, entry);
    const relativePath = path.relative(REPOSITORY_ROOT, absolutePath);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listTypeScriptFiles(relativePath));
      continue;
    }
    if (/\.[cm]?tsx?$/.test(entry) && !entry.endsWith(".server.ts") && !entry.endsWith(".server.tsx")) {
      files.push(relativePath);
    }
  }

  return files;
}

function forbiddenImports(relativePath: string): string[] {
  const source = readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
  const violations: string[] = [];
  const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? "";
    if (
      specifier === "@/server"
      || specifier.startsWith("@/server/")
      || specifier === "@/runtime"
      || specifier.startsWith("@/runtime/")
      || specifier.includes(".server")
    ) {
      violations.push(`${relativePath}: ${specifier}`);
    }
  }
  return violations;
}

describe("interface source boundary", () => {
  it("does not import runner or HTTP-runtime modules", () => {
    const violations = INTERFACE_ROOTS
      .flatMap(listTypeScriptFiles)
      .flatMap(forbiddenImports)
      .sort();

    expect(violations).toEqual([]);
  });
});
