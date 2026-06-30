import { getAppDataPath } from "@/server/app-root";

export function isFullAccessAgentMode(mode: string | null | undefined) {
  return mode === "full-access" || mode === "danger-full-access";
}

export function buildGeminiArgs(input: {
  model?: string | null;
  mode?: string | null;
}) {
  const args = ["--experimental-acp"];
  if (isFullAccessAgentMode(input.mode)) {
    args.push("--approval-mode", "yolo");
  }
  const model = input.model?.trim();
  if (model) {
    args.push("--model", model);
  }
  args.push("--include-directories", getAppDataPath("attachments"));
  return args;
}
