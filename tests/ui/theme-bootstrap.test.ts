import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const layoutSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/layout.tsx"), "utf8");

test("root layout applies persisted dark mode before the app paints", () => {
  expect(layoutSource).toContain("const themeBootstrapScript =");
  expect(layoutSource).toContain('window.localStorage.getItem("omni-theme-mode")');
  expect(layoutSource).toContain('document.documentElement.classList.toggle("dark", themeMode === "night")');
  expect(layoutSource).toContain('document.documentElement.style.colorScheme = themeMode === "night" ? "dark" : "light"');
  expect(layoutSource).toContain('id="omni-theme-bootstrap"');
  expect(layoutSource).toContain("dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}");
});
