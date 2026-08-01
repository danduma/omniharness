import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/server/auth/guards";

describe("auth origin guard", () => {
  it("accepts localhost browser requests when the server is bound to 0.0.0.0", () => {
    const request = new Request("http://0.0.0.0:3050/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3050",
        origin: "http://localhost:3050",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("accepts forwarded public origins from a tunnel or reverse proxy", () => {
    process.env.OMNIHARNESS_TRUSTED_PROXIES = "0.0.0.0";
    const request = new Request("http://0.0.0.0:3050/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3050",
        origin: "https://example.ngrok-free.dev",
        "x-forwarded-host": "example.ngrok-free.dev",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
    delete process.env.OMNIHARNESS_TRUSTED_PROXIES;
  });

  it("accepts the configured HTTPS public origin behind an untrusted loopback tunnel", () => {
    process.env.OMNIHARNESS_PUBLIC_ORIGIN = "https://server.example.test/";
    const request = new Request("http://server.example.test/api/auth/login", {
      method: "POST",
      headers: {
        host: "server.example.test",
        origin: "https://server.example.test",
        "x-forwarded-host": "server.example.test",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
    delete process.env.OMNIHARNESS_PUBLIC_ORIGIN;
  });

  it("rejects requests from a different browser origin", () => {
    const request = new Request("http://0.0.0.0:3050/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3050",
        origin: "https://attacker.example",
      },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});
