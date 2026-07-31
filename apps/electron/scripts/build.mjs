import { build } from "esbuild";
import { statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const externals = [
  "electron",
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
];

function resolveSourcePath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? basePath;
}

const aliasPlugin = {
  name: "omni-alias",
  setup(api) {
    api.onResolve({ filter: /^@\// }, (args) => ({
      path: resolveSourcePath(path.join(repoRoot, "src", args.path.slice(2))),
    }));
  },
};

await mkdir(path.join(appRoot, "dist"), { recursive: true });
execFileSync("pnpm", ["build:interface:packaged"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

await build({
  entryPoints: [path.join(appRoot, "main.ts")],
  outfile: path.join(appRoot, "dist", "main.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: externals,
  plugins: [aliasPlugin],
  sourcemap: true,
  logLevel: "info",
});

await build({
  entryPoints: [path.join(appRoot, "preload.ts")],
  outfile: path.join(appRoot, "dist", "preload.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
});
