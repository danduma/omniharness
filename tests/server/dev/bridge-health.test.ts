import { describe, expect, it } from "vitest";
import { describeBridgeToolingProblem } from "@/server/dev/bridge-health";

const structuredTools = [
  "codex-core/exec_command",
  "codex-core/write_stdin",
  "codex-core/update_plan",
  "codex-core/apply_patch",
  "codex-core/web_search",
  "codex-core/view_image",
  "codex-core/list_mcp_resources",
  "codex-core/list_mcp_resource_templates",
  "codex-core/read_mcp_resource",
  "fs/read_text_file",
  "fs/write_text_file",
  "acp_fs/read_text_file",
  "acp_fs/write_text_file",
  "acp_fs/edit_text_file",
  "acp_fs/multi_edit_text_file",
];

function doctorWithTools({
  structured = structuredTools,
  required = ["apply_patch", "applypatch"],
}: {
  structured?: string[];
  required?: string[];
} = {}) {
  return {
    results: [
      {
        type: "codex",
        tools: {
          structured: structured.map((name) => ({ name, available: true })),
          required: required.map((name) => ({ name, available: true })),
        },
      },
    ],
  };
}

describe("bridge health", () => {
  it("accepts a bridge that exposes the standard Codex tool surface", () => {
    expect(describeBridgeToolingProblem(doctorWithTools())).toBe(null);
  });

  it("reports stale bridges that predate managed Codex tools", () => {
    expect(describeBridgeToolingProblem(doctorWithTools({
      structured: ["fs/read_text_file", "fs/write_text_file"],
      required: ["rg", "git"],
    }))).toContain("codex-core/apply_patch");
  });

  it("requires the shell apply_patch argv0 shim, not just the structured core tool", () => {
    expect(describeBridgeToolingProblem(doctorWithTools({
      required: ["applypatch"],
    }))).toContain("apply_patch");
  });
});
