import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const dialogSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/FileAttachmentPickerDialog.tsx"),
  "utf8"
);

test("file attachment picker supports searching and attaching multiple files from the active scope", () => {
  expect(dialogSource).toContain('queryKey: ["attachable-files", rootPath]');
  expect(dialogSource).toContain('placeholder="Search files..."');
  expect(dialogSource).toContain("selectedFiles.includes(filePath)");
  expect(dialogSource).toContain("fileAttachmentPickerManager.toggleFile(filePath)");
  expect(dialogSource).toContain("Attach Selected Files");
  expect(dialogSource).toContain("onSelect(selectedFiles.map");
});

test("file attachment picker renders loader failures inside the dialog", () => {
  expect(dialogSource).toContain('action: "Load attachable files"');
  expect(dialogSource).toContain("normalizeAppError(error).message");
  expect(dialogSource).toContain("Load attachable files");
});
