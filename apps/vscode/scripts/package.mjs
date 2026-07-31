import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const outputRoot = path.resolve(
  process.env.OMNIHARNESS_PACKAGE_OUT
    ?? path.join(os.tmpdir(), "omniharness-vscode-package"),
);
const outputPath = path.join(outputRoot, "omniharness-vscode-0.1.0.vsix");
mkdirSync(outputRoot, { recursive: true });

execFileSync("pnpm", ["vscode:build"], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});
execFileSync(
  "pnpm",
  ["exec", "vsce", "package", "--no-dependencies", "--out", outputPath],
  { cwd: appRoot, env: process.env, stdio: "inherit" },
);

process.stdout.write(`${JSON.stringify({
  ok: true,
  kind: "vscode.package",
  path: outputPath,
})}\n`);
