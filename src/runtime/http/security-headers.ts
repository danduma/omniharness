export type InterfaceSecurityMode = "web" | "packaged";

export function buildInterfaceSecurityHeaders({
  mode,
  themeScriptSha256,
}: {
  mode: InterfaceSecurityMode;
  themeScriptSha256: string;
}) {
  const connectSource = mode === "packaged"
    ? "'none'"
    : "'self' http: https:";
  const headers = new Headers({
    "content-security-policy": [
      "default-src 'self'",
      `script-src 'self' 'sha256-${themeScriptSha256}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob:",
      `connect-src ${connectSource}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join("; "),
    "content-security-policy-report-only": [
      "require-trusted-types-for 'script'",
      "trusted-types omni",
    ].join("; "),
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    // Browser authorization intentionally opens a runner on another origin
    // and receives a one-time PKCE code through postMessage. This keeps the
    // opener relationship for that explicit popup without allowing arbitrary
    // cross-origin documents into the browsing context group.
    "cross-origin-opener-policy": "same-origin-allow-popups",
  });
  return headers;
}
