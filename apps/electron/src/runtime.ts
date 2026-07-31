import fs from "node:fs";
import path from "node:path";

export const ELECTRON_APP_ORIGIN = "app://omniharness";

export function resolveElectronInterfaceDir(
  mainDir: string,
  packagedResourcesPath?: string,
) {
  if (packagedResourcesPath) {
    return path.join(packagedResourcesPath, "interface-packaged");
  }
  return path.resolve(mainDir, "../../../dist/interface-packaged");
}

export function resolveElectronRendererUrl(input: {
  env?: Record<string, string | undefined>;
} = {}) {
  const configured = (input.env ?? process.env).OMNI_ELECTRON_RENDERER_URL?.trim();
  return configured || `${ELECTRON_APP_ORIGIN}/index.html`;
}

export function electronPackagedCsp(interfaceDir: string) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(interfaceDir, "csp-manifest.json"), "utf8"),
  ) as { themeScriptSha256?: unknown };
  if (typeof manifest.themeScriptSha256 !== "string") {
    throw new Error("Packaged interface CSP manifest is invalid.");
  }
  return [
    "default-src 'none'",
    `script-src 'self' 'sha256-${manifest.themeScriptSha256}'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function resolveElectronAssetPath(interfaceDir: string, requestUrl: string) {
  const url = new URL(requestUrl);
  if (url.protocol !== "app:" || url.hostname !== "omniharness") {
    throw new Error("Electron asset request has an untrusted origin.");
  }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(interfaceDir, relative);
  const root = `${path.resolve(interfaceDir)}${path.sep}`;
  if (resolved !== path.resolve(interfaceDir, "index.html") && !resolved.startsWith(root)) {
    throw new Error("Electron asset path escaped the packaged interface.");
  }
  return resolved;
}
