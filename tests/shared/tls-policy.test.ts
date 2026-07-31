import { describe, expect, it } from "vitest";
import { resolveNativeTlsPolicy } from "@/shared/tls-policy";

describe("native TLS trust policy", () => {
  it("uses standard platform trust without creating a pin", () => {
    expect(resolveNativeTlsPolicy({
      standardTrust: "trusted",
      presentedSpki: "sha256/standard",
      storedSpki: null,
    })).toEqual({
      decision: "allow-standard",
      requiresConfirmation: false,
    });
  });

  it("requires explicit fingerprint confirmation after standard trust fails", () => {
    expect(resolveNativeTlsPolicy({
      standardTrust: "untrusted",
      presentedSpki: "sha256/new",
      storedSpki: null,
    })).toEqual({
      decision: "confirm-pin",
      requiresConfirmation: true,
      presentedSpki: "sha256/new",
    });
  });

  it("allows a confirmed matching pin and requires explicit re-pin on change", () => {
    expect(resolveNativeTlsPolicy({
      standardTrust: "untrusted",
      presentedSpki: "sha256/stored",
      storedSpki: "sha256/stored",
    })).toMatchObject({ decision: "allow-pinned" });
    expect(resolveNativeTlsPolicy({
      standardTrust: "untrusted",
      presentedSpki: "sha256/changed",
      storedSpki: "sha256/stored",
    })).toEqual({
      decision: "pin-mismatch",
      requiresConfirmation: true,
      presentedSpki: "sha256/changed",
      storedSpki: "sha256/stored",
    });
  });
});
