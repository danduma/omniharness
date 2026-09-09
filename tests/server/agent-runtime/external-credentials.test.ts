import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { resolveCredentialProfile, resolveCredentialProfilesDir } from "@/server/agent-runtime/external-credentials";

function createProfilesDir() {
  return mkdtempSync(join(tmpdir(), "omni-external-credentials-"));
}

function writeProviderProfile(profilesDir: string, name: string, script: string) {
  const profileDir = join(profilesDir, name);
  mkdirSync(profileDir, { recursive: true });
  const provider = join(profileDir, "provider");
  writeFileSync(provider, script);
  chmodSync(provider, 0o755);
  writeFileSync(join(profileDir, "profile.json"), JSON.stringify({ command: provider, timeoutMs: 5_000 }));
  return profileDir;
}

function resolve(profilesDir: string, type: string) {
  return resolveCredentialProfile({
    type,
    cwd: profilesDir,
    env: { OMNIHARNESS_CREDENTIAL_PROFILES_DIR: profilesDir, PATH: process.env.PATH },
  });
}

describe("credential provider failures", () => {
  it("reports the exit code and the provider's own stderr", async () => {
    const profilesDir = createProfilesDir();
    writeProviderProfile(profilesDir, "claude", `#!/usr/bin/env node
process.stderr.write('Runner auth refresh failed (401): {"error":"invalid_refresh_token"}\\n');
process.exit(1);
`);

    await expect(resolve(profilesDir, "claude")).rejects.toThrow(
      'Credential profile "claude" provider command failed (exit 1). Runner auth refresh failed (401): {"error":"invalid_refresh_token"}',
    );
  });

  it("redacts secrets the provider prints to stderr", async () => {
    const profilesDir = createProfilesDir();
    writeProviderProfile(profilesDir, "claude", `#!/usr/bin/env node
process.stderr.write('rejected ANTHROPIC_AUTH_TOKEN=sk-ant-live-not-a-real-secret\\n');
process.exit(2);
`);

    const error = await resolve(profilesDir, "claude").catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("(exit 2)");
    expect((error as Error).message).toContain("ANTHROPIC_AUTH_TOKEN=[REDACTED]");
    expect((error as Error).message).not.toContain("sk-ant-live-not-a-real-secret");
  });

  it("names a provider command that is not on disk", async () => {
    const profilesDir = createProfilesDir();
    const profileDir = join(profilesDir, "claude");
    mkdirSync(profileDir, { recursive: true });
    const missing = join(profileDir, "does-not-exist");
    writeFileSync(join(profileDir, "profile.json"), JSON.stringify({ command: missing }));

    await expect(resolve(profilesDir, "claude")).rejects.toThrow(`command not found: ${missing}`);
  });
});

describe("resolveCredentialProfilesDir", () => {
  it("defaults to the app root when no directory is configured", () => {
    expect(resolveCredentialProfilesDir({ OMNIHARNESS_ROOT: "/srv/omni" }, "/anywhere"))
      .toBe("/srv/omni/.omniharness/credential-profiles");
    expect(resolveCredentialProfilesDir({ OMNIHARNESS_ROOT: "/srv/omni", OMNIHARNESS_CREDENTIAL_PROFILES_DIR: "  " }, "/anywhere"))
      .toBe("/srv/omni/.omniharness/credential-profiles");
  });

  it("resolves a configured directory, relative to the given cwd", () => {
    expect(resolveCredentialProfilesDir({ OMNIHARNESS_CREDENTIAL_PROFILES_DIR: "/etc/omni-profiles" }, "/anywhere"))
      .toBe("/etc/omni-profiles");
    expect(resolveCredentialProfilesDir({ OMNIHARNESS_CREDENTIAL_PROFILES_DIR: "profiles" }, "/anywhere"))
      .toBe("/anywhere/profiles");
    expect(resolveCredentialProfilesDir({ OMNIHARNESS_CREDENTIAL_PROFILES_DIR: "~/profiles", HOME: "/home/omni" }, "/anywhere"))
      .toBe("/home/omni/profiles");
  });
});
