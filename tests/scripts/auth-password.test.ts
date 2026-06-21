import { verify } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import path from "node:path";

const authPassword = await import(pathToFileURL(path.join(process.cwd(), "scripts/auth-password.mjs")).href);

const ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

function unescapeDotenvValue(value: string) {
  return value.replace(/\\\$/g, "$").replace(/\\\\/g, "\\");
}

describe("auth password command helpers", () => {
  it("explains that hash-only passwords cannot be revealed", () => {
    const summary = authPassword.inspectAuthConfig("OMNIHARNESS_AUTH_PASSWORD_HASH=\\$argon2id\\$hash\n");

    expect(summary.configured).toBe(true);
    expect(summary.effectiveSource).toBe("hash");
    expect(summary.revealablePassword).toBe(null);
    expect(authPassword.formatAuthStatus(summary)).toContain("hash-only; original password cannot be shown");
  });

  it("reveals plaintext only when plaintext auth is configured", () => {
    const summary = authPassword.inspectAuthConfig("OMNIHARNESS_AUTH_PASSWORD=swordfish\n");

    expect(summary.configured).toBe(true);
    expect(summary.effectiveSource).toBe("password");
    expect(summary.revealablePassword).toBe("swordfish");
    expect(authPassword.formatAuthStatus(summary)).toContain("Current password: swordfish");
  });

  it("replaces active auth lines with one escaped hash", async () => {
    const result = await authPassword.updateEnvTextWithPassword([
      "OMNIHARNESS_AUTH_PASSWORD=old-password",
      "OMNIHARNESS_AUTH_PASSWORD_HASH=old-hash",
      "OMNIHARNESS_PUBLIC_ORIGIN=https://example.test",
      "",
    ].join("\n"), "new-password");

    expect(result.envText).not.toContain("OMNIHARNESS_AUTH_PASSWORD=old-password");
    expect(result.envText).not.toContain("OMNIHARNESS_AUTH_PASSWORD_HASH=old-hash");
    expect(result.envText).toContain("OMNIHARNESS_PUBLIC_ORIGIN=https://example.test");

    const hashLine = result.envText.split(/\r?\n/g).find((line: string) => line.startsWith("OMNIHARNESS_AUTH_PASSWORD_HASH="));
    expect(hashLine).toBeTruthy();
    expect(hashLine).toContain("\\$argon2id\\$");
    await expect(verify(unescapeDotenvValue(hashLine!.split("=").slice(1).join("=")), "new-password", ARGON_OPTIONS)).resolves.toBe(true);
  });

  it("verifies configured plaintext and hash passwords", async () => {
    const updated = await authPassword.updateEnvTextWithPassword("", "hashed-password");

    await expect(authPassword.verifyPasswordAgainstEnvText("OMNIHARNESS_AUTH_PASSWORD=plain-password\n", "plain-password")).resolves.toBe(true);
    await expect(authPassword.verifyPasswordAgainstEnvText("OMNIHARNESS_AUTH_PASSWORD=plain-password\n", "wrong")).resolves.toBe(false);
    await expect(authPassword.verifyPasswordAgainstEnvText(updated.envText, "hashed-password")).resolves.toBe(true);
    await expect(authPassword.verifyPasswordAgainstEnvText(updated.envText, "wrong")).resolves.toBe(false);
  });
});
