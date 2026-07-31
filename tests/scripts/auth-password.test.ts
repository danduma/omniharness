import { verify } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createClient } from "@libsql/client";

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

  it("accepts password files only when their mode is exactly 0600", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-password-file-"));
    const passwordFile = path.join(root, "password");
    fs.writeFileSync(passwordFile, "file-secret\n", { mode: 0o600 });
    expect(authPassword.readProtectedPasswordFile(passwordFile)).toBe("file-secret");

    fs.chmodSync(passwordFile, 0o640);
    expect(() => authPassword.readProtectedPasswordFile(passwordFile)).toThrow("0600");
  });

  it("defaults rotation to revoking sessions and requires an explicit keep override", () => {
    expect(authPassword.parseAuthPasswordArgs(["set", "--password-file", "/tmp/password"]))
      .toEqual(expect.objectContaining({
        command: "set",
        passwordFile: path.resolve("/tmp/password"),
        keepSessions: false,
      }));
    expect(authPassword.parseAuthPasswordArgs(["set", "--keep-sessions", "secret"]))
      .toEqual(expect.objectContaining({
        keepSessions: true,
      }));
  });

  it("revokes persisted sessions by default and audits the keep-sessions override", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-password-rotation-"));
    const client = createClient({ url: `file:${path.join(root, "sqlite.db")}` });
    await client.executeMultiple(`
      CREATE TABLE auth_sessions (
        id TEXT PRIMARY KEY,
        revoked_at INTEGER,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE auth_events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        pair_token_id TEXT,
        event_type TEXT NOT NULL,
        details TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO auth_sessions (id, revoked_at, updated_at)
      VALUES ('session-1', NULL, 1);
    `);
    await client.close();

    const revoked = await authPassword.recordPasswordRotation({ rootDir: root });
    expect(revoked.sessionCount).toBe(1);

    const check = createClient({ url: `file:${path.join(root, "sqlite.db")}` });
    const sessions = await check.execute("SELECT revoked_at FROM auth_sessions");
    expect(Number(sessions.rows[0]?.revoked_at)).toBeGreaterThan(0);
    const events = await check.execute("SELECT event_type, details FROM auth_events");
    expect(events.rows[0]?.event_type).toBe("auth.password_rotated");
    expect(JSON.parse(String(events.rows[0]?.details))).toEqual({
      keepSessions: false,
      revokedSessionCount: 1,
    });
    await check.close();
  });
});
