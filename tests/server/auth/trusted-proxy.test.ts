import { describe, expect, it } from "vitest";
import {
  isSecureOrLoopbackRequest,
  resolveRequestNetworkIdentity,
} from "@/server/auth/trusted-proxy";

describe("trusted proxy request identity", () => {
  it("ignores forwarding headers from an untrusted socket peer", () => {
    expect(resolveRequestNetworkIdentity({
      url: "http://runner.example/api/auth/login",
      headers: new Headers({
        forwarded: "for=198.51.100.20;proto=https",
        "x-forwarded-for": "198.51.100.20",
        "x-forwarded-proto": "https",
      }),
      socketAddress: "203.0.113.9",
      socketEncrypted: false,
      trustedProxyRules: ["127.0.0.1/32"],
    })).toMatchObject({
      clientAddress: "203.0.113.9",
      protocol: "http",
      forwarded: false,
    });
  });

  it("uses forwarding headers only through an explicitly trusted proxy", () => {
    expect(resolveRequestNetworkIdentity({
      url: "http://runner.example/api/auth/login",
      headers: new Headers({
        forwarded: "for=198.51.100.20;proto=https",
      }),
      socketAddress: "127.0.0.1",
      socketEncrypted: false,
      trustedProxyRules: ["127.0.0.1/32"],
    })).toMatchObject({
      clientAddress: "198.51.100.20",
      protocol: "https",
      forwarded: true,
    });
  });

  it("allows loopback HTTP but refuses plaintext non-loopback clients", () => {
    expect(isSecureOrLoopbackRequest({
      clientAddress: "127.0.0.1",
      protocol: "http",
      forwarded: false,
    })).toBe(true);
    expect(isSecureOrLoopbackRequest({
      clientAddress: "192.168.1.10",
      protocol: "http",
      forwarded: false,
    })).toBe(false);
    expect(isSecureOrLoopbackRequest({
      clientAddress: "192.168.1.10",
      protocol: "https",
      forwarded: true,
    })).toBe(true);
  });
});
