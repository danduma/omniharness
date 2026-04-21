import { test, expect } from "@playwright/test";

test("mobile layout exposes sheet controls for navigation and workers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open workers" })).toBeVisible();
});
