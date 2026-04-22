export type PermissionDecision = "approve" | "review" | "escalate";

export function classifyPermissionRequest(text: string): PermissionDecision {
  const lower = text.toLowerCase();

  if (
    /(npm install|pnpm add|pnpm install|yarn add|yarn install|bun add|bun install|pip install|cargo add|curl|wget|fetch|upload|download|git push|ssh|scp|rsync|sudo)/i.test(lower)
  ) {
    return "escalate";
  }

  if (
    /(write|create|edit|modify|save|touch)\s+.*\.(txt|md|json|ts|tsx|js|jsx|css|html|yml|yaml)/i.test(lower) ||
    /file write|create file|update file/i.test(lower)
  ) {
    return "approve";
  }

  if (
    /(?:^|\W)(cat|less|head|tail|ls|find|rg|grep|sed|awk|cut|sort|uniq|wc|stat|file|pwd|jq|git status|git diff|git show|python3?|node)(?:$|\W)/i.test(lower) &&
    !/(write|create|edit|modify|save|touch|rm\s|mv\s|cp\s|tee\s|chmod|chown|network|internet)/i.test(lower)
  ) {
    return "approve";
  }

  if (/(shell|terminal|command|install|network|internet)/i.test(lower)) {
    return "review";
  }

  return "review";
}

export function shouldAutoApprove(text: string) {
  return classifyPermissionRequest(text) === "approve";
}
