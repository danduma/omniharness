import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const source = [
  "src/app/page.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/HomeHeader.tsx",
].map(readSource).join("\n");

test("page shell exposes connect-phone as a first menu action and trims route-only session chrome", () => {
  expect(source).toContain("Connect Phone");
  expect(source).toContain("<Smartphone className=\"mr-2 h-4 w-4\" /> Connect Phone");
  expect(source).toContain("<Settings className=\"mr-2 h-4 w-4\" /> Settings");
  expect(source).toContain('aria-label="Current working directory"');
  expect(source).not.toContain("Starting in {draftProjectPath}");
  expect(source).not.toContain('aria-label="Conversation route"');
});
