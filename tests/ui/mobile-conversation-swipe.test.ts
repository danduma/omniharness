import fs from "fs";
import path from "path";
import { expect, test } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

test("the compact conversation surface opens the existing mobile conversation list on a right swipe", () => {
  const conversationMainSource = readSource("src/components/home/ConversationMain.tsx");
  const conversationSidebarSource = readSource("src/components/home/ConversationSidebar.tsx");
  const homeAppSource = readSource("src/interface/home/HomeApp.tsx");

  expect(conversationMainSource).toContain("onOpenMobileConversationList: () => void;");
  expect(conversationMainSource).toContain("mobileConversationSwipeManager.start");
  expect(conversationMainSource).toContain("mobileConversationSwipeManager.move");
  expect(conversationMainSource).toContain("onPointerMove={handleConversationPointerMove}");
  expect(conversationMainSource).toContain("mobileConversationSwipeManager.finish");
  expect(conversationMainSource).toContain("onPointerCancel={handleConversationPointerCancel}");
  expect(conversationMainSource).toContain('viewportClassName="touch-pan-y touch-pinch-zoom lg:touch-auto"');
  expect(conversationMainSource).not.toContain("setPointerCapture");
  expect(homeAppSource).toContain("onOpenMobileConversationList={handleOpenMobileConversationList}");
  expect(homeAppSource).toContain("setMobileNavOpen(true)");

  expect(conversationSidebarSource).toContain("mobileConversationSwipeManager.start");
  expect(conversationSidebarSource).toContain('mobileConversationSwipeManager.move(event, "left")');
  expect(conversationSidebarSource).toContain("onPointerMove={handleSidebarPointerMove}");
  expect(conversationSidebarSource).toContain('mobileConversationSwipeManager.finish(event, "left")');
  expect(conversationSidebarSource).toContain("onPointerCancel={handleSidebarPointerCancel}");
  expect(conversationSidebarSource).toContain('viewportClassName="touch-pan-y touch-pinch-zoom lg:touch-auto"');
  expect(conversationSidebarSource).not.toContain("setPointerCapture");
});
