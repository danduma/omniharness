import { describe, expect, it } from "vitest";
import {
  parseInlineBootstrap,
  parseInterfaceRoute,
} from "@/ui/render-web";

describe("Vite interface bootstrap", () => {
  it("prefers query run ids and otherwise preserves session deep links", () => {
    expect(parseInterfaceRoute({
      pathname: "/session/abcdef123456",
      search: "?project=%2Ftmp%2Fproject&pair=legacy",
    })).toEqual({
      selectedRunId: "abcdef123456",
      draftProjectPath: "/tmp/project",
      pairToken: "legacy",
    });
    expect(parseInterfaceRoute({
      pathname: "/session/abcdef123456",
      search: "?run=run-from-query",
    }).selectedRunId).toBe("run-from-query");
  });

  it("uses injected bootstrap JSON when present and permits app-shell fallback", () => {
    expect(parseInlineBootstrap('{"id":"bootstrap-1"}')).toEqual({
      id: "bootstrap-1",
    });
    expect(parseInlineBootstrap(null)).toBeNull();
  });
});
