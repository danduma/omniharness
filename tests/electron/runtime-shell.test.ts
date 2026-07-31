import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  electronPackagedCsp,
  resolveElectronAssetPath,
  resolveElectronInterfaceDir,
  resolveElectronRendererUrl,
} from "../../apps/electron/src/runtime";
import { handleElectronNativeCommand, isAllowedElectronSender } from "../../apps/electron/src/native-bridge";
import {
  importLegacyPreferenceExport,
  readLegacyPreferenceExport,
  writeLegacyPreferenceExport,
} from "../../apps/electron/src/legacy-preferences-migration";
import { ElectronCredentialStore } from "../../apps/electron/src/credential-store";
import { ElectronProfileDocumentStore } from "../../apps/electron/src/profile-store";
import { ElectronTlsPinStore } from "../../apps/electron/src/tls-pin-store";
import {
  BoundedElectronFrameQueue,
  ElectronRuntimeHost,
} from "../../apps/electron/src/runtime-bridge";

describe("Electron runtime shell", () => {
  it("is a remote-only host and never imports or starts the runner", () => {
    const mainSource = fs.readFileSync(
      path.resolve(process.cwd(), "apps/electron/main.ts"),
      "utf8",
    );
    const runtimeSource = fs.readFileSync(
      path.resolve(process.cwd(), "apps/electron/src/runtime.ts"),
      "utf8",
    );
    expect(`${mainSource}\n${runtimeSource}`).not.toMatch(
      /startOmniServer|createOmniRuntime|server\/runner|scripts\/runner/,
    );
    expect(mainSource).toContain("onBeforeRequest");
    expect(mainSource).toContain("safeStorage");
    expect(mainSource).toContain("session.fromPartition");
    expect(mainSource).toContain("tlsPinStore?.get(target.profileId)");
    expect(mainSource).not.toContain("findForHostname");
  });

  it("resolves an explicit renderer URL before the packaged app origin", () => {
    expect(resolveElectronRendererUrl({
      env: { OMNI_ELECTRON_RENDERER_URL: "http://localhost:3050" },
    })).toBe("http://localhost:3050");
    expect(resolveElectronRendererUrl({
      env: {},
    })).toBe("app://omniharness/index.html");
  });

  it("serves the one shared Vite interface artifact", () => {
    expect(resolveElectronInterfaceDir("/repo/apps/electron/dist")).toBe(
      path.resolve("/repo/dist/interface-packaged"),
    );
    expect(resolveElectronInterfaceDir(
      "/repo/apps/electron/dist",
      "/Applications/OmniHarness.app/Contents/Resources",
    )).toBe(
      "/Applications/OmniHarness.app/Contents/Resources/interface-packaged",
    );
    const buildSource = fs.readFileSync(
      path.resolve(process.cwd(), "apps/electron/scripts/build.mjs"),
      "utf8",
    );
    expect(buildSource).toContain("build:interface:packaged");
    expect(buildSource).not.toContain("rendererOutdir");
    expect(buildSource).not.toContain("renderer.js");
    expect(buildSource).not.toContain("writeFile(path.join(rendererOutdir");
  });

  it("locks packaged assets to app:// and connect-src self", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-assets-"));
    fs.writeFileSync(path.join(root, "csp-manifest.json"), JSON.stringify({
      themeScriptSha256: "abc123",
    }));
    expect(electronPackagedCsp(root)).toContain("connect-src 'self'");
    expect(resolveElectronAssetPath(
      root,
      "app://omniharness/assets/main.js",
    )).toBe(path.join(root, "assets/main.js"));
    expect(() => resolveElectronAssetPath(
      root,
      "app://omniharness/%2e%2e%2fsecret",
    )).toThrow(/escaped/);
    expect(() => resolveElectronAssetPath(
      root,
      "https://runner.example/index.html",
    )).toThrow(/untrusted/);
  });

  it("persists profiles atomically and credentials only through safe storage", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-store-"));
    const profiles = new ElectronProfileDocumentStore(path.join(root, "profiles.json"));
    profiles.set('{"schemaVersion":1}');
    expect(profiles.get()).toBe('{"schemaVersion":1}');

    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
      decryptString: (value: Buffer) => value.toString().replace("encrypted:", ""),
    };
    const credentials = new ElectronCredentialStore(
      path.join(root, "credentials.json"),
      safeStorage,
    );
    const handle = credentials.save({
      profileId: "profile-1",
      origin: "https://runner.example",
      runnerInstanceId: null,
      token: "native-secret",
    });
    expect(fs.readFileSync(path.join(root, "credentials.json"), "utf8"))
      .not.toContain("native-secret");
    expect(credentials.useCredential(handle, {
      profileId: "profile-1",
      origin: "https://runner.example",
      runnerInstanceId: null,
    }, (token) => token)).toBe("native-secret");
  });

  it("keeps tokens session-only when OS encryption is unavailable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-store-"));
    const credentials = new ElectronCredentialStore(
      path.join(root, "credentials.json"),
      {
        isEncryptionAvailable: () => false,
        encryptString: () => {
          throw new Error("must not encrypt");
        },
        decryptString: () => {
          throw new Error("must not decrypt");
        },
      },
    );
    credentials.save({
      profileId: "profile-1",
      origin: "https://runner.example",
      runnerInstanceId: null,
      token: "session-secret",
    });
    expect(fs.existsSync(path.join(root, "credentials.json"))).toBe(false);
    expect(credentials.getRecoveryNoticeCode()).toBe(
      "runner.credentials.sessionOnly",
    );
  });

  it("validates native login, keeps the token in the host, and attaches it to requests", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-host-"));
    const credentials = new ElectronCredentialStore(
      path.join(root, "credentials.json"),
      {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString(),
      },
    );
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const host = new ElectronRuntimeHost({
      credentials,
      fetchImpl: vi.fn(async (input, init) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization"),
        });
        if (String(input).endsWith("/api/auth/login")) {
          return Response.json({
            token: "host-only-token",
            sessionId: "session-1",
            expiresAt: "2026-08-01T00:00:00.000Z",
          });
        }
        return Response.json({ ok: true });
      }),
      postFrame: vi.fn(),
    });
    const target = {
      profileId: "profile-1",
      baseUrl: "https://runner.example",
      credentialRef: null,
      runnerInstanceId: null,
    };
    const login = await host.handle({
      id: "1",
      type: "auth:native",
      target,
      payload: { password: "shared-password" },
    });
    expect(JSON.stringify(login)).not.toContain("host-only-token");
    const credentialRef = (login.data as { credentialRef: string }).credentialRef;
    await host.handle({
      id: "2",
      type: "api:proxy",
      target: { ...target, credentialRef },
      payload: { method: "GET", path: "/api/settings" },
    });
    expect(requests.at(-1)?.authorization).toBe("Bearer host-only-token");
  });

  it("bounds renderer stream delivery and requires explicit SPKI re-pinning", () => {
    const sent: unknown[] = [];
    const overflow = vi.fn();
    const queue = new BoundedElectronFrameQueue(
      (frame) => sent.push(frame),
      1,
      100,
      overflow,
    );
    expect(queue.push({ frame: 1 })).toBe(true);
    expect(queue.push({ frame: 2 })).toBe(false);
    expect(overflow).toHaveBeenCalledOnce();

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-pin-"));
    const pins = new ElectronTlsPinStore(path.join(root, "pins.json"));
    pins.confirm(
      "profile-1",
      "https://runner.example",
      `sha256/${Buffer.alloc(32, 1).toString("base64")}`,
    );
    expect(pins.get("profile-1")?.origin).toBe("https://runner.example");
    expect(() => pins.confirm(
      "profile-1",
      "https://runner.example",
      "not-a-fingerprint",
    )).toThrow(/SPKI/);
  });

  it("exports legacy local preferences atomically and idempotently", async () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-migration-"));
    const payload = {
      schemaVersion: 1 as const,
      exportedAt: "2026-07-31T00:00:00.000Z",
      sourceOrigin: "http://127.0.0.1:4000",
      entries: {
        "omni-theme-mode": "night",
        "omni-composer-mode": "direct",
      },
    };

    const first = await writeLegacyPreferenceExport({ userDataPath, payload });
    const second = await writeLegacyPreferenceExport({
      userDataPath,
      payload: {
        ...payload,
        exportedAt: "2026-07-31T00:01:00.000Z",
      },
    });
    expect(second).toEqual(first);
    await expect(readLegacyPreferenceExport(userDataPath)).resolves.toEqual(payload);
    expect(fs.readdirSync(userDataPath).some((name) => name.includes(".tmp-"))).toBe(false);
  });

  it("replaces a corrupt legacy preference export on retry", async () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-migration-"));
    fs.writeFileSync(
      path.join(userDataPath, "interface-origin-migration.v1.json"),
      "{broken",
    );
    await expect(readLegacyPreferenceExport(userDataPath)).rejects.toThrow(
      "not valid JSON",
    );

    const payload = {
      schemaVersion: 1 as const,
      exportedAt: "2026-07-31T00:00:00.000Z",
      sourceOrigin: "http://127.0.0.1:4000",
      entries: { "omni-ui-font-size": "large" },
    };
    await writeLegacyPreferenceExport({ userDataPath, payload });
    await expect(readLegacyPreferenceExport(userDataPath)).resolves.toEqual(payload);
  });

  it("imports the legacy origin as an explicit remote profile and rolls back failed writes", async () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-migration-"));
    await writeLegacyPreferenceExport({
      userDataPath,
      payload: {
        schemaVersion: 1,
        exportedAt: "2026-07-31T00:00:00.000Z",
        sourceOrigin: "http://127.0.0.1:3050",
        entries: { "omni-theme-mode": "night" },
      },
    });
    let profiles: string | null = null;
    await expect(importLegacyPreferenceExport({
      userDataPath,
      readCurrentProfiles: () => profiles,
      writeProfiles: (value) => {
        profiles = value;
      },
      removeProfiles: () => {
        profiles = null;
      },
    })).resolves.toEqual({
      status: "imported",
      profileId: "electron-legacy-local",
    });
    expect(JSON.parse(profiles!).profiles[0]).toEqual(expect.objectContaining({
      id: "electron-legacy-local",
      baseUrl: "http://127.0.0.1:3050",
      isSameOrigin: false,
    }));

    const failedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-electron-migration-"));
    await writeLegacyPreferenceExport({
      userDataPath: failedRoot,
      payload: {
        schemaVersion: 1,
        exportedAt: "2026-07-31T00:00:00.000Z",
        sourceOrigin: "http://127.0.0.1:3050",
        entries: {},
      },
    });
    let rollbackValue: string | null = null;
    await expect(importLegacyPreferenceExport({
      userDataPath: failedRoot,
      readCurrentProfiles: () => rollbackValue,
      writeProfiles: () => {
        throw new Error("disk full");
      },
      removeProfiles: () => {
        rollbackValue = null;
      },
    })).rejects.toThrow("disk full");
    expect(rollbackValue).toBeNull();
  });

  it("allows native commands only from the runtime origin", async () => {
    expect(isAllowedElectronSender("http://127.0.0.1:4000/app", "http://127.0.0.1:4000")).toBe(true);
    expect(isAllowedElectronSender("https://example.com/app", "http://127.0.0.1:4000")).toBe(false);

    const openExternal = vi.fn(async () => ({ ok: true as const }));
    await expect(handleElectronNativeCommand({
      command: "openExternal",
      payload: { url: "https://example.com" },
    }, {
      runtimeOrigin: "http://127.0.0.1:4000",
      senderUrl: "http://127.0.0.1:4000/app",
      openExternal,
    })).resolves.toEqual({ ok: true });
    expect(openExternal).toHaveBeenCalledWith({ url: "https://example.com" });

    await expect(handleElectronNativeCommand({
      command: "openExternal",
      payload: { url: "https://example.com" },
    }, {
      runtimeOrigin: "http://127.0.0.1:4000",
      senderUrl: "https://example.com/app",
      openExternal,
    })).rejects.toThrow("untrusted origin");
  });

  it("refuses unsafe native external URL schemes", async () => {
    const openExternal = vi.fn(async () => ({ ok: true as const }));

    await expect(handleElectronNativeCommand({
      command: "openExternal",
      payload: { url: "file:///etc/passwd" },
    }, {
      runtimeOrigin: "http://127.0.0.1:4000",
      senderUrl: "http://127.0.0.1:4000/app",
      openExternal,
    })).rejects.toThrow("http and https");

    expect(openExternal).not.toHaveBeenCalled();
  });
});
