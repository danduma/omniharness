import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const FRONTEND_ROOTS = ["src/app", "src/components"];
const FRONTEND_EXTENSIONS = new Set([".ts", ".tsx"]);

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("api")) {
        return [];
      }
      return walkFiles(absolutePath);
    }

    return FRONTEND_EXTENSIONS.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function frontendSourceFiles() {
  return FRONTEND_ROOTS.flatMap((root) => walkFiles(path.resolve(process.cwd(), root)))
    .map((absolutePath) => ({
      absolutePath,
      relativePath: path.relative(process.cwd(), absolutePath),
      source: fs.readFileSync(absolutePath, "utf8"),
    }));
}

describe("React best practices", () => {
  it("keeps frontend state in Manager classes instead of component useState", () => {
    const offenders = frontendSourceFiles()
      .filter((file) => /\buseState\b/.test(file.source))
      .map((file) => file.relativePath);

    expect(offenders).toEqual([]);
  });

  it("uses import/RefObject patterns and keeps frontend literals out of env", () => {
    const offenders = frontendSourceFiles()
      .flatMap((file) => {
        const violations = [];
        if (/\bMutableRefObject\b/.test(file.source)) {
          violations.push(`${file.relativePath}: MutableRefObject`);
        }
        if (/\brequire\s*\(/.test(file.source)) {
          violations.push(`${file.relativePath}: require()`);
        }
        if (/\bprocess\.env\.[A-Z0-9_]+\b/.test(file.source)) {
          violations.push(`${file.relativePath}: process.env`);
        }
        if (/\btransaction(s)?\b/i.test(file.source)) {
          violations.push(`${file.relativePath}: transaction`);
        }
        return violations;
      });

    expect(offenders).toEqual([]);
  });
});
