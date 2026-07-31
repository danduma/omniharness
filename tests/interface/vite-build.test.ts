import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");

function buildInterface(script: "build:interface:web" | "build:interface:packaged") {
  execFileSync("pnpm", [script], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "pipe",
  });
}

function readArtifact(relativePath: string) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function collectTextArtifacts(root: string): string {
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:css|html|js|json|map)$/.test(entry.name))
    .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"))
    .join("\n");
}

describe.sequential("Vite interface build", () => {
  it("builds the browser interface with both mountable HTML entry points", () => {
    buildInterface("build:interface:web");

    const indexHtml = readArtifact("dist/interface/index.html");
    const appShellHtml = readArtifact("dist/interface/app-shell.html");
    expect(indexHtml).toContain('id="root"');
    expect(appShellHtml).toContain('id="root"');
    expect(indexHtml).toMatch(/assets\/[^"]+\.js/);
    expect(appShellHtml).toMatch(/assets\/[^"]+\.js/);
  }, 60_000);

  it("builds a packaged interface whose asset paths work outside an HTTP root", () => {
    buildInterface("build:interface:packaged");

    const indexHtml = readArtifact("dist/interface-packaged/index.html");
    const appShellHtml = readArtifact("dist/interface-packaged/app-shell.html");
    expect(indexHtml).toContain('id="root"');
    expect(appShellHtml).toContain('id="root"');
    expect(indexHtml).toMatch(/(?:src|href)="\.\/assets\//);
    expect(appShellHtml).toMatch(/(?:src|href)="\.\/assets\//);
  }, 60_000);

  it("keeps server-only code and packages out of both interface artifacts", () => {
    for (const outputPath of ["dist/interface", "dist/interface-packaged"]) {
      const artifactText = collectTextArtifacts(path.join(repositoryRoot, outputPath));
      expect(
        artifactText,
        `Node built-in import leaked into ${outputPath}`,
      ).not.toMatch(/["']node:[a-z0-9_/-]+["']/i);
      for (const forbidden of [
        "src/server",
        "src/runtime/http",
        "better-sqlite3",
        "node-pty",
        "@libsql/client",
        "proper-lockfile",
      ]) {
        expect(artifactText, `${forbidden} leaked into ${outputPath}`).not.toContain(forbidden);
      }
    }
  });
});
