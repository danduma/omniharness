import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const headerSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/home/HomeHeader.tsx"), "utf8");
const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/home/HomeApp.tsx"), "utf8");

test("HomeHeader accepts onReload callback and renders Reload Session dropdown item", () => {
  // Verify prop types and destructuring
  expect(headerSource).toContain("onReload: () => void;");
  expect(headerSource).toContain("onReload,");

  // Verify Lucide-react RotateCw icon import
  expect(headerSource).toContain("RotateCw");

  // Verify dropdown menu item and translations
  expect(headerSource).toContain("onClick={onReload}");
  expect(headerSource).toContain('t("session.menu.reload")');
});

test("HomeApp defines handleReload callback clearing localStorage snapshot and worker entries caches", () => {
  // Verify handleReload is defined in HomeApp
  expect(appSource).toContain("const handleReload = useCallback(() => {");
  expect(appSource).toContain('window.localStorage.removeItem("omni-event-stream-snapshot-cache:v1")');
  expect(appSource).toContain('window.localStorage.removeItem("omni-worker-entries-cache:v1")');
  expect(appSource).toContain("window.location.reload()");

  // Verify handleReload is passed to HomeHeader
  expect(appSource).toContain("onReload={handleReload}");
});
