import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { assertLiveJourneyOptIn, assertLoopbackUrl } from "./safety";

export interface LiveAuthConfiguration {
  baseURL: string;
  password: string | null;
  reuseAuthenticatedState: boolean;
}

export function resolveLiveAuthConfiguration(
  env: Record<string, string | undefined>,
): LiveAuthConfiguration {
  assertLiveJourneyOptIn(env);
  const password = env.OMNIHARNESS_LIVE_E2E_PASSWORD?.trim();
  const reuseAuthenticatedState = !password && env.OMNIHARNESS_LIVE_E2E_AUTHENTICATED === "1";
  if (!password && !reuseAuthenticatedState) {
    throw new Error("Headless live journeys require a runtime password or explicitly authenticated browser state.");
  }
  const baseURL = assertLoopbackUrl(
    env.OMNIHARNESS_LIVE_E2E_BASE_URL?.trim() || "http://127.0.0.1:3035",
  ).origin;
  return { baseURL, password: password || null, reuseAuthenticatedState };
}

export const LIVE_AUTH_STATE_PATH = "test-results/live-auth-state.json";

export async function createLiveAuthState(configuration: LiveAuthConfiguration): Promise<void> {
  const authStatePath = path.resolve(LIVE_AUTH_STATE_PATH);
  fs.mkdirSync(path.dirname(authStatePath), { recursive: true, mode: 0o700 });
  if (configuration.reuseAuthenticatedState && !fs.existsSync(authStatePath)) {
    throw new Error("The explicitly authenticated live browser state does not exist.");
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(configuration.reuseAuthenticatedState
      ? { storageState: authStatePath }
      : undefined);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem("omni.onboarding.seen", "1");
    });
    await page.goto(configuration.baseURL, { waitUntil: "domcontentloaded" });
    const passwordInput = page.getByLabel("Password", { exact: true });
    const workspace = page.getByRole("button", { name: "Add project", exact: true });
    await expect(passwordInput.or(workspace)).toBeVisible({ timeout: 30_000 });
    if (await passwordInput.isVisible() && configuration.password) {
      await passwordInput.fill(configuration.password);
      const loginResponsePromise = page.waitForResponse((response) => (
        response.url() === `${configuration.baseURL}/api/auth/login`
        && response.request().method() === "POST"
      ));
      await page.getByRole("button", { name: "Unlock OmniHarness", exact: true }).click();
      const loginResponse = await loginResponsePromise;
      if (!loginResponse.ok()) {
        throw new Error(`Local browser login failed with status ${loginResponse.status()}.`);
      }
      await expect(workspace).toBeVisible({ timeout: 30_000 });
    }
    if (await passwordInput.isVisible() && !configuration.password) {
      throw new Error("The existing live browser state is no longer authenticated.");
    }
    const setupDialog = page.getByRole("dialog", { name: "Finish CLI setup", exact: true });
    if (await setupDialog.isVisible().catch(() => false)) {
      await setupDialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(setupDialog).toBeHidden({ timeout: 30_000 });
    }
    await expect(workspace).toBeVisible({ timeout: 30_000 });
    if (!configuration.reuseAuthenticatedState) {
      await context.storageState({ path: authStatePath });
    }
  } catch (error) {
    throw new Error("Unable to establish an authenticated local live-test browser session.", {
      cause: error,
    });
  } finally {
    await browser.close();
  }
}

export function removeLiveAuthState(): void {
  fs.rmSync(path.resolve(LIVE_AUTH_STATE_PATH), { force: true });
}
