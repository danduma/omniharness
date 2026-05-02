import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const managerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/home/HomeUiStateManager.ts"),
  "utf8"
);
const composerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/home/ConversationComposer.tsx"),
  "utf8"
);
const homeSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/home/HomeApp.tsx"),
  "utf8"
);

test("native chat attachment flow is managed by HomeUiStateManager", () => {
  expect(managerSource).toContain("addAttachmentFiles(files: File[])");
  expect(managerSource).toContain("addPastedImages(files: File[])");
  expect(managerSource).toContain("removeAttachment(id: string)");
  expect(managerSource).toContain("clearAttachments()");
  expect(managerSource).toContain("URL.createObjectURL(file)");
  expect(managerSource).toContain("URL.revokeObjectURL(attachment.previewUrl)");
});

test("composer uses the native file input instead of the project file picker dialog", () => {
  expect(composerSource).toContain('type="file"');
  expect(composerSource).toContain("onAddAttachmentFiles(files)");
  expect(composerSource).toContain("event.clipboardData.items");
  expect(composerSource).toContain("onAddPastedImages(pastedImages)");
  expect(homeSource).not.toContain("<FileAttachmentPickerDialog");
  expect(homeSource).toContain("uploadPendingChatAttachments");
});
