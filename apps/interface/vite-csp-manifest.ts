import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

function hash(value: string | Uint8Array) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

function hashHex(value: string | Uint8Array) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function interfaceCspManifestPlugin(): Plugin {
  return {
    name: "omniharness-interface-csp-manifest",
    enforce: "post",
    writeBundle(options, bundle) {
      if (!options.dir) {
        throw new Error("Vite CSP manifest generation requires an output directory.");
      }
      const indexOutput = bundle["index.html"];
      if (!indexOutput) {
        throw new Error("Vite did not emit index.html for CSP manifest generation.");
      }
      const indexHtml = fs.readFileSync(path.join(options.dir, "index.html"), "utf8");
      const themeMatch = indexHtml.match(
        /<script[^>]*\bid=["']omni-theme-bootstrap["'][^>]*>([\s\S]*?)<\/script>/i,
      );
      if (!themeMatch) {
        throw new Error("Vite index.html is missing the OmniHarness theme bootstrap.");
      }
      const assets = Object.values(bundle)
        .filter((output) => !output.fileName.endsWith(".html"))
        .map((output) => ({
          path: output.fileName,
          sha256: hash(fs.readFileSync(path.join(options.dir!, output.fileName))),
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
      const serviceWorkerPath = path.join(options.dir, "sw.js");
      const serviceWorkerSource = fs.readFileSync(serviceWorkerPath, "utf8");
      const buildHash = hashHex(
        JSON.stringify(assets.map((asset) => [asset.path, asset.sha256])),
      ).slice(0, 16);
      const precacheAssets = assets
        .map((asset) => `/${asset.path}`)
        .filter((assetPath) => assetPath.startsWith("/assets/"));
      const serviceWorker = serviceWorkerSource
        .replaceAll("__OMNI_BUILD_HASH__", buildHash)
        .replace("__OMNI_PRECACHE_ASSETS__", JSON.stringify(precacheAssets));
      if (
        serviceWorker.includes("__OMNI_BUILD_HASH__")
        || serviceWorker.includes("__OMNI_PRECACHE_ASSETS__")
      ) {
        throw new Error("Vite did not replace every service-worker build placeholder.");
      }
      fs.writeFileSync(serviceWorkerPath, serviceWorker);
      fs.writeFileSync(
        path.join(options.dir, "csp-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          themeScriptSha256: hash(themeMatch[1] ?? ""),
          assets,
        }, null, 2),
      );
    },
  };
}
