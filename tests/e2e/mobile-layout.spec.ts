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

async function moveTouchDrag(
  client: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
) {
  for (let step = 1; step <= steps; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
        id: 1,
      }],
    });
  }
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

  const mobileConversationList = page.locator('[data-slot="sheet-content"]');
  const drawerLeft = async () => (await mobileConversationList.boundingBox())?.x ?? Number.NaN;

  // A short drag reveals part of the drawer, then springs back when released.
  await startTouchDrag(client, { x: 32, y: 320 }, { x: 48, y: 320 });
  await moveTouchDrag(client, { x: 48, y: 320 }, { x: 108, y: 322 });
  await expect(mobileConversationList).toBeVisible();
  const partialDrawerWidth = (await mobileConversationList.boundingBox())?.width ?? 0;
  await expect.poll(drawerLeft).toBeCloseTo(60 - partialDrawerWidth, 0);
  await page.waitForTimeout(150);
  await endTouchDrag(client);
  await expect(mobileConversationList).toBeHidden();

  // Dragging past a quarter of the drawer width opens it fully.
  await startTouchDrag(client, { x: 32, y: 320 }, { x: 48, y: 320 });
  await moveTouchDrag(client, { x: 48, y: 320 }, { x: 48 + partialDrawerWidth * 0.3, y: 326 });
  await page.waitForTimeout(150);
  await endTouchDrag(client);
  await expect(mobileConversationList).toBeVisible();
  await expect.poll(drawerLeft).toBe(0);
  await expect(mobileConversationList.getByPlaceholder("Search")).toBeVisible();
  await expect(mobileConversationList.locator('[data-slot="scroll-area-viewport"]')).toHaveCSS("touch-action", "pan-y pinch-zoom");

  const mobileSidebar = mobileConversationList.locator('[data-conversation-sidebar-surface="mobile"]');
  const mobileSidebarBox = await mobileSidebar.boundingBox();
  expect(mobileSidebarBox).not.toBeNull();
  if (!mobileSidebarBox) return;
  const closeStart = { x: mobileSidebarBox.x + mobileSidebarBox.width - 32, y: mobileSidebarBox.y + 320 };
  const closeSlop = { x: closeStart.x - 16, y: closeStart.y };

  // A short drag back toward the edge leaves the drawer open.
  await startTouchDrag(client, closeStart, closeSlop);
  await moveTouchDrag(client, closeSlop, { x: closeSlop.x - 60, y: closeSlop.y + 4 });
  await expect.poll(drawerLeft).toBeCloseTo(-60, 0);
  await page.waitForTimeout(150);
  await endTouchDrag(client);
  await expect.poll(drawerLeft).toBe(0);

  // Dragging past a quarter of the way closes it.
  await startTouchDrag(client, closeStart, closeSlop);
  await moveTouchDrag(client, closeSlop, { x: closeSlop.x - mobileSidebarBox.width * 0.3, y: closeSlop.y + 4 });
  await page.waitForTimeout(150);
  await endTouchDrag(client);
  await expect(mobileConversationList).toBeHidden();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
});
