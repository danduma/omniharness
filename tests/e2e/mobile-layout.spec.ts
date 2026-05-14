import { test, expect } from "@playwright/test";
import { unlockApp } from "./helpers";

test("mobile layout exposes sheet controls for navigation and workers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockApp(page);

  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByPlaceholder("Ask Omni anything. @ to refer to files")).toBeVisible();
});
