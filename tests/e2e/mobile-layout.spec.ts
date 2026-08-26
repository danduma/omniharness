import { test, expect, type CDPSession } from "@playwright/test";
import { unlockApp } from "./helpers";

async function dispatchTouchGesture(
  client: CDPSession,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  if (start.x !== end.x || start.y !== end.y) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, id: 1 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

async function startTouchDrag(
  client: CDPSession,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...end, id: 1 }],
  });
}

async function endTouchDrag(client: CDPSession) {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("mobile layout exposes sheet controls for navigation and workers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockApp(page);

  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByPlaceholder("Do anything. @ to refer to files")).toBeVisible();
});

test("mobile swipes open and close the conversation list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockApp(page);

  const conversationSurface = page.locator('[data-slot="scroll-area"]:visible');
  await expect(conversationSurface).toBeVisible();
  await expect(conversationSurface.locator('[data-slot="scroll-area-viewport"]')).toHaveCSS("touch-action", "pan-y pinch-zoom");

  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });

  const settingsButton = page.getByRole("button", { name: "Settings" });
  const settingsButtonBox = await settingsButton.boundingBox();
  expect(settingsButtonBox).not.toBeNull();
  if (!settingsButtonBox) return;
  const settingsButtonCenter = {
    x: settingsButtonBox.x + settingsButtonBox.width / 2,
    y: settingsButtonBox.y + settingsButtonBox.height / 2,
  };
  await dispatchTouchGesture(client, settingsButtonCenter, settingsButtonCenter);
  const composerSettings = page.locator('[data-composer-settings-dialog="true"]');
  await expect(composerSettings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(composerSettings).toBeHidden();

  await dispatchTouchGesture(client, { x: 180, y: 220 }, { x: 184, y: 320 });
  await expect(page.locator('[data-slot="sheet-content"]:visible')).toHaveCount(0);

  await startTouchDrag(client, { x: 32, y: 320 }, { x: 112, y: 326 });

  const mobileConversationList = page.locator('[data-slot="sheet-content"]');
  await expect(mobileConversationList).toBeVisible();
  await endTouchDrag(client);
  await expect(mobileConversationList.getByPlaceholder("Search")).toBeVisible();
  await expect(mobileConversationList.locator('[data-slot="scroll-area-viewport"]')).toHaveCSS("touch-action", "pan-y pinch-zoom");

  const mobileSidebar = mobileConversationList.locator('[data-conversation-sidebar-surface="mobile"]');
  const mobileSidebarBox = await mobileSidebar.boundingBox();
  expect(mobileSidebarBox).not.toBeNull();
  if (!mobileSidebarBox) return;
  await startTouchDrag(
    client,
    { x: mobileSidebarBox.x + mobileSidebarBox.width - 32, y: mobileSidebarBox.y + 320 },
    { x: mobileSidebarBox.x + mobileSidebarBox.width - 112, y: mobileSidebarBox.y + 326 },
  );
  await expect(mobileConversationList).toBeHidden();
  await endTouchDrag(client);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
});
