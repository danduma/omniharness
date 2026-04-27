import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/server/auth/guards";

describe("auth origin guard", () => {
  it("accepts localhost browser requests when the server is bound to 0.0.0.0", () => {
    const request = new NextRequest("http://0.0.0.0:3050/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3050",
        origin: "http://localhost:3050",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("accepts forwarded public origins from a tunnel or reverse proxy", () => {
    const request = new NextRequest("http://0.0.0.0:3050/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3050",
        origin: "https://example.ngrok-free.dev",
        "x-forwarded-host": "example.ngrok-free.dev",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects requests from a different browser origin", () => {
    const request = new NextRequest("http://0.0.0.0:3050/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3050",
        origin: "https://attacker.example",
      },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});
