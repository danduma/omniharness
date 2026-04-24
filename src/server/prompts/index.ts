import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.resolve(process.cwd(), "src", "server", "prompts");

function loadPromptMarkdown(filename: string) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf8").trim();
}

export const SUPERVISOR_SYSTEM_PROMPT = loadPromptMarkdown("supervisor.md");
export const CONVERSATION_TITLE_SYSTEM_PROMPT = loadPromptMarkdown("conversation-title.md");
export const PLANNER_SYSTEM_PROMPT = loadPromptMarkdown("planner.md");
