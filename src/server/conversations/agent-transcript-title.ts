import { open, readdir, stat } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

/**
 * The title Claude Code recorded for its own session.
 *
 * Two records can carry one. `{"type":"custom-title","customTitle":"…"}` is
 * what the user typed at `/rename`, and it outranks everything else because it
 * is the only title anyone asked for explicitly. `{"type":"ai-title","aiTitle":
 * "…","sessionId":"…"}` is the one the CLI generates and revises as the work
 * changes shape. Interactive sessions produce it; ACP-spawned sessions do not
 * reliably do so, so this reader is opportunistic and a null result is the
 * normal case rather than a fault.
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

const TITLE_RECORDS = [
  { type: "custom-title", field: "customTitle" },
  { type: "ai-title", field: "aiTitle" },
] as const;

/**
 * The last title of each kind in the text. A later untitled record is not a
 * retraction, and a rename is not undone by the generator running again, so
 * each kind is tracked independently and ranked by the caller.
 */
export function extractLatestTranscriptTitles(text: string) {
  const latest: { customTitle: string | null; aiTitle: string | null } = {
    customTitle: null,
    aiTitle: null,
  };

  for (const line of text.split("\n")) {
    // A tail read starts mid-record, and unparseable lines are expected.
    if (!line.startsWith("{")) {
      continue;
    }
    const record = TITLE_RECORDS.find((candidate) => line.includes(`"${candidate.type}"`));
    if (!record) {
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
    const fields = parsed as { type?: unknown; customTitle?: unknown; aiTitle?: unknown };
    if (fields.type !== record.type) {
      continue;
    }
    const value = fields[record.field];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      latest[record.field] = trimmed;
    }
  }

  return latest;
}

export function extractLatestAiTitle(text: string): string | null {
  const { customTitle, aiTitle } = extractLatestTranscriptTitles(text);
  return customTitle ?? aiTitle;
}

function claudeProjectsDirs(args: { configDir?: string; configDirs?: readonly string[] }) {
  const roots = [
    args.configDir,
    ...(args.configDirs ?? []),
    process.env.CLAUDE_CONFIG_DIR,
    join(homedir(), ".claude"),
  ]
    .map((root) => root?.trim())
    .filter((root): root is string => Boolean(root));
  return [...new Set(roots)].map((root) => join(root, "projects"));
}

/**
 * Claude Code names the project directory after the cwd with separators
 * replaced, which is the fast path. That encoding is not a contract, so a miss
 * falls back to locating the file by session id — a uuid, and therefore
 * unambiguous across projects and across config dirs.
 */
async function resolveTranscriptPath(args: {
  sessionId: string;
  cwd: string;
  configDir?: string;
  configDirs?: readonly string[];
}) {
  const fileName = `${args.sessionId}.jsonl`;
  for (const projectsDir of claudeProjectsDirs(args)) {
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
      continue;
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
  configDirs?: readonly string[];
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
