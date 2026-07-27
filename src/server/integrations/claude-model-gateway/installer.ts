import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { delimiter, dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import {
  assertNoSymlinks,
  assertSafeArchiveEntries,
  ensureManagedDirectory,
  readOwnedJsonFile,
  resolveClaudeGatewayManagedPaths,
  writeOwnedJsonFile,
} from "./managed-files";

const execFileAsync = promisify(execFile);
const MAX_RELEASE_METADATA_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
export const CLIPROXY_RELEASES_API = "https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest";

export type CliProxyReleaseAsset = { name: string; url: string };
export type CliProxyRelease = { tagName: string; assets: CliProxyReleaseAsset[] };
export type InstalledCliProxyApi = { version: string; executable: string; source: "managed" | "system" };
type ManagedInstallRecord = { version: string; executable: string; sha256: string };

function platformAssetParts(platform: string, architecture: string) {
  const os = platform === "darwin" ? "darwin" : platform === "linux" ? "linux" : platform === "win32" ? "windows" : null;
  const arch = architecture === "arm64" ? "aarch64" : architecture === "x64" ? "amd64" : null;
  if (!os || !arch) throw new Error(`Unsupported CLIProxyAPI platform: ${platform}/${architecture}`);
  return { os, arch, extension: os === "windows" ? ".zip" : ".tar.gz" };
}

export function selectCliProxyReleaseAsset(release: CliProxyRelease, platform: string, architecture: string) {
  const { os, arch, extension } = platformAssetParts(platform, architecture);
  const archive = release.assets.find((asset) => (
    asset.name.includes(`_${os}_${arch}`)
    && asset.name.endsWith(extension)
    && !asset.name.includes("no-plugin")
  ));
  if (!archive) throw new Error(`CLIProxyAPI release ${release.tagName} has no asset for ${platform}/${architecture}.`);
  const checksums = release.assets.find((asset) => asset.name === "checksums.txt");
  if (!checksums) throw new Error(`CLIProxyAPI release ${release.tagName} does not include checksums.txt.`);
  return { archive, checksums };
}

export function parseCliProxyChecksums(content: string) {
  const result = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line.trim());
    if (match) result.set(match[2], match[1].toLowerCase());
  }
  return result;
}

export async function verifyFileSha256(filePath: string, expectedDigest: string) {
  const actual = await fileSha256(filePath);
  if (actual !== expectedDigest.toLowerCase()) {
    throw new Error(`CLIProxyAPI checksum mismatch: expected ${expectedDigest.toLowerCase()}, received ${actual}.`);
  }
}

async function fileSha256(filePath: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

export async function inspectCliProxyApiInstallation(homeDir: string): Promise<InstalledCliProxyApi | null> {
  const paths = resolveClaudeGatewayManagedPaths(homeDir);
  const current = await readOwnedJsonFile<{ version?: unknown; executable?: unknown; source?: unknown }>(paths.current, "current-install");
  if (typeof current?.version !== "string" || typeof current.executable !== "string" || !await executableIfPresent(current.executable)) {
    return null;
  }
  if (current.source === "system") {
    return { version: current.version, executable: current.executable, source: "system" };
  }
  const versionsRoot = `${resolve(paths.versions)}${sep}`;
  const executablePath = resolve(current.executable);
  const marker = await readOwnedJsonFile<ManagedInstallRecord>(join(dirname(executablePath), "install.json"), "managed-install");
  if (
    executablePath.startsWith(versionsRoot)
    && marker?.version === current.version
    && marker.executable === executablePath
    && /^[a-f0-9]{64}$/.test(marker.sha256)
    && await fileSha256(executablePath) === marker.sha256
  ) {
    return { version: current.version, executable: executablePath, source: "managed" };
  }
  return null;
}

async function boundedFetch(url: string, maxBytes: number, fetchImpl: typeof fetch, accept = "application/octet-stream") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept, "user-agent": "OmniHarness CLIProxyAPI installer" },
    });
    if (!response.ok) throw new Error(`CLIProxyAPI download failed with HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("CLIProxyAPI download exceeds the size limit.");
    const reader = response.body?.getReader();
    if (!reader) return Buffer.from(await response.arrayBuffer());
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("CLIProxyAPI download exceeds the size limit.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLatestCliProxyRelease(fetchImpl: typeof fetch = fetch): Promise<CliProxyRelease> {
  const content = await boundedFetch(CLIPROXY_RELEASES_API, MAX_RELEASE_METADATA_BYTES, fetchImpl, "application/vnd.github+json");
  const payload = JSON.parse(content.toString("utf8")) as {
    tag_name?: unknown;
    assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
  };
  if (typeof payload.tag_name !== "string" || !Array.isArray(payload.assets)) throw new Error("CLIProxyAPI release metadata is malformed.");
  return {
    tagName: payload.tag_name,
    assets: payload.assets.flatMap((asset) => (
      typeof asset.name === "string" && typeof asset.browser_download_url === "string"
        ? [{ name: asset.name, url: asset.browser_download_url }]
        : []
    )),
  };
}

async function executableIfPresent(candidate: string) {
  try {
    await access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export async function findCliProxyApiOnPath(pathValue = process.env.PATH ?? "") {
  const names = process.platform === "win32"
    ? ["cli-proxy-api.exe", "cliproxyapi.exe"]
    : ["cli-proxy-api", "cliproxyapi"];
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = await executableIfPresent(join(directory, name));
      if (candidate) return candidate;
    }
  }
  return null;
}

export function assertSafeTarListing(lines: string[]) {
  for (const line of lines) {
    const type = line.trimStart()[0];
    if (type === "l" || type === "h") {
      throw new Error(`Unsafe archive link: ${line.trim()}`);
    }
    if (type !== "-" && type !== "d") {
      throw new Error(`Unsafe archive entry type: ${line.trim()}`);
    }
  }
}

async function extractTar(archivePath: string, staging: string) {
  try {
    await execFileAsync("tar", ["--version"], { timeout: 2_000 });
  } catch {
    throw new Error("Unsupported platform: the tar executable is required to install CLIProxyAPI.");
  }
  const { stdout } = await execFileAsync("tar", ["-tzf", archivePath], { encoding: "utf8", timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
  const entries = stdout.split(/\r?\n/).filter(Boolean);
  assertSafeArchiveEntries(entries);
  const { stdout: verboseListing } = await execFileAsync("tar", ["-tvzf", archivePath], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assertSafeTarListing(verboseListing.split(/\r?\n/).filter(Boolean));
  await execFileAsync("tar", ["-xzf", archivePath, "-C", staging, "--no-same-owner"], { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 });
  await assertNoSymlinks(staging, entries);
  return entries;
}

async function extractZip(archivePath: string, staging: string) {
  const zip = new AdmZip(archivePath);
  const entries = zip.getEntries().map((entry) => entry.entryName);
  assertSafeArchiveEntries(entries);
  for (const entry of zip.getEntries()) {
    if ((entry.header.attr & 0o170000) === 0o120000) throw new Error(`Unsafe archive symlink: ${entry.entryName}`);
  }
  zip.extractAllTo(staging, true, false);
  await assertNoSymlinks(staging, entries.filter((entry) => !entry.endsWith("/")));
  return entries;
}

function normalizedVersion(tagName: string) {
  const version = tagName.trim().replace(/^v/i, "");
  if (!/^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) throw new Error(`Invalid CLIProxyAPI release tag: ${tagName}`);
  return version;
}

export async function installCliProxyApi(options: {
  homeDir: string;
  release?: CliProxyRelease;
  platform?: string;
  architecture?: string;
  fetchImpl?: typeof fetch;
  pathValue?: string;
}): Promise<InstalledCliProxyApi> {
  const paths = resolveClaudeGatewayManagedPaths(options.homeDir);
  const current = await inspectCliProxyApiInstallation(options.homeDir);
  if (current) return current;
  const systemExecutable = await findCliProxyApiOnPath(options.pathValue ?? process.env.PATH ?? "");
  if (systemExecutable) {
    const installed: InstalledCliProxyApi = { version: "system", executable: systemExecutable, source: "system" };
    await ensureManagedDirectory(paths.root);
    await writeOwnedJsonFile(paths.current, "current-install", installed);
    return installed;
  }
  const release = options.release ?? await fetchLatestCliProxyRelease(options.fetchImpl);
  const version = normalizedVersion(release.tagName);

  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  const { archive, checksums } = selectCliProxyReleaseAsset(release, platform, architecture);
  await ensureManagedDirectory(paths.root);
  await ensureManagedDirectory(paths.versions);
  const downloadDir = join(paths.root, `.install-${version}-${process.pid}`);
  await mkdir(downloadDir, { recursive: false, mode: 0o700 });
  const archivePath = join(downloadDir, archive.name);
  const staging = join(downloadDir, "staging");
  await mkdir(staging, { mode: 0o700 });
  try {
    const [archiveBytes, checksumBytes] = await Promise.all([
      boundedFetch(archive.url, MAX_ARCHIVE_BYTES, options.fetchImpl ?? fetch),
      boundedFetch(checksums.url, MAX_RELEASE_METADATA_BYTES, options.fetchImpl ?? fetch),
    ]);
    await writeFile(archivePath, archiveBytes, { mode: 0o600 });
    const expected = parseCliProxyChecksums(checksumBytes.toString("utf8")).get(archive.name);
    if (!expected) throw new Error(`checksums.txt does not contain ${archive.name}.`);
    await verifyFileSha256(archivePath, expected);
    if (archive.name.endsWith(".zip")) await extractZip(archivePath, staging);
    else await extractTar(archivePath, staging);

    const binaryName = platform === "win32" ? "cli-proxy-api.exe" : "cli-proxy-api";
    const extractedBinary = join(staging, binaryName);
    const binaryStat = await lstat(extractedBinary).catch(() => null);
    if (!binaryStat?.isFile() || binaryStat.isSymbolicLink()) throw new Error(`CLIProxyAPI archive does not contain ${binaryName}.`);
    await chmod(extractedBinary, 0o700);
    const extractedSha256 = await fileSha256(extractedBinary);
    const versionDir = join(paths.versions, version);
    const installedBinary = join(versionDir, binaryName);
    const existing = await executableIfPresent(installedBinary);
    if (existing) {
      const marker = await readOwnedJsonFile<ManagedInstallRecord>(join(versionDir, "install.json"), "managed-install");
      if (
        marker?.version !== version
        || marker.executable !== installedBinary
        || marker.sha256 !== extractedSha256
        || await fileSha256(installedBinary) !== extractedSha256
      ) {
        throw new Error(`Refusing to use ${installedBinary}: the existing installation is unverified or not owned by OmniHarness.`);
      }
    } else {
      const pendingVersionDir = join(downloadDir, "managed-version");
      const pendingBinary = join(pendingVersionDir, binaryName);
      await mkdir(pendingVersionDir, { recursive: false, mode: 0o700 });
      await copyFile(extractedBinary, pendingBinary);
      await chmod(pendingBinary, 0o700);
      await writeOwnedJsonFile(join(pendingVersionDir, "install.json"), "managed-install", {
        version,
        executable: installedBinary,
        sha256: extractedSha256,
      });
      await rename(pendingVersionDir, versionDir);
    }
    const installed: InstalledCliProxyApi = { version, executable: installedBinary, source: "managed" };
    await writeOwnedJsonFile(paths.current, "current-install", installed);
    return installed;
  } finally {
    await rm(downloadDir, { recursive: true, force: true });
  }
}
