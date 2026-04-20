export type PermissionDecision = "approve" | "review" | "escalate";

export function classifyPermissionRequest(text: string): PermissionDecision {
  const lower = text.toLowerCase();

  if (
    /(write|create|edit|modify|save|touch)\s+.*\.(txt|md|json|ts|tsx|js|jsx|css|html|yml|yaml)/i.test(lower) ||
    /file write|create file|update file/i.test(lower)
  ) {
    return "approve";
  }

  if (/(npm install|pnpm add|yarn add|curl|wget|fetch|network|upload|download|git push|ssh|sudo)/i.test(lower)) {
    return "escalate";
  }

  if (/(shell|terminal|command|install|network|internet)/i.test(lower)) {
    return "review";
  }

  return "review";
}

export function shouldAutoApprove(text: string) {
  return classifyPermissionRequest(text) === "approve";
}
