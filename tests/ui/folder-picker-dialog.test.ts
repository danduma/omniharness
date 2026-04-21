import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const dialogSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/FolderPickerDialog.tsx"),
  "utf8"
);

test("folder picker clears the active filter when navigating into another folder", () => {
  expect(dialogSource).toContain('const handleNavigate = (path: string) => {');
  expect(dialogSource).toContain('setSearch("")');
  expect(dialogSource).toContain('onClick={() => canGoUp && handleNavigate(data.parent)}');
  expect(dialogSource).toContain('onClick={() => handleNavigate(data.parent)}');
  expect(dialogSource).toContain('onClick={() => handleNavigate(dir.path)}');
});
