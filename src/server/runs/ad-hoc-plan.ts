import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getAppDataPath } from "@/server/app-root";

interface AttachmentInput {
  kind?: string;
  name?: string;
  path?: string;
}

function quoteBlock(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function formatAttachments(attachments: AttachmentInput[]) {
  if (attachments.length === 0) return "";

  const lines = attachments.map((attachment) => {
    const parts = [
      attachment.kind?.trim(),
      attachment.name?.trim(),
      attachment.path?.trim(),
    ].filter(Boolean);

    return parts.length > 0 ? `- ${parts.join(" | ")}` : "- attachment";
  });

  return `\nAttachments:\n\n${lines.join("\n")}\n`;
}

export function buildAdHocPlanMarkdown(command: string, attachments: AttachmentInput[] = []) {
  return `# Ad Hoc Request

Original command:

${quoteBlock(command)}
${formatAttachments(attachments)}

## Supervisor Notes

This file stores the original request and any attached context for the supervisor.
`;
}

export function createAdHocPlan(command: string, attachments: AttachmentInput[] = []) {
  const adHocDir = getAppDataPath("vibes", "ad-hoc");
  fs.mkdirSync(adHocDir, { recursive: true });

  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.md`;
  const relativePath = path.join("vibes", "ad-hoc", filename);
  fs.writeFileSync(getAppDataPath(relativePath), buildAdHocPlanMarkdown(command, attachments), "utf-8");
  return relativePath;
}

export function rewriteAdHocPlan(relativePath: string, command: string, attachments: AttachmentInput[] = []) {
  fs.writeFileSync(getAppDataPath(relativePath), buildAdHocPlanMarkdown(command, attachments), "utf-8");
}
