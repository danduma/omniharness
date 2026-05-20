import { build } from "esbuild";
import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const rendererOutdir = path.join(appRoot, "dist", "renderer");
await mkdir(rendererOutdir, { recursive: true });

await build({
  entryPoints: [path.join(repoRoot, "src", "ui", "render-web.tsx")],
  outfile: path.join(rendererOutdir, "renderer.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  plugins: [aliasPlugin],
  sourcemap: true,
  logLevel: "info",
});

await writeFile(path.join(rendererOutdir, "index.html"), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;">
    <title>OmniHarness</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="/renderer.js"></script>
  </body>
</html>
`, "utf8");
