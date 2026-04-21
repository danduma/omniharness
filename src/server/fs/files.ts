import fs from "fs";
import path from "path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".turbo",
  ".cache",
  "node_modules",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  "target",
  "out",
]);

function walkFiles(root: string, currentDir: string, files: string[]) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walkFiles(root, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(path.relative(root, absolutePath));
  }
}

export function listProjectFiles(root: string) {
  const resolvedRoot = path.resolve(root);
  const files: string[] = [];
  walkFiles(resolvedRoot, resolvedRoot, files);
  return files.sort((left, right) => left.localeCompare(right));
}

