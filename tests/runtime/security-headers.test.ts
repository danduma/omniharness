import { describe, expect, it } from "vitest";
import { buildInterfaceSecurityHeaders } from "@/runtime/http/security-headers";

describe("interface security headers", () => {
  it("builds a web CSP with no third-party script source and hardened framing/referrer rules", () => {
    const headers = buildInterfaceSecurityHeaders({
      mode: "web",
      themeScriptSha256: "abc123",
    });
    const csp = headers.get("content-security-policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'sha256-abc123'");
    expect(csp).toContain("connect-src 'self' http: https:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toContain("bugdrop");
    expect(csp).not.toContain("*");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("cross-origin-opener-policy")).toBe(
      "same-origin-allow-popups",
    );
    expect(headers.get("content-security-policy-report-only")).toContain("require-trusted-types-for 'script'");
  });

  it("blocks direct runner networking in packaged mode", () => {
    const headers = buildInterfaceSecurityHeaders({
      mode: "packaged",
      themeScriptSha256: "abc123",
    });
    expect(headers.get("content-security-policy")).toContain("connect-src 'none'");
  });
});
