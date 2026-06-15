import fs from "fs";
import os from "os";
import path from "path";
import { EventEmitter } from "events";
import { pathToFileURL } from "url";
import { verify } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";

const setupAuth = await import(pathToFileURL(path.join(process.cwd(), "scripts/setup-auth.mjs")).href);

const ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-setup-auth-"));
}

function unescapeDotenvValue(value: string) {
  return value.replace(/\\\$/g, "$").replace(/\\\\/g, "\\");
}

describe("setup-auth bootstrap", () => {
  it("detects configured auth from process env or active .env lines", () => {
    expect(setupAuth.envTextHasConfiguredAuth("# OMNIHARNESS_AUTH_PASSWORD=ignored\n")).toBe(false);
    expect(setupAuth.envTextHasConfiguredAuth("OMNIHARNESS_AUTH_PASSWORD=\n")).toBe(false);
    expect(setupAuth.envTextHasConfiguredAuth("OMNIHARNESS_AUTH_PASSWORD=swordfish\n")).toBe(true);
    expect(setupAuth.envTextHasConfiguredAuth("export OMNIHARNESS_AUTH_PASSWORD=swordfish\n")).toBe(true);
    expect(setupAuth.envTextHasConfiguredAuth("OMNIHARNESS_AUTH_PASSWORD_HASH=\\$argon2id\\$hash\n")).toBe(true);
  });

  it("escapes dollar signs so Next dotenv expansion preserves Argon2 hashes", () => {
    expect(setupAuth.escapeEnvValueForDotenv("$argon2id$v=19$abc")).toBe("\\$argon2id\\$v=19\\$abc");
  });

  it("generates a password, stores only a hash, and prints the generated password once", async () => {
    const rootDir = tempRoot();
    const writes: string[] = [];
    const result = await setupAuth.ensureAuthConfig({
      rootDir,
      env: {},
      input: { isTTY: false },
      output: { write: (text: string) => writes.push(text) },
      generatedPassword: "generated-test-password",
    });

    const envText = fs.readFileSync(path.join(rootDir, ".env"), "utf8");
    expect(result.created).toBe(true);
    expect(result.generated).toBe(true);
    expect(envText).toContain("OMNIHARNESS_AUTH_PASSWORD_HASH=");
    expect(envText).not.toContain("generated-test-password");
    expect(writes.join("")).toContain("Password: generated-test-password");
    expect(writes.join("")).toContain("\u001b[1;31mPassword: generated-test-password\u001b[0m");

    const hashLine = envText.split(/\r?\n/g).find((line) => line.startsWith("OMNIHARNESS_AUTH_PASSWORD_HASH="));
    const storedHash = unescapeDotenvValue(hashLine!.split("=").slice(1).join("="));
    await expect(verify(storedHash, "generated-test-password", ARGON_OPTIONS)).resolves.toBe(true);
  });

  it("can defer the generated password notice to a protected launcher-owned file", async () => {
    const rootDir = tempRoot();
    const noticeFile = path.join(rootDir, "auth-notice.txt");
    const writes: string[] = [];
    const result = await setupAuth.ensureAuthConfig({
      rootDir,
      env: { OMNIHARNESS_AUTH_PASSWORD_NOTICE_FILE: noticeFile },
      input: { isTTY: false },
      output: { write: (text: string) => writes.push(text) },
      generatedPassword: "deferred-generated-password",
    });

    expect(result.created).toBe(true);
    expect(writes.join("")).not.toContain("deferred-generated-password");
    const notice = fs.readFileSync(noticeFile, "utf8");
    expect(notice).toContain("\u001b[1;31mPassword: deferred-generated-password\u001b[0m");
    expect(fs.statSync(noticeFile).mode & 0o777).toBe(0o600);
  });

  it("leaves an existing auth configuration untouched", async () => {
    const rootDir = tempRoot();
    const envPath = path.join(rootDir, ".env");
    fs.writeFileSync(envPath, "OMNIHARNESS_AUTH_PASSWORD=swordfish\n", "utf8");

    const result = await setupAuth.ensureAuthConfig({
      rootDir,
      env: {},
      input: { isTTY: false },
      output: { write: () => undefined },
      generatedPassword: "unused-generated-password",
    });

    expect(result.created).toBe(false);
    expect(fs.readFileSync(envPath, "utf8")).toBe("OMNIHARNESS_AUTH_PASSWORD=swordfish\n");
  });

  it("is idempotent after generating the first auth configuration", async () => {
    const rootDir = tempRoot();
    const output = { write: () => undefined };

    await setupAuth.ensureAuthConfig({
      rootDir,
      env: {},
      input: { isTTY: false },
      output,
      generatedPassword: "first-generated-password",
    });
    const firstEnvText = fs.readFileSync(path.join(rootDir, ".env"), "utf8");

    const second = await setupAuth.ensureAuthConfig({
      rootDir,
      env: {},
      input: { isTTY: false },
      output,
      generatedPassword: "second-generated-password",
    });
    const secondEnvText = fs.readFileSync(path.join(rootDir, ".env"), "utf8");

    expect(second.created).toBe(false);
    expect(secondEnvText).toBe(firstEnvText);
    expect(secondEnvText.match(/OMNIHARNESS_AUTH_PASSWORD_HASH=/g)).toHaveLength(1);
    expect(secondEnvText).not.toContain("second-generated-password");
  });

  it("pauses TTY stdin after accepting an interactive generated password", async () => {
    const rootDir = tempRoot();
    const writes: string[] = [];
    const rawModes: boolean[] = [];
    const input = Object.assign(new EventEmitter(), {
      isTTY: true,
      isRaw: false,
      paused: true,
      setEncoding: () => undefined,
      setRawMode: (value: boolean) => {
        rawModes.push(value);
        input.isRaw = value;
      },
      resume: () => {
        input.paused = false;
      },
      pause: () => {
        input.paused = true;
      },
    });

    const setupPromise = setupAuth.ensureAuthConfig({
      rootDir,
      env: {},
      input,
      output: {
        isTTY: true,
        write: (text: string) => writes.push(text),
      },
      generatedPassword: "interactive-generated-password",
    });

    input.emit("data", "\r");
    const result = await setupPromise;

    expect(result.created).toBe(true);
    expect(result.generated).toBe(true);
    expect(input.paused).toBe(true);
    expect(rawModes).toEqual([true, false]);
    expect(writes.join("")).toContain("Password: interactive-generated-password");
  });
});
