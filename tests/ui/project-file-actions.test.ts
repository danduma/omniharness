import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const readSource = (file: string) => {
  const absolutePath = path.resolve(process.cwd(), file);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
};

test("the file viewer menu copies the full file path", () => {
  const source = readSource("src/components/home/FileViewerPanel.tsx");

  expect(source).toContain('t("fileViewer.menu.copyFullPath")');
  expect(source).toContain("buildProjectFileFullPath");
  expect(source).toContain("navigator.clipboard.writeText");
});

test("session file links expose Open and Copy path in a context menu", () => {
  const markdownSource = readSource("src/components/MarkdownContent.tsx");
  const terminalSource = readSource("src/components/Terminal.tsx");
  const menuSource = readSource("src/components/ProjectFileContextMenu.tsx");

  expect(menuSource).toContain("ContextMenu");
  expect(menuSource).toContain('t("projectFile.menu.open")');
  expect(menuSource).toContain('t("projectFile.menu.copyPath")');
  expect(menuSource).toContain("buildProjectFileFullPath");
  expect(menuSource).toContain("navigator.clipboard.writeText");
  expect(markdownSource.match(/<ProjectFileContextMenu/g)?.length).toBe(2);
  expect(terminalSource).toContain("<ProjectFileContextMenu");
});
