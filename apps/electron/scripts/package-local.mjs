import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const outputRoot = path.resolve(
  process.env.OMNIHARNESS_PACKAGE_OUT
    ?? path.join(os.tmpdir(), "omniharness-electron-package"),
);

execFileSync("pnpm", ["electron:build"], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});

const paths = await packager({
  dir: appRoot,
  name: "OmniHarness",
  appVersion: "0.1.0",
  electronVersion: "42.2.0",
  platform: process.platform,
  arch: process.arch,
  out: outputRoot,
  overwrite: true,
  asar: true,
  extraResource: [path.join(repositoryRoot, "dist/interface-packaged")],
  ignore: [
    /^\/scripts$/,
    /^\/src$/,
    /^\/main\.ts$/,
    /^\/preload\.ts$/,
  ],
});

process.stdout.write(`${JSON.stringify({
  ok: true,
  kind: "electron.local_package",
  paths,
})}\n`);
