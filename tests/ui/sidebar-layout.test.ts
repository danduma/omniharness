import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/page.tsx"),
  "utf8"
);

test("desktop conversation rail constrains overflowing run content", () => {
  expect(pageSource).toContain('hidden h-full w-[280px] shrink-0 overflow-hidden border-r border-border lg:flex');
  expect(pageSource).toContain('relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/30');
  expect(pageSource).toContain('min-h-0 flex-1 overflow-hidden');
  expect(pageSource).toContain('mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80');
  expect(pageSource).toContain('ml-3 group flex min-w-0 cursor-pointer gap-2 overflow-hidden rounded-lg border px-3 py-1.5 text-sm transition-colors');
  expect(pageSource).toContain('min-w-0 flex items-center justify-between gap-2');
});

test("settings render as a centered app modal with supervisor llm controls", () => {
  expect(pageSource).toContain('import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"');
  expect(pageSource).toContain('<Dialog open={showSettings} onOpenChange={setShowSettings}>');
  expect(pageSource).toContain('className="sm:max-w-xl"');
  expect(pageSource).toContain("Supervisor LLM");
  expect(pageSource).toContain("SUPERVISOR_LLM_PROVIDER");
  expect(pageSource).toContain("SUPERVISOR_LLM_MODEL");
  expect(pageSource).toContain("SUPERVISOR_LLM_BASE_URL");
  expect(pageSource).toContain("SUPERVISOR_LLM_API_KEY");
});
