import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { injectBootstrapHtml } from "./bootstrap-html";
import {
  buildInterfaceSecurityHeaders,
  type InterfaceSecurityMode,
} from "./security-headers";

type CspManifest = {
  schemaVersion: 1;
  themeScriptSha256: string;
  assets: Array<{
    path: string;
    sha256: string;
  }>;
};

export type StaticBootstrapBuilder = (input: {
  request: Request;
  selectedRunId: string | null;
}) => Promise<unknown>;

export type PreparedStaticInterface = {
  enabled: boolean;
  root: string | null;
  themeScriptSha256: string | null;
  handle(request: Request): Promise<Response | null>;
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
};

function hash(value: string | Uint8Array) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

function extractThemeScript(indexHtml: string) {
  const match = indexHtml.match(
    /<script[^>]*\bid=["']omni-theme-bootstrap["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) {
    throw new Error("Static interface index.html is missing the theme script.");
  }
  return match[1] ?? "";
}

function parseManifest(raw: string): CspManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Static interface CSP manifest is malformed.");
  }
  if (
    !parsed
    || typeof parsed !== "object"
    || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
    || typeof (parsed as { themeScriptSha256?: unknown }).themeScriptSha256 !== "string"
    || !Array.isArray((parsed as { assets?: unknown }).assets)
  ) {
    throw new Error("Static interface CSP manifest has an invalid shape.");
  }
  return parsed as CspManifest;
}

async function validateManifest(root: string, indexHtml: string) {
  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(path.join(root, "csp-manifest.json"), "utf8");
  } catch {
    throw new Error("Static interface CSP manifest is missing.");
  }
  const manifest = parseManifest(manifestRaw);
  if (hash(extractThemeScript(indexHtml)) !== manifest.themeScriptSha256) {
    throw new Error("Static interface theme script does not match the CSP manifest.");
  }
  for (const asset of manifest.assets) {
    if (
      !asset
      || typeof asset.path !== "string"
      || typeof asset.sha256 !== "string"
      || path.isAbsolute(asset.path)
      || asset.path.split(/[\\/]/).includes("..")
    ) {
      throw new Error("Static interface CSP manifest contains an invalid asset.");
    }
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(path.join(root, asset.path));
    } catch {
      throw new Error(`Static interface asset is missing: ${asset.path}`);
    }
    if (hash(bytes) !== asset.sha256) {
      throw new Error(`Static interface asset does not match its manifest hash: ${asset.path}`);
    }
  }
  return manifest;
}

function selectedRunIdForUrl(url: URL) {
  const queryRunId = url.searchParams.get("run")?.trim();
  if (queryRunId) {
    return queryRunId;
  }
  const match = url.pathname.match(/^\/session\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }
  const candidate = decodeURIComponent(match[1] ?? "");
  return /^(?:[0-9a-f]{12}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(candidate)
    ? candidate
    : null;
}

function withSecurityHeaders(
  response: Response,
  securityHeaders: Headers,
) {
  const headers = new Headers(response.headers);
  securityHeaders.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function disabledInterface() {
  return {
    enabled: false,
    root: null,
    themeScriptSha256: null,
    async handle(request: Request) {
      const url = new URL(request.url);
      if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
        return null;
      }
      if (url.pathname !== "/") {
        return new Response("Not found", { status: 404 });
      }
      return new Response(
        "<!doctype html><title>OmniHarness Runner</title><p>The runner API is available, but no interface build is installed.</p>",
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    },
  } satisfies PreparedStaticInterface;
}

export async function prepareStaticInterface({
  staticDir,
  explicit,
  mode,
  buildBootstrap = async () => null,
}: {
  staticDir: string | null;
  explicit: boolean;
  mode: InterfaceSecurityMode;
  buildBootstrap?: StaticBootstrapBuilder;
}): Promise<PreparedStaticInterface> {
  if (!staticDir) {
    return disabledInterface();
  }
  const root = path.resolve(staticDir);
  let rootReal: string;
  try {
    rootReal = await fs.realpath(root);
  } catch {
    if (explicit) {
      throw new Error(`Static interface directory does not exist: ${root}`);
    }
    return disabledInterface();
  }
  let indexHtml: string;
  try {
    indexHtml = await fs.readFile(path.join(rootReal, "index.html"), "utf8");
  } catch {
    throw new Error("Static interface index.html is missing.");
  }
  const manifest = await validateManifest(rootReal, indexHtml);
  const securityHeaders = buildInterfaceSecurityHeaders({
    mode,
    themeScriptSha256: manifest.themeScriptSha256,
  });

  return {
    enabled: true,
    root: rootReal,
    themeScriptSha256: manifest.themeScriptSha256,
    async handle(request) {
      if (request.method !== "GET") {
        return null;
      }
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return null;
      }
      const responseSecurityHeaders = new Headers(securityHeaders);
      if (url.pathname === "/authorize-interface") {
        // The approval page is the cross-origin popup itself. `unsafe-none`
        // keeps its opener available long enough to post the one-time PKCE
        // result back; the main interface remains isolated with
        // `same-origin-allow-popups`.
        responseSecurityHeaders.set("cross-origin-opener-policy", "unsafe-none");
      }
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(url.pathname);
      } catch {
        return new Response("Bad request", { status: 400 });
      }
      const relative = decodedPath.replace(/^\/+/, "");
      const candidate = path.resolve(rootReal, relative || "index.html");
      if (candidate !== rootReal && !candidate.startsWith(`${rootReal}${path.sep}`)) {
        return new Response("Forbidden", { status: 403 });
      }

      let filePath = candidate;
      let fileExists = true;
      try {
        const realCandidate = await fs.realpath(candidate);
        if (
          realCandidate !== rootReal
          && !realCandidate.startsWith(`${rootReal}${path.sep}`)
        ) {
          return new Response("Forbidden", { status: 403 });
        }
        filePath = realCandidate;
      } catch {
        fileExists = false;
      }

      const isNavigation = !path.posix.extname(decodedPath);
      if (!fileExists && isNavigation) {
        filePath = path.join(rootReal, "index.html");
        fileExists = true;
      }
      if (!fileExists) {
        return withSecurityHeaders(
          new Response("Not found", { status: 404 }),
          responseSecurityHeaders,
        );
      }

      const extension = path.extname(filePath);
      if (extension === ".html" && path.basename(filePath) === "index.html") {
        const bootstrap = await buildBootstrap({
          request,
          selectedRunId: selectedRunIdForUrl(url),
        });
        const html = injectBootstrapHtml(indexHtml, bootstrap);
        return withSecurityHeaders(new Response(html, {
          headers: {
            "content-type": MIME_TYPES[".html"],
            "cache-control": "no-store",
          },
        }), responseSecurityHeaders);
      }

      const immutable = /(?:^|\/)assets\/[^/]+\.[a-z0-9]+$/i.test(
        path.relative(rootReal, filePath).replaceAll(path.sep, "/"),
      );
      const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
      return withSecurityHeaders(new Response(body, {
        headers: {
          "content-type": MIME_TYPES[extension] ?? "application/octet-stream",
          "cache-control": immutable
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        },
      }), responseSecurityHeaders);
    },
  };
}
