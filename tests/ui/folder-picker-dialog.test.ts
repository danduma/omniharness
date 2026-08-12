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
  expect(dialogSource).toContain('onClick={() => handleNavigate(data.parent)}');
  expect(dialogSource).toContain('onClick={() => handleNavigate(dir.path)}');
});

test("folder picker does not render a dedicated up button in the header", () => {
  expect(dialogSource).not.toContain("canGoUp");
  expect(dialogSource).not.toContain(">Up</Button>");
});

test("folder picker renders filesystem errors in the dialog instead of failing silently", () => {
  expect(dialogSource).toContain("normalizeAppError(error).message");
  expect(dialogSource).toContain('t("folder.picker.errorTitle")');
});

test("folder picker relies on the query lifecycle instead of manually refetching", () => {
  expect(dialogSource).not.toContain("useEffect");
  expect(dialogSource).not.toContain("refetch");
  expect(dialogSource).toContain("queryFn: ({ signal }) => (");
  expect(dialogSource).toContain("runtimeApis.files.browse({ path: currentPath }, { signal })");
});

test("folder picker creates a folder through the runtime API and navigates into it", () => {
  expect(dialogSource).toContain("useMutation");
  expect(dialogSource).toContain("runtimeApis.files.createDirectory");
  expect(dialogSource).toContain("folderPickerManager.completeDirectoryCreation");
  expect(dialogSource).toContain("creationOperationId");
  expect(dialogSource).toContain('t("folder.picker.newFolder")');
  expect(dialogSource).toContain('"folder.picker.create"');
});

test("folder picker keeps folder creation inline and exposes failures", () => {
  expect(dialogSource).toContain('<form onSubmit={handleCreateDirectory}');
  expect(dialogSource).toContain('role="alert"');
  expect(dialogSource).toContain("normalizeAppError(createDirectory.error).message");
  expect(dialogSource).not.toContain("NewFolderDialog");
});

test("folder picker keeps creation controls usable on narrow viewports", () => {
  expect(dialogSource).toContain("100dvh");
  expect(dialogSource).toContain("grid-cols-2");
  expect(dialogSource).toContain("sm:flex-row");
});

test("folder picker cannot select until the navigated folder is loaded", () => {
  expect(dialogSource).toContain("disabled={!data?.current");
  expect(dialogSource).toContain("if (!data?.current) return;");
});
