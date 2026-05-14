import { expect, type Page } from "@playwright/test";

export async function unlockApp(page: Page, url = "/") {
  await page.addInitScript(() => {
    window.localStorage.setItem("omni.onboarding.seen", "1");
  });
  await page.goto(url);
  const passwordInput = page.getByLabel("Password");
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill("test-password");
    await page.getByRole("button", { name: "Unlock OmniHarness" }).click();
    await expect(passwordInput).toBeHidden({ timeout: 30000 });
  }
  await dismissSetupModal(page);
}

export async function dismissSetupModal(page: Page) {
  const setupDialog = page.getByRole("dialog", { name: "Finish CLI setup" });
  if (await setupDialog.isVisible().catch(() => false)) {
    await setupDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(setupDialog).toBeHidden({ timeout: 30000 });
  }
}
