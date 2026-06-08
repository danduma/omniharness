import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "process";

process.env.OMNIHARNESS_SERVER_MODE = "production";

// `next start` needs a complete production build in .next. A dev/turbo run
// leaves BUILD_ID in place but rewrites routes-manifest.json without
// `dataRoutes`, which makes `next start` crash with
// "routesManifest.dataRoutes is not iterable". Validating the manifest (not just
// the presence of BUILD_ID) keeps this production entry self-contained: it can
// be the restart-control "prod" command directly, without depending on the
// first-time ./omniharness setup having run a build first.
function hasValidProductionBuild(): boolean {
  const manifestPath = path.join(process.cwd(), ".next", "routes-manifest.json");
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { dataRoutes?: unknown };
    return Array.isArray(manifest.dataRoutes);
  } catch {
    return false;
  }
}

if (!hasValidProductionBuild()) {
  process.stdout.write("[start] No valid production build in .next; running `pnpm build`...\n");
  execFileSync("pnpm", ["build"], { stdio: "inherit" });
}

void import("./dev").catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
