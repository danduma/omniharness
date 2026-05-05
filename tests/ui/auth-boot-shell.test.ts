import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/home/HomeApp.tsx"),
  "utf8",
);
const bootShellSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/BootShell.tsx"),
  "utf8",
);
const loginShellSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/LoginShell.tsx"),
  "utf8",
);
const globalsSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

test("app uses a neutral boot shell while auth state is still loading", () => {
  expect(pageSource).toContain("if (!routeReady || sessionQuery.isLoading");
  expect(pageSource).toContain("<BootShell");
});

test("loading shell presents a workspace orchestration scene while preserving theme bootstrap safety", () => {
  expect(bootShellSource).toContain("bg-background");
  expect(bootShellSource).toContain('role="status"');
  expect(bootShellSource).toContain("Preparing workspace handoff");
  expect(bootShellSource).toContain("Session");
  expect(bootShellSource).toContain("Workers");
  expect(bootShellSource).toContain("Messages");
  expect(bootShellSource).toContain("motion-reduce:animate-none");
  expect(bootShellSource).not.toContain("LoaderCircle");
});

test("login shell keeps the page background dark when dark mode is active", () => {
  expect(loginShellSource).toContain("dark:bg-[radial-gradient");
  expect(globalsSource).toContain("@apply bg-background text-foreground");
});
