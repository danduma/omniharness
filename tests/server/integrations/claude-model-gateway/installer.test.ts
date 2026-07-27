import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import {
  installCliProxyApi,
  inspectCliProxyApiInstallation,
  assertSafeTarListing,
  fetchLatestCliProxyRelease,
  parseCliProxyChecksums,
  selectCliProxyReleaseAsset,
  verifyFileSha256,
  type CliProxyRelease,
} from "@/server/integrations/claude-model-gateway/installer";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "omni-gateway-installer-"));
  temporaryRoots.push(root);
  return root;
}

function releaseFixture(names: string[]): CliProxyRelease {
  return {
    tagName: "v7.2.71",
    assets: names.map((name) => ({ name, url: `https://example.invalid/${name}` })),
  };
}

describe("CLIProxyAPI release selection", () => {
  test("requests GitHub release metadata as JSON", async () => {
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("accept")).toContain("github+json");
      return Response.json({ tag_name: "v7.2.71", assets: [] });
    }) as typeof fetch;
    await expect(fetchLatestCliProxyRelease(fetchImpl)).resolves.toEqual({ tagName: "v7.2.71", assets: [] });
  });

  const release = releaseFixture([
    "checksums.txt",
    "CLIProxyAPI_7.2.71_darwin_aarch64.tar.gz",
    "CLIProxyAPI_7.2.71_darwin_amd64.tar.gz",
    "CLIProxyAPI_7.2.71_linux_aarch64.tar.gz",
    "CLIProxyAPI_7.2.71_linux_amd64.tar.gz",
    "CLIProxyAPI_7.2.71_windows_aarch64.zip",
    "CLIProxyAPI_7.2.71_windows_amd64.zip",
  ]);

  test.each([
    ["darwin", "arm64", "CLIProxyAPI_7.2.71_darwin_aarch64.tar.gz"],
    ["darwin", "x64", "CLIProxyAPI_7.2.71_darwin_amd64.tar.gz"],
    ["linux", "arm64", "CLIProxyAPI_7.2.71_linux_aarch64.tar.gz"],
    ["linux", "x64", "CLIProxyAPI_7.2.71_linux_amd64.tar.gz"],
    ["win32", "arm64", "CLIProxyAPI_7.2.71_windows_aarch64.zip"],
    ["win32", "x64", "CLIProxyAPI_7.2.71_windows_amd64.zip"],
  ])("selects %s/%s asset", (platform, architecture, expected) => {
    expect(selectCliProxyReleaseAsset(release, platform, architecture).archive.name).toBe(expected);
  });

  test("rejects unsupported platforms and missing checksum assets", () => {
    expect(() => selectCliProxyReleaseAsset(release, "freebsd", "x64")).toThrow(/unsupported/i);
    expect(() => selectCliProxyReleaseAsset(releaseFixture(["CLIProxyAPI_7.2.71_linux_amd64.tar.gz"]), "linux", "x64"))
      .toThrow(/checksums/i);
  });
});

describe("CLIProxyAPI checksum verification", () => {
  test("parses the official checksum format and detects mismatches", async () => {
    const root = await temporaryRoot();
    const file = join(root, "asset.tar.gz");
    await writeFile(file, "verified bytes", "utf8");
    const digest = createHash("sha256").update("verified bytes").digest("hex");
    expect(parseCliProxyChecksums(`${digest}  asset.tar.gz\n`).get("asset.tar.gz")).toBe(digest);
    await expect(verifyFileSha256(file, digest)).resolves.toBeUndefined();
    await expect(verifyFileSha256(file, "0".repeat(64))).rejects.toThrow(/checksum mismatch/i);
  });
});

describe("CLIProxyAPI tar safety", () => {
  test("rejects links and special files before extraction", () => {
    expect(() => assertSafeTarListing([
      "-rwxr-xr-x  0 user group 123 Jul 13 10:00 cli-proxy-api",
      "drwx------  0 user group   0 Jul 13 10:00 docs/",
    ])).not.toThrow();
    expect(() => assertSafeTarListing([
      "lrwxr-xr-x  0 user group 0 Jul 13 10:00 cli-proxy-api -> /tmp/escape",
    ])).toThrow(/unsafe archive link/i);
    expect(() => assertSafeTarListing([
      "hrwxr-xr-x  0 user group 0 Jul 13 10:00 cli-proxy-api link to outside",
    ])).toThrow(/unsafe archive link/i);
    expect(() => assertSafeTarListing([
      "prw-------  0 user group 0 Jul 13 10:00 pipe",
    ])).toThrow(/unsafe archive entry type/i);
  });
});

describe("CLIProxyAPI installation", () => {
  test("adopts a supported system binary before doing network work", async () => {
    const root = await temporaryRoot();
    const bin = join(root, "bin");
    await mkdir(bin);
    const executable = join(bin, "cliproxyapi");
    await writeFile(executable, "fixture executable", { mode: 0o700 });
    const fetchImpl = (() => { throw new Error("network should not be called"); }) as typeof fetch;
    await expect(installCliProxyApi({ homeDir: root, pathValue: bin, fetchImpl })).resolves.toEqual({
      version: "system",
      executable,
      source: "system",
    });
  });

  test("downloads, verifies, safely extracts, and reuses an installed version", async () => {
    const root = await temporaryRoot();
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "cli-proxy-api"), "fixture executable", "utf8");
    const archiveName = "CLIProxyAPI_7.2.71_darwin_aarch64.tar.gz";
    const archivePath = join(root, archiveName);
    await execFileAsync("tar", ["-czf", archivePath, "-C", source, "cli-proxy-api"]);
    const archive = await readFile(archivePath);
    const digest = createHash("sha256").update(archive).digest("hex");
    const checksums = `${digest}  ${archiveName}\n`;

    const server = createServer((request, response) => {
      if (request.url === `/${archiveName}`) response.end(archive);
      else if (request.url === "/checksums.txt") response.end(checksums);
      else { response.statusCode = 404; response.end(); }
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture server failed");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const release: CliProxyRelease = {
      tagName: "v7.2.71",
      assets: [
        { name: archiveName, url: `${baseUrl}/${archiveName}` },
        { name: "checksums.txt", url: `${baseUrl}/checksums.txt` },
      ],
    };

    const first = await installCliProxyApi({ homeDir: root, release, platform: "darwin", architecture: "arm64" });
    expect(first.version).toBe("7.2.71");
    expect(await readFile(first.executable, "utf8")).toBe("fixture executable");
    expect((await stat(first.executable)).mode & 0o111).not.toBe(0);

    server.close();
    servers.splice(servers.indexOf(server), 1);
    const second = await installCliProxyApi({ homeDir: root, release, platform: "darwin", architecture: "arm64" });
    expect(second).toEqual(first);
    await writeFile(second.executable, "tampered executable", "utf8");
    await expect(inspectCliProxyApiInstallation(root)).resolves.toBeNull();
  });

  test("refuses to trust a pre-existing version binary without a verified ownership record", async () => {
    const root = await temporaryRoot();
    const versionDir = join(root, ".omniharness", "cliproxyapi", "versions", "7.2.71");
    await mkdir(versionDir, { recursive: true });
    await writeFile(join(versionDir, "cli-proxy-api"), "untrusted executable", { mode: 0o700 });

    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "cli-proxy-api"), "verified executable", "utf8");
    const archiveName = "CLIProxyAPI_7.2.71_darwin_aarch64.tar.gz";
    const archivePath = join(root, archiveName);
    await execFileAsync("tar", ["-czf", archivePath, "-C", source, "cli-proxy-api"]);
    const archive = await readFile(archivePath);
    const digest = createHash("sha256").update(archive).digest("hex");
    const release: CliProxyRelease = {
      tagName: "v7.2.71",
      assets: [
        { name: archiveName, url: "https://fixture.invalid/archive" },
        { name: "checksums.txt", url: "https://fixture.invalid/checksums" },
      ],
    };
    const fetchImpl = (async (url: string | URL | Request) => (
      String(url).endsWith("checksums")
        ? new Response(`${digest}  ${archiveName}\n`)
        : new Response(archive)
    )) as typeof fetch;

    await expect(installCliProxyApi({
      homeDir: root,
      release,
      platform: "darwin",
      architecture: "arm64",
      fetchImpl,
      pathValue: "",
    })).rejects.toThrow(/not owned|unverified/i);
    expect(await readFile(join(versionDir, "cli-proxy-api"), "utf8")).toBe("untrusted executable");
  });
});
