import { open, readdir, stat } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

/**
 * The title Claude Code generated for its own session.
 *
 * The CLI appends `{"type":"ai-title","aiTitle":"…","sessionId":"…"}` to its
 * session transcript and rewrites it as the work changes shape — the same
 * string it pushes to the terminal title bar. The escape sequence is
 * ephemeral, but the record is durable, so the transcript is the readable
 * source. OmniHarness used to pay a separate supervisor LLM call to
 * re-summarise the user's first message instead; this is both better and free.
 *
 * `session_info_update` (the ACP route) would be the obvious channel, but
 * Claude Code does not send it: zero occurrences across ~135k captured stream
 * entries, while rarer kinds like `config_option` and `available_commands`
 * arrive normally.
 */

/**
 * Only the end of the transcript is read: these files reach several megabytes
 * and this runs on every worker snapshot persist. Across every transcript on
 * a real machine the newest title sat within 32KB of EOF, so this is ~8x the
 * observed worst case.
 */
const TAIL_BYTES = 256 * 1024;

const titleCache = new Map<string, { size: number; title: string | null }>();

export function __resetAgentTranscriptTitleCacheForTests() {
  titleCache.clear();
}

export function extractLatestAiTitle(text: string): string | null {
  let latest: string | null = null;
  for (const line of text.split("\n")) {
    // A tail read starts mid-record, and unparseable lines are expected.
    if (!line.startsWith("{") || !line.includes("\"ai-title\"")) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object") {
      continue;
    }
    const record = parsed as { type?: unknown; aiTitle?: unknown };
    if (record.type !== "ai-title" || typeof record.aiTitle !== "string") {
      continue;
    }
    const trimmed = record.aiTitle.trim();
    if (trimmed) {
      latest = trimmed;
    }
  }
  return latest;
}

function claudeProjectsDir(configDir?: string) {
  const root = configDir?.trim() || process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude");
  return join(root, "projects");
}

/**
 * Claude Code names the project directory after the cwd with separators
 * replaced, which is the fast path. That encoding is not a contract, so a miss
 * falls back to locating the file by session id — a uuid, and therefore
 * unambiguous across projects.
 */
async function resolveTranscriptPath(args: { sessionId: string; cwd: string; configDir?: string }) {
  const projectsDir = claudeProjectsDir(args.configDir);
  const fileName = `${args.sessionId}.jsonl`;
  const direct = join(projectsDir, args.cwd.replace(/\//g, "-"), fileName);
  try {
    await stat(direct);
    return direct;
  } catch {
    // Fall through to the scan.
  }

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return null;
  }

  for (const dirName of projectDirs) {
    const candidate = join(projectsDir, dirName, fileName);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function readTail(path: string, size: number) {
  const start = Math.max(0, size - TAIL_BYTES);
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function readAgentSessionTitleFromTranscript(args: {
  sessionId: string;
  cwd: string;
  configDir?: string;
}): Promise<string | null> {
  const path = await resolveTranscriptPath(args);
  if (!path) {
    return null;
  }

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return null;
  }

  // The transcript only grows, so an unchanged size means an unchanged title.
  const cached = titleCache.get(path);
  if (cached && cached.size === size) {
    return cached.title;
  }

  let title: string | null = null;
  try {
    title = extractLatestAiTitle(await readTail(path, size));
  } catch {
    return cached?.title ?? null;
  }

  // A grown file whose tail no longer carries a title has not lost the one it
  // already reported.
  const resolved = title ?? cached?.title ?? null;
  titleCache.set(path, { size, title: resolved });
  return resolved;
}
