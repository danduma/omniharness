import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const layoutSource = fs.readFileSync(
  path.resolve(process.cwd(), "apps/interface/index.html"),
  "utf8",
);

test("the Vite document applies persisted dark mode before the app paints", () => {
  expect(layoutSource).toContain('window.localStorage.getItem("omni-theme-mode")');
  expect(layoutSource).toContain('document.documentElement.classList.toggle("dark", themeMode === "night")');
  expect(layoutSource).toContain('document.documentElement.style.colorScheme = themeMode === "night" ? "dark" : "light"');
  expect(layoutSource).toContain('id="omni-theme-bootstrap"');
});
