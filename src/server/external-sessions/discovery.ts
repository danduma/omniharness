import { createReadStream } from "fs";
import { open, readdir, stat, readFile } from "fs/promises";
import { homedir } from "os";
import { join, basename } from "path";
import { createInterface } from "readline";

export interface ExternalClaudeSession {
  sessionId: string;
  projectDir: string;
  projectPath: string;
  sessionFilePath: string;
  lastModified: Date;
  title: string | null;       // provider title, or first real user message
  recentOutput: string | null; // last assistant text
  messageCount: number;
}

export interface ExternalClaudeTranscriptEntry {
  id: string;
  type: "user_input" | "message" | "tool_call" | "tool_call_update";
  text: string;
  timestamp: string;
  authorRole: "user" | "assistant" | "system";
  channel: "stdin" | "agent";
  toolCallId?: string;
  toolKind?: string;
  status?: string;
  raw?: unknown;
}

export interface LoadedExternalClaudeSession extends ExternalClaudeSession {
  entries: ExternalClaudeTranscriptEntry[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Noise patterns in user messages that come from automation/omniharness wrappers
const NOISE_RE = /<local-command|<command-name|<system-reminder|<function_calls>|<session_context|OmniHarness direct-control|^\s*$/;

interface ClaudeDesktopSessionMetadata {
  cliSessionId: string;
  projectPath: string | null;
  title: string | null;
  lastActivityAt: Date | null;
}

function isTransientDesktopSessionReadError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function reportDesktopSessionReadError(path: string, error: unknown) {
  if (isTransientDesktopSessionReadError(error)) return;
  console.warn(`[external-sessions] Could not read Claude Desktop session metadata at ${path}:`, error);
}

async function readClaudeDesktopSessionMetadata(
  sessionsDir: string,
): Promise<Map<string, ClaudeDesktopSessionMetadata>> {
  let accountDirs;
  try {
    accountDirs = await readdir(sessionsDir, { withFileTypes: true });
  } catch (error) {
    reportDesktopSessionReadError(sessionsDir, error);
    return new Map();
  }

  const metadata = new Map<string, ClaudeDesktopSessionMetadata>();
  const accountPaths = accountDirs
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(sessionsDir, entry.name));

  await Promise.all(accountPaths.map(async (accountPath) => {
    let workspaceDirs;
    try {
      workspaceDirs = await readdir(accountPath, { withFileTypes: true });
    } catch (error) {
      reportDesktopSessionReadError(accountPath, error);
      return;
    }

    await Promise.all(workspaceDirs
      .filter((entry) => entry.isDirectory())
      .map(async (workspaceDir) => {
        const workspacePath = join(accountPath, workspaceDir.name);
        let sessionFiles;
        try {
          sessionFiles = await readdir(workspacePath, { withFileTypes: true });
        } catch (error) {
          reportDesktopSessionReadError(workspacePath, error);
          return;
        }

        await Promise.all(sessionFiles
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map(async (sessionFile) => {
            try {
              const raw = await readFile(join(workspacePath, sessionFile.name), "utf8");
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              const cliSessionId = typeof parsed.cliSessionId === "string"
                ? parsed.cliSessionId.trim()
                : "";
              if (!UUID_RE.test(cliSessionId)) return;

              const cwd = typeof parsed.cwd === "string" ? parsed.cwd.trim() : "";
              const originCwd = typeof parsed.originCwd === "string" ? parsed.originCwd.trim() : "";
              const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
              const lastActivityMs = typeof parsed.lastActivityAt === "number"
                && Number.isFinite(parsed.lastActivityAt)
                ? parsed.lastActivityAt
                : null;
              const candidate: ClaudeDesktopSessionMetadata = {
                cliSessionId,
                projectPath: cwd || originCwd || null,
                title: title ? title.slice(0, 160) : null,
                lastActivityAt: lastActivityMs === null ? null : new Date(lastActivityMs),
              };
              const existing = metadata.get(cliSessionId);
              if (
                !existing
                || (candidate.lastActivityAt?.getTime() ?? 0) > (existing.lastActivityAt?.getTime() ?? 0)
              ) {
                metadata.set(cliSessionId, candidate);
              }
            } catch (error) {
              // Desktop can rewrite or remove these files while discovery is running.
              reportDesktopSessionReadError(join(workspacePath, sessionFile.name), error);
            }
          }));
      }));
  }));

  return metadata;
}

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

function extractAllText(content: unknown): string | null {
  if (typeof content === "string") {
    const text = content.trim();
    return text || null;
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const parts = content
    .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object")
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => String(block.text).trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function stringifyToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  const text = extractAllText(content);
  if (text) {
    return text;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content ?? "");
  }
}

function parseClaudeTranscript(sessionId: string, body: string): ExternalClaudeTranscriptEntry[] {
  const entries: ExternalClaudeTranscriptEntry[] = [];
  const toolKinds = new Map<string, string>();
  let sourceIndex = 0;

  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    sourceIndex += 1;

    let source: Record<string, unknown>;
    try {
      source = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const message = source.message;
    if (!message || typeof message !== "object") continue;
    const role = (message as Record<string, unknown>).role;
    if (role !== "user" && role !== "assistant") continue;

    const timestampValue = typeof source.timestamp === "string"
      ? source.timestamp
      : "";
    const timestampMs = Date.parse(timestampValue);
    if (!Number.isFinite(timestampMs)) continue;

    const sourceId = typeof source.uuid === "string" && source.uuid.trim()
      ? source.uuid.trim()
      : `line-${sourceIndex}`;
    const idPrefix = `external-claude:${sessionId}:${sourceId}`;
    const timestamp = new Date(timestampMs).toISOString();
    const content = (message as Record<string, unknown>).content;

    if (typeof content === "string") {
      const text = content.trim();
      if (!text || (role === "user" && NOISE_RE.test(text))) continue;
      entries.push({
        id: idPrefix,
        type: role === "user" ? "user_input" : "message",
        text,
        timestamp,
        authorRole: role,
        channel: role === "user" ? "stdin" : "agent",
      });
      continue;
    }
    if (!Array.isArray(content)) continue;

    const blocks = content.filter(
      (block): block is Record<string, unknown> => Boolean(block) && typeof block === "object",
    );
    const text = extractAllText(blocks);
    if (text && !(role === "user" && NOISE_RE.test(text))) {
      entries.push({
        id: idPrefix,
        type: role === "user" ? "user_input" : "message",
        text,
        timestamp,
        authorRole: role,
        channel: role === "user" ? "stdin" : "agent",
      });
    }

    for (const [blockIndex, block] of blocks.entries()) {
      if (role === "assistant" && block.type === "tool_use") {
        const toolCallId = typeof block.id === "string" && block.id.trim()
          ? block.id.trim()
          : `${sourceId}:${blockIndex}`;
        const toolKind = typeof block.name === "string" && block.name.trim()
          ? block.name.trim()
          : "Tool";
        const rawInput = block.input && typeof block.input === "object"
          ? block.input
          : {};
        const description = typeof (rawInput as Record<string, unknown>).description === "string"
          ? String((rawInput as Record<string, unknown>).description).trim()
          : "";
        toolKinds.set(toolCallId, toolKind);
        entries.push({
          id: `${idPrefix}:${blockIndex}`,
          type: "tool_call",
          text: description || toolKind,
          timestamp,
          authorRole: "assistant",
          channel: "agent",
          toolCallId,
          toolKind,
          status: "pending",
          raw: {
            source: "external_claude",
            title: description || toolKind,
            rawInput,
          },
        });
      } else if (role === "user" && block.type === "tool_result") {
        const toolCallId = typeof block.tool_use_id === "string" && block.tool_use_id.trim()
          ? block.tool_use_id.trim()
          : `${sourceId}:${blockIndex}`;
        const toolKind = toolKinds.get(toolCallId) || "Tool";
        const failed = block.is_error === true;
        entries.push({
          id: `${idPrefix}:${blockIndex}`,
          type: "tool_call_update",
          text: `${toolKind} ${failed ? "failed" : "completed"}`,
          timestamp,
          authorRole: "system",
          channel: "agent",
          toolCallId,
          toolKind,
          status: failed ? "failed" : "completed",
          raw: {
            source: "external_claude",
            title: toolKind,
            rawOutput: stringifyToolResultContent(block.content),
          },
        });
      }
    }
  }

  return entries;
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
  claudeDesktopSessionsDir?: string,
): Promise<ExternalClaudeSession[]> {
  const configDir = globalConfigDir ?? join(homedir(), ".claude");
  const projectsDir = join(configDir, "projects");
  const desktopSessionsDir = claudeDesktopSessionsDir
    ?? (globalConfigDir
      ? null
      : join(homedir(), "Library", "Application Support", "Claude", "claude-code-sessions"));
  const desktopMetadata = desktopSessionsDir
    ? await readClaudeDesktopSessionMetadata(desktopSessionsDir)
    : new Map<string, ClaudeDesktopSessionMetadata>();

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
            const desktopSession = desktopMetadata.get(sessionId);
            const desktopActivity = desktopSession?.lastActivityAt;
            const lastModified = desktopActivity && desktopActivity > fileStat.mtime
              ? desktopActivity
              : fileStat.mtime;

            sessions.push({
              sessionId,
              projectDir: dirName,
              projectPath: desktopSession?.projectPath ?? cwd ?? decodeProjectDir(dirName),
              sessionFilePath: filePath,
              lastModified,
              title: desktopSession?.title ?? title,
              recentOutput,
              messageCount,
            });
          }),
      );
    }),
  );

  sessions.sort((a, b) =>
    b.lastModified.getTime() - a.lastModified.getTime()
    || a.sessionFilePath.localeCompare(b.sessionFilePath)
  );

  const seenSessionIds = new Set<string>();
  return sessions.filter((session) => {
    if (seenSessionIds.has(session.sessionId)) return false;
    seenSessionIds.add(session.sessionId);
    return true;
  });
}

export async function loadExternalClaudeSession(
  sessionId: string,
  globalConfigDir?: string,
  claudeDesktopSessionsDir?: string,
): Promise<LoadedExternalClaudeSession | null> {
  const normalizedSessionId = sessionId.trim();
  if (!UUID_RE.test(normalizedSessionId)) {
    return null;
  }

  const sessions = await discoverExternalClaudeSessions(globalConfigDir, claudeDesktopSessionsDir);
  const session = sessions.find((candidate) => candidate.sessionId === normalizedSessionId);
  if (!session) {
    return null;
  }

  try {
    const body = await readFile(session.sessionFilePath, "utf8");
    return {
      ...session,
      entries: parseClaudeTranscript(normalizedSessionId, body),
    };
  } catch {
    return {
      ...session,
      entries: [],
    };
  }
}

export function globalClaudeConfigDir(): string {
  return join(homedir(), ".claude");
}

export interface ExternalGeminiSession {
  sessionId: string;
  projectDir: string;
  projectPath: string;
  sessionFilePath: string;
  lastModified: Date;
  title: string | null;
  recentOutput: string | null;
  messageCount: number;
}

async function getGeminiProjectsMap(configRoot: string): Promise<Record<string, string>> {
  const projectsPath = join(configRoot, "projects.json");
  try {
    const raw = await readFile(projectsPath, "utf8");
    const parsed = JSON.parse(raw) as { projects?: Record<string, string> };
    const map: Record<string, string> = {};
    if (parsed.projects) {
      for (const [dir, name] of Object.entries(parsed.projects)) {
        if (name) {
          map[name.trim().toLowerCase()] = dir;
        }
      }
    }
    return map;
  } catch {
    return {};
  }
}

function parseGeminiLines(lines: string[]): {
  sessionId: string | null;
  title: string | null;
  recentOutput: string | null;
  messageCount: number;
} {
  let sessionId: string | null = null;
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

    if (!sessionId && typeof entry.sessionId === "string") {
      sessionId = entry.sessionId;
    }

    let messagesToProcess: unknown[] = [];
    if (entry.$set && typeof entry.$set === "object" && Array.isArray((entry.$set as Record<string, unknown>).messages)) {
      messagesToProcess = (entry.$set as Record<string, unknown>).messages as unknown[];
    } else if (entry.type) {
      messagesToProcess = [entry];
    }

    for (const rawMsg of messagesToProcess) {
      if (rawMsg && typeof rawMsg === "object") {
        const msg = rawMsg as Record<string, unknown>;
        if (msg.type === "user") {
          messageCount += 1;
          if (!title) {
            const content = msg.content;
            if (Array.isArray(content) && content[0] && typeof content[0] === "object") {
              const text = (content[0] as Record<string, unknown>).text;
              if (typeof text === "string") {
                const trimmed = text.trim();
                if (trimmed && !NOISE_RE.test(trimmed)) {
                  title = trimmed.slice(0, 160);
                }
              }
            }
          }
        } else if (msg.type === "gemini") {
          const content = msg.content;
          if (typeof content === "string") {
            const trimmed = content.trim();
            if (trimmed) {
              recentOutput = trimmed.slice(0, 300);
            }
          }
        }
      }
    }
  }

  return { sessionId, title, recentOutput, messageCount };
}

export async function discoverExternalGeminiSessions(): Promise<ExternalGeminiSession[]> {
  const configRoots = [
    join(homedir(), ".gemini"),
    join(process.cwd(), ".omniharness/cli-home/gemini/.gemini"),
  ];

  const sessions: ExternalGeminiSession[] = [];
  const seenFiles = new Set<string>();

  for (const configRoot of configRoots) {
    const tmpDir = join(configRoot, "tmp");
    let projectDirs: string[];
    try {
      projectDirs = await readdir(tmpDir);
    } catch {
      continue;
    }

    const projectsMap = await getGeminiProjectsMap(configRoot);

    await Promise.all(
      projectDirs.map(async (dirName) => {
        const chatsDir = join(tmpDir, dirName, "chats");
        let entries: string[];
        try {
          entries = await readdir(chatsDir);
        } catch {
          return;
        }

        const filesToScan: string[] = [];
        await Promise.all(
          entries.map(async (entryName) => {
            const entryPath = join(chatsDir, entryName);
            let entryStat;
            try {
              entryStat = await stat(entryPath);
            } catch {
              return;
            }

            if (entryStat.isDirectory()) {
              let subEntries: string[];
              try {
                subEntries = await readdir(entryPath);
              } catch {
                return;
              }
              for (const subEntry of subEntries) {
                if (subEntry.endsWith(".jsonl")) {
                  filesToScan.push(join(entryPath, subEntry));
                }
              }
            } else if (entryName.endsWith(".jsonl")) {
              filesToScan.push(entryPath);
            }
          })
        );

        await Promise.all(
          filesToScan.map(async (filePath) => {
            if (seenFiles.has(filePath)) return;
            seenFiles.add(filePath);

            let fileStat;
            try {
              fileStat = await stat(filePath);
            } catch {
              return;
            }

            const headLines = await readHeadLines(filePath, 8192);
            let tailLines: string[] = [];
            if (fileStat.size > 8192) {
              tailLines = await readTailLines(filePath, fileStat.size, 8192);
            }

            const parsed = parseGeminiLines([...headLines, ...tailLines]);
            let sessionId = parsed.sessionId;
            if (!sessionId) {
              const base = basename(filePath, ".jsonl");
              const suffixMatch = base.match(/[-_]?([0-9a-f]{8})$/i);
              sessionId = suffixMatch ? suffixMatch[1] : base;
            }

            const projectNameLower = dirName.trim().toLowerCase();
            let projectPath = projectsMap[projectNameLower];
            if (!projectPath) {
              if (basename(process.cwd()).toLowerCase() === projectNameLower) {
                projectPath = process.cwd();
              } else {
                projectPath = dirName;
              }
            }

            sessions.push({
              sessionId,
              projectDir: dirName,
              projectPath,
              sessionFilePath: filePath,
              lastModified: fileStat.mtime,
              title: parsed.title,
              recentOutput: parsed.recentOutput,
              messageCount: parsed.messageCount,
            });
          })
        );
      })
    );
  }

  sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return sessions;
}

export async function isGlobalGeminiSession(sessionId: string): Promise<boolean> {
  const sessions = await discoverExternalGeminiSessions();
  const session = sessions.find((s) => s.sessionId === sessionId);
  if (!session) return false;
  return session.sessionFilePath.startsWith(join(homedir(), ".gemini"));
}
