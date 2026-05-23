/**
 * Diagnostic: measure listProjectFiles latency on this repo and compare the
 * `find` subprocess path against the legacy JS recursive walk.
 *
 * Usage: pnpm exec tsx scripts/time-list-project-files.ts [root]
 */
import { listProjectFiles } from "@/server/fs/files";
import fs from "fs";
import path from "path";

function walkLegacy(root: string, currentDir: string, files: string[]) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (new Set([
        ".git", ".hg", ".svn", ".next", ".turbo", ".cache",
        "node_modules", "__pycache__", "dist", "build", "coverage",
        "target", "out",
      ]).has(entry.name)) continue;
      walkLegacy(root, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(path.relative(root, absolutePath));
  }
}

function listLegacy(root: string) {
  const resolved = path.resolve(root);
  const files: string[] = [];
  walkLegacy(resolved, resolved, files);
  return files.sort((a, b) => a.localeCompare(b));
}

async function main() {
  const root = process.argv[2] || process.cwd();
  console.log(`[listProjectFiles timing on ${root}]`);

  // Warm caches.
  listLegacy(root);
  listProjectFiles(root);

  const N = 3;

  let total = 0;
  let count = 0;
  for (let i = 0; i < N; i++) {
    const t = Date.now();
    const out = listLegacy(root);
    const dt = Date.now() - t;
    total += dt;
    count = out.length;
    console.log(`  legacy(JS readdir)    run ${i + 1}: ${dt}ms  (${out.length} files)`);
  }
  console.log(`  legacy avg: ${(total / N).toFixed(1)}ms`);

  total = 0;
  for (let i = 0; i < N; i++) {
    const t = Date.now();
    const out = listProjectFiles(root);
    const dt = Date.now() - t;
    total += dt;
    if (out.length !== count) {
      console.log(`  ⚠ result count differs: find=${out.length} vs legacy=${count}`);
    }
    console.log(`  current(find subprocess) run ${i + 1}: ${dt}ms  (${out.length} files)`);
  }
  console.log(`  current avg: ${(total / N).toFixed(1)}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
