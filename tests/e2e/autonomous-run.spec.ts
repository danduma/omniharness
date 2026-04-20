import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test("run pauses for clarifications then completes after validation", async ({ page }) => {
  for (const file of ["hello.txt", "hi.txt", "greetings.txt"]) {
    try {
      fs.rmSync(path.resolve(process.cwd(), file));
    } catch (_err) {
      // ignore missing files
    }
  }

  await page.goto("/");
  await page.getByPlaceholder("e.g. implement vibes/test-plan.md").fill("implement vibes/test-plan.md");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Plan marked as done. Supervisor loop will terminate.")).toBeVisible({ timeout: 120000 });

  expect(fs.existsSync(path.resolve(process.cwd(), "hello.txt"))).toBe(true);
  expect(fs.existsSync(path.resolve(process.cwd(), "hi.txt"))).toBe(true);
  expect(fs.existsSync(path.resolve(process.cwd(), "greetings.txt"))).toBe(true);
});
