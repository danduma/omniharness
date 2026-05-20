import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("VS Code webview bundle shape", () => {
  it("builds a separate webview renderer bundle from a React entry", () => {
    const buildSource = readSource("apps/vscode/scripts/build.mjs");

    expect(buildSource).toContain("\"webview\", \"main.tsx\"");
    expect(buildSource).toContain("webview.js");
  });

  it("serves CSP-safe HTML that loads the built webview script", () => {
    const extensionSource = readSource("apps/vscode/src/extension.ts");
    const htmlSource = readSource("apps/vscode/src/webviewHtml.ts");

    expect(extensionSource).toContain("renderVSCodeWebviewHtml");
    expect(extensionSource).toContain("dist\", \"webview.js");
    expect(htmlSource).toContain("scriptUri");
    expect(htmlSource).toContain("__OMNI_VSCODE_BOOTSTRAP__");
    expect(extensionSource).not.toContain("const vscode = acquireVsCodeApi();");
  });

  it("webview renderer uses the shared VS Code RuntimeAPIs adapter", () => {
    const webviewSource = readSource("apps/vscode/webview/main.tsx");

    expect(webviewSource).toContain("createVSCodeRuntimeAPIs");
    expect(webviewSource).toContain("apis.conversations.create");
    expect(webviewSource).toContain("apis.events.open");
  });
});
