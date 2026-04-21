import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/page.tsx"),
  "utf8"
);

test("conversation rows expose rename and delete actions", () => {
  expect(pageSource).toContain('Rename conversation');
  expect(pageSource).toContain('Delete conversation');
  expect(pageSource).toContain('fetch(`/api/runs/${runId}`, {');
});

test("user messages expose retry, edit, and fork recovery controls", () => {
  expect(pageSource).toContain("Retry from here");
  expect(pageSource).toContain("Edit in place");
  expect(pageSource).toContain("Fork from here");
  expect(pageSource).toContain('body: JSON.stringify({ action, targetMessageId, content })');
});

test("failed runs render the persisted last error in the conversation view", () => {
  expect(pageSource).toContain("Execution failed");
  expect(pageSource).toContain("selectedRun.lastError");
});

test("dropdown menus size to fit action labels instead of the trigger width", () => {
  const dropdownSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/ui/dropdown-menu.tsx"),
    "utf8"
  );

  expect(dropdownSource).not.toContain("w-(--anchor-width)");
  expect(dropdownSource).toContain("w-fit");
  expect(dropdownSource).toContain("min-w-[12rem]");
});
