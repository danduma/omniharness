import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const FRONTEND_ROOTS = ["src/app", "src/components"];
const FRONTEND_EXTENSIONS = new Set([".ts", ".tsx"]);

// Technical constants that are correctly hardcoded and NOT user-visible
const ARIA_ALLOWLIST = new Set([
  // Structural/semantic only — no visible text counterpart needed
  "presentation",
  "dialog",
  "menu",
  "menuitem",
  "combobox",
  "listbox",
  "option",
  "grid",
  "row",
  "cell",
  "tree",
  "treeitem",
  "button",
  "checkbox",
  "radio",
  "slider",
  "spinbutton",
  "tab",
  "tabpanel",
  "tablist",
  "toolbar",
  "tooltip",
  "progressbar",
  "status",
  "alert",
  "alertdialog",
  "banner",
  "complementary",
  "contentinfo",
  "form",
  "main",
  "navigation",
  "region",
  "search",
  "separator",
  "img",
  "figure",
  "group",
  "application",
]);

// Files allowed to have hardcoded English strings because they are:
// - Test utilities
// - Type definition files
// - Server-only code (no UI)
// - Already migrated to t() but not yet covered
const FILE_ALLOWLIST = new Set([
  "src/app/home/constants.ts",
  "src/app/home/types.ts",
  "src/app/home/utils.ts",
  "src/components/ui",
]);

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("api") || entry.name === "ui") {
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
    }))
    .filter((file) => {
      // Skip files in the allowlist
      return !Array.from(FILE_ALLOWLIST).some((allowed) =>
        file.relativePath.startsWith(allowed),
      );
    });
}

// Checks if a file uses the t() translation function or has no user-visible strings
function usesI18n(source: string): boolean {
  return /\bt\s*\(["']/.test(source) || /from\s+["']@\/lib\/i18n["']/.test(source);
}

// Detect hardcoded aria-label="..." patterns with English text (not using t() or a variable)
const HARDCODED_ARIA_PATTERN = /aria-label=["']([^"'{}]+)["']/g;
const HARDCODED_PLACEHOLDER_PATTERN = /placeholder=["']([^"'{}]+)["']/g;

// Strings that are OK to be hardcoded because they are programmatic or non-visible
const STRING_ALLOWLIST = [
  // Programmatic / technical patterns
  /^[a-z0-9-_:/]+$/i,        // pure kebab-case / camelCase identifiers
  /^[A-Z][A-Z0-9_]+$/,       // ALL_CAPS constants
  /^\s*$/,                    // whitespace only
  /^https?:\/\//,             // URLs
  /^\/api\//,                 // API paths
  /^\//,                      // paths
  /^#/,                       // CSS ids or hex colors
  /^\d+$/,                    // numbers only
];

function isAllowedString(str: string): boolean {
  return STRING_ALLOWLIST.some((pattern) => pattern.test(str.trim()));
}

describe("i18n hardcoded copy", () => {
  it("components with hardcoded aria-labels use t() for translations", () => {
    const violations: string[] = [];

    for (const file of frontendSourceFiles()) {
      // Skip server-side files
      if (
        file.relativePath.includes("/api/") ||
        file.relativePath.includes("server") ||
        file.relativePath.endsWith(".test.ts") ||
        file.relativePath.endsWith(".test.tsx")
      ) {
        continue;
      }

      let match: RegExpExecArray | null;
      HARDCODED_ARIA_PATTERN.lastIndex = 0;

      while ((match = HARDCODED_ARIA_PATTERN.exec(file.source)) !== null) {
        const value = match[1].trim();
        if (!isAllowedString(value) && !ARIA_ALLOWLIST.has(value) && value.length > 2) {
          if (!usesI18n(file.source)) {
            violations.push(`${file.relativePath}: aria-label="${value}"`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("components with hardcoded placeholders use t() for translations", () => {
    const violations: string[] = [];

    for (const file of frontendSourceFiles()) {
      if (
        file.relativePath.includes("/api/") ||
        file.relativePath.endsWith(".test.ts") ||
        file.relativePath.endsWith(".test.tsx")
      ) {
        continue;
      }

      let match: RegExpExecArray | null;
      HARDCODED_PLACEHOLDER_PATTERN.lastIndex = 0;

      while ((match = HARDCODED_PLACEHOLDER_PATTERN.exec(file.source)) !== null) {
        const value = match[1].trim();
        if (!isAllowedString(value) && value.length > 2) {
          if (!usesI18n(file.source)) {
            violations.push(`${file.relativePath}: placeholder="${value}"`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("locale files have all keys in parity across locales", () => {
    const en = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "shared/locales/en.json"), "utf8"),
    ) as Record<string, string>;
    const otherLocales = ["de", "es", "fr", "it", "ja", "ko", "pt", "zh-CN"];
    const englishKeys = Object.keys(en).sort();

    for (const locale of otherLocales) {
      const localeData = JSON.parse(
        fs.readFileSync(
          path.resolve(process.cwd(), `shared/locales/${locale}.json`),
          "utf8",
        ),
      ) as Record<string, string>;
      expect(Object.keys(localeData).sort(), `${locale}.json key parity`).toEqual(englishKeys);
    }
  });
});
