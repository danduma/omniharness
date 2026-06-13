import { createReadStream } from "fs";
import { open, readdir, stat } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";

export interface ExternalClaudeSession {
  sessionId: string;
  projectDir: string;
  projectPath: string;
  sessionFilePath: string;
  lastModified: Date;
  title: string | null;       // first real user message
  recentOutput: string | null; // last assistant text
  messageCount: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Noise patterns in user messages that come from automation/omniharness wrappers
const NOISE_RE = /<local-command|<command-name|<system-reminder|<function_calls>|^\s*$/;

function decodeProjectDir(dirName: string): string {
  if (!dirName.startsWith("-")) return dirName;
  return dirName.replace(/-/g, "/");
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") {
    const t = content.trim();
    return t || null;
  }
  if (Array.isArray(content)) {
    for (const block of content as Array<Record<string, unknown>>) {
      if (block.type === "text" && typeof block.text === "string") {
        const t = block.text.trim();
        if (t) return t;
      }
    }
  }
  return null;
}

function parseLines(lines: string[]): {
  cwd: string | null;
  title: string | null;
  recentOutput: string | null;
  messageCount: number;
} {
  let cwd: string | null = null;
  let title: string | null = null;
  let recentOutput: string | null = null;
  let messageCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (!cwd && typeof entry.cwd === "string") {
      cwd = entry.cwd;
    }

    const msg = entry.message as Record<string, unknown> | undefined;
    if (!msg) continue;

    if (msg.role === "user") {
      messageCount += 1;
      if (!title) {
        const text = extractText(msg.content);
        if (text && !NOISE_RE.test(text)) {
          title = text.slice(0, 160);
        }
      }
    } else if (msg.role === "assistant") {
      const text = extractText(msg.content);
      if (text) {
        recentOutput = text.slice(0, 300);
      }
    }
  }

  return { cwd, title, recentOutput, messageCount };
}

async function readSessionInfo(filePath: string, fileSize: number): Promise<{
  cwd: string | null;
  title: string | null;
  recentOutput: string | null;
  messageCount: number;
}> {
  // Read head for cwd + title
  const headLines = await readHeadLines(filePath, 4096);
  const head = parseLines(headLines);

  if (fileSize <= 8192) {
    // Small file — head covers everything
    return head;
  }

  // Read tail for recent output; parse lines from the end
  const tailLines = await readTailLines(filePath, fileSize, 8192);
  const tail = parseLines(tailLines);

  return {
    cwd: head.cwd ?? tail.cwd,
    title: head.title ?? tail.title,
    recentOutput: tail.recentOutput ?? head.recentOutput,
    messageCount: head.messageCount,
  };
}

async function readHeadLines(filePath: string, maxBytes: number): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let bytesRead = 0;

    const stream = createReadStream(filePath, { encoding: "utf8", start: 0, end: maxBytes });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      bytesRead += Buffer.byteLength(line, "utf8") + 1;
      lines.push(line);
      if (bytesRead >= maxBytes) rl.close();
    });

    rl.on("close", () => resolve(lines));
    rl.on("error", () => resolve(lines));
  });
}

async function readTailLines(filePath: string, fileSize: number, tailBytes: number): Promise<string[]> {
  const start = Math.max(0, fileSize - tailBytes);
  const buf = Buffer.alloc(fileSize - start);

  let fd: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fd = await open(filePath, "r");
    await fd.read(buf, 0, buf.length, start);
  } catch {
    return [];
  } finally {
    await fd?.close();
  }

  const text = buf.toString("utf8");
  // Drop the first (potentially partial) line
  const newline = text.indexOf("\n");
  const clean = newline >= 0 ? text.slice(newline + 1) : text;
  return clean.split("\n").filter(Boolean);
}

export async function discoverExternalClaudeSessions(
  globalConfigDir?: string,
): Promise<ExternalClaudeSession[]> {
  const configDir = globalConfigDir ?? join(homedir(), ".claude");
  const projectsDir = join(configDir, "projects");

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  const sessions: ExternalClaudeSession[] = [];

  await Promise.all(
    projectDirs.map(async (dirName) => {
      const dirPath = join(projectsDir, dirName);
      let entries: string[];
      try {
        entries = await readdir(dirPath);
      } catch {
        return;
      }

      await Promise.all(
        entries
          .filter((f) => f.endsWith(".jsonl") && UUID_RE.test(f.slice(0, -6)))
          .map(async (filename) => {
            const sessionId = filename.slice(0, -6);
            const filePath = join(dirPath, filename);
            let fileStat;
            try {
              fileStat = await stat(filePath);
            } catch {
              return;
            }

            const { title, recentOutput, cwd, messageCount } = await readSessionInfo(filePath, fileStat.size);
            const projectPath = cwd ?? decodeProjectDir(dirName);

            sessions.push({
              sessionId,
              projectDir: dirName,
              projectPath,
              sessionFilePath: filePath,
              lastModified: fileStat.mtime,
              title,
              recentOutput,
              messageCount,
            });
          }),
      );
    }),
  );

  sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return sessions;
}

export function globalClaudeConfigDir(): string {
  return join(homedir(), ".claude");
}
