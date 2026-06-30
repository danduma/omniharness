import { getAppDataPath } from "@/server/app-root";
import { homedir } from "os";
import { join } from "path";
import { readdir, open } from "fs/promises";

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

export async function resolveFullGeminiUuid(resumeSessionId: string, customCwd?: string): Promise<string> {
  if (typeof resumeSessionId !== "string" || resumeSessionId.length === 36) {
    return resumeSessionId;
  }

  // Extract the 8-character short ID from the end of the string if possible
  // (handles "1aba5d6a", "omniharness-1aba5d6a", etc.)
  let shortId = resumeSessionId;
  const hex8Match = resumeSessionId.match(/[-_]?([0-9a-f]{8})$/i);
  if (hex8Match) {
    shortId = hex8Match[1];
  }

  if (shortId.length !== 8) {
    return resumeSessionId;
  }

  const configRoots = [
    join(homedir(), ".gemini"),
    join(customCwd || process.cwd(), ".omniharness/cli-home/gemini/.gemini"),
  ];

  for (const configRoot of configRoots) {
    const tmpDir = join(configRoot, "tmp");
    let projectDirs: string[];
    try {
      projectDirs = await readdir(tmpDir);
    } catch {
      continue;
    }

    for (const dirName of projectDirs) {
      const chatsDir = join(tmpDir, dirName, "chats");
      let entries: string[];
      try {
        entries = await readdir(chatsDir);
      } catch {
        continue;
      }

      for (const entryName of entries) {
        if (entryName.endsWith(`-${shortId}.jsonl`)) {
          const filePath = join(chatsDir, entryName);
          let fileHandle;
          try {
            fileHandle = await open(filePath, "r");
            const buffer = Buffer.alloc(4096);
            const { bytesRead } = await fileHandle.read(buffer, 0, 4096, 0);
            const chunk = buffer.toString("utf8", 0, bytesRead);
            const firstLine = chunk.split("\n")[0];
            if (firstLine) {
              const parsed = JSON.parse(firstLine);
              if (typeof parsed.sessionId === "string" && parsed.sessionId.length === 36) {
                return parsed.sessionId;
              }
            }
          } catch {
            // Ignore parse or read errors and continue
          } finally {
            await fileHandle?.close();
          }
        }
      }
    }
  }

  // Fallback: Pad the short ID to a synthetic 36-character UUID
  // to satisfy the Gemini CLI's argument validator regex, which requires
  // a UUID or index. Since the CLI matches files by the first 8 characters
  // of the UUID, this synthetic UUID will correctly match session-*-<shortId>.jsonl.
  return `${shortId}-0000-0000-0000-000000000000`;
}
