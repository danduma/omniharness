import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const dialogSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/FolderPickerDialog.tsx"),
  "utf8"
);

test("folder picker clears the active filter when navigating into another folder", () => {
  expect(dialogSource).toContain('const handleNavigate = (path: string) => {');
  expect(dialogSource).toContain("folderPickerManager.navigate(path)");
  expect(dialogSource).toContain('if (data?.parent && canGoUp) {');
  expect(dialogSource).toContain('onClick={() => handleNavigate(data.parent)}');
  expect(dialogSource).toContain('onClick={() => handleNavigate(dir.path)}');
});

test("folder picker renders filesystem errors in the dialog instead of failing silently", () => {
  expect(dialogSource).toContain('action: "Browse directories"');
  expect(dialogSource).toContain("normalizeAppError(error).message");
  expect(dialogSource).toContain("Browse directories");
});
