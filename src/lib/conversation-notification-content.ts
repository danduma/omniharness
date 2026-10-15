/** Plain, bounded previews for OS notifications; never include tool output or thoughts. */
export function notificationPreview(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value
    .replace(/```[\s\S]*?(?:```|$)/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+)/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ").trim();
  return text.length > 240 ? `${text.slice(0, 239).trimEnd()}…` : text;
}

export function notificationEventDetail(details: unknown): string {
  let value = details;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return ""; }
  }
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return notificationPreview(record.question) || notificationPreview(record.summary);
}

export type ConversationNotificationKind = "complete" | "response" | "input" | "permission" | "failed";

export function conversationNotificationContent(
  options: { kind: ConversationNotificationKind; title: string; detail?: string; runner?: string | null },
  translate: (key: string, params?: Record<string, string>) => string,
) {
  const title = translate(`notifications.push.${options.kind}Title`, { title: notificationPreview(options.title) });
  return {
    title: options.runner ? translate("notifications.push.runnerTitle", { runner: options.runner, title }) : title,
    body: notificationPreview(options.detail) || translate(`notifications.push.${options.kind}Fallback`),
  };
}
