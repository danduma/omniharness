const REQUIRED_CODEX_STRUCTURED_TOOLS = [
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
] as const;

const REQUIRED_CODEX_EXECUTABLE_TOOLS = [
  "apply_patch",
  "applypatch",
  ...(process.platform === "linux" ? ["codex-linux-sandbox"] : []),
] as const;

type ToolDiagnosticLike = {
  name?: unknown;
  available?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function findTool(tools: unknown, name: string) {
  if (!Array.isArray(tools)) {
    return null;
  }
  return tools.find((tool): tool is ToolDiagnosticLike => asRecord(tool)?.name === name) ?? null;
}

function missingAvailableTools(tools: unknown, names: readonly string[]) {
  return names.filter((name) => findTool(tools, name)?.available !== true);
}

export function describeBridgeToolingProblem(doctorBody: unknown): string | null {
  const body = asRecord(doctorBody);
  const results = body?.results;
  if (!Array.isArray(results)) {
    return "doctor response does not include agent results";
  }

  const codex = results.find((result) => asRecord(result)?.type === "codex");
  const codexRecord = asRecord(codex);
  if (!codexRecord) {
    return "doctor response does not include Codex";
  }

  const tools = asRecord(codexRecord.tools);
  if (!tools) {
    return "Codex doctor response does not include tool diagnostics";
  }

  const missingStructured = missingAvailableTools(tools.structured, REQUIRED_CODEX_STRUCTURED_TOOLS);
  const missingExecutables = missingAvailableTools(tools.required, REQUIRED_CODEX_EXECUTABLE_TOOLS);
  const missing = [...missingStructured, ...missingExecutables];

  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}
