import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  assertSafeArchiveEntries,
  ensureManagedDirectory,
  resolveClaudeGatewayManagedPaths,
  writeOwnedTextFile,
} from "@/server/integrations/claude-model-gateway/managed-files";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "omni-gateway-files-"));
  temporaryRoots.push(root);
  return root;
}

describe("managed Claude gateway files", () => {
  test("keeps binaries, configuration, auth, logs, and pid metadata under the supplied home", async () => {
    const root = await temporaryRoot();
    expect(resolveClaudeGatewayManagedPaths(root)).toEqual({
      root: join(root, ".omniharness", "cliproxyapi"),
      versions: join(root, ".omniharness", "cliproxyapi", "versions"),
      config: join(root, ".omniharness", "cliproxyapi", "managed-config.yaml"),
      auth: join(root, ".omniharness", "cliproxyapi", "auth"),
      process: join(root, ".omniharness", "cliproxyapi", "process.json"),
      logs: join(root, ".omniharness", "cliproxyapi", "logs"),
      current: join(root, ".omniharness", "cliproxyapi", "current.json"),
    });
  });

  test("creates credential directories as 0700 and owned files as 0600", async () => {
    const root = await temporaryRoot();
    const directory = join(root, "auth");
    const file = join(root, "managed-config.yaml");
    await ensureManagedDirectory(directory);
    await writeOwnedTextFile(file, "port: 8317\n", "config");

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readFile(file, "utf8")).toBe("# omniharness-managed: config\nport: 8317\n");
  });

  test("refuses to replace an unknown file", async () => {
    const root = await temporaryRoot();
    const file = join(root, "managed-config.yaml");
    await writeFile(file, "user-owned: true\n", "utf8");

    await expect(writeOwnedTextFile(file, "port: 8317\n", "config")).rejects.toThrow(/not owned by OmniHarness/i);
    expect(await readFile(file, "utf8")).toBe("user-owned: true\n");
  });

  test.each([
    ["../escape", "parent traversal"],
    ["/absolute", "absolute path"],
    ["safe/../../escape", "nested traversal"],
    ["C:\\absolute.exe", "Windows absolute path"],
  ])("rejects unsafe archive entry %s (%s)", (entry) => {
    expect(() => assertSafeArchiveEntries([entry])).toThrow(/unsafe archive entry/i);
  });

  test("accepts the official flat archive layout", () => {
    expect(() => assertSafeArchiveEntries([
      "cli-proxy-api",
      "LICENSE",
      "README.md",
      "config.example.yaml",
    ])).not.toThrow();
  });
});
