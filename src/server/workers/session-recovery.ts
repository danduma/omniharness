import { createHash, randomUUID } from "crypto";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { isBridgeOutputEntry, type WorkerEntry } from "@/server/workers/entries-types";
import { readWorkerOutputEntries } from "@/server/workers/output-store";

const MAX_TRANSCRIPT_REPLAY_CHARS = 24_000;
const execFileAsync = promisify(execFile);

export function isRejectedSavedSessionErrorMessage(value: string | null | undefined) {
  return /\b(invalid session identifier|session not found|no previous sessions found|failed to load resumed session data from file|no conversation found|not found|could not find session|unknown session)\b/i.test(value ?? "");
}

export async function workerHasProviderTranscript(runId: string, workerId: string) {
  const entries = await readWorkerOutputEntries(runId, workerId);
  return entries.some((entry) => isBridgeOutputEntry(entry as WorkerEntry));
}

export async function canRecreateRejectedSavedSession(runId: string, workerId: string) {
  return !(await workerHasProviderTranscript(runId, workerId));
}

function formatTranscriptEntry(entry: WorkerEntry) {
  const text = entry.text?.trim();
  if (!text) {
    return null;
  }

  if (entry.type === "user_input" || entry.type === "supervisor_input") {
    return `User: ${text}`;
  }
  if (entry.type === "message") {
    return `Assistant: ${text}`;
  }
  if (entry.type === "thought") {
    return `Assistant thought: ${text}`;
  }
  if (entry.type === "tool_call" || entry.type === "tool_call_update") {
    const status = entry.status ? ` ${entry.status}` : "";
    return `Tool ${entry.toolKind ?? entry.type}${status}: ${text}`;
  }
  return `${entry.type}: ${text}`;
}

export async function buildTranscriptReplayPrompt(args: {
  runId: string;
  workerId: string;
  nextUserPrompt: string;
}) {
  const entries = await readWorkerOutputEntries(args.runId, args.workerId);
  const transcript = entries
    .map((entry) => formatTranscriptEntry(entry as WorkerEntry))
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
  const trimmedTranscript = transcript.length > MAX_TRANSCRIPT_REPLAY_CHARS
    ? transcript.slice(-MAX_TRANSCRIPT_REPLAY_CHARS)
    : transcript;

  return [
    "You are continuing an OmniHarness direct-control worker turn after the provider ACP session could not be resumed.",
    "The authoritative conversation transcript captured by OmniHarness is below. Treat it as prior context, do not repeat completed work, and continue from the latest useful point.",
    "",
    "Saved transcript:",
    trimmedTranscript || "(No transcript text was captured.)",
    "",
    "Next user prompt:",
    args.nextUserPrompt,
  ].join("\n");
}

export function parseGeminiSearchedChatsDir(value: string | null | undefined) {
  const match = String(value ?? "").match(/Searched for sessions in ([^\n]+?)(?:\.|\n|$)/);
  return match?.[1]?.trim() || null;
}

async function inferGeminiProjectName(cwd: string, geminiConfigRoot: string) {
  try {
    const projectsPath = path.join(geminiConfigRoot, "projects.json");
    const raw = await fs.readFile(projectsPath, "utf8");
    const parsed = JSON.parse(raw) as { projects?: Record<string, string> };
    const projectName = parsed.projects?.[cwd]?.trim();
    if (projectName) {
      return projectName;
    }
  } catch {
    // Fall back to the same basename-shaped directory Gemini creates for
    // ordinary project homes when the mapping file is absent or incomplete.
  }
  return path.basename(cwd) || "default";
}

async function inferGeminiChatsDir(args: MaterializeArgs) {
  const searchedDir = parseGeminiSearchedChatsDir(args.errorMessage);
  if (searchedDir) {
    return searchedDir;
  }

  const cliHome = args.env?.GEMINI_CLI_HOME?.trim();
  const configRoot = cliHome ? path.join(cliHome, ".gemini") : defaultHomeDir(".gemini");
  const projectName = await inferGeminiProjectName(args.cwd, configRoot);
  return path.join(configRoot, "tmp", projectName, "chats");
}

type ProviderType = "gemini" | "codex" | "claude" | "opencode";

type MaterializeArgs = {
  type: string;
  runId: string;
  workerId: string;
  sessionId: string;
  cwd: string;
  errorMessage?: string | null;
  env?: Record<string, string | undefined>;
};

type MaterializedSession = {
  provider: ProviderType;
  filePath: string;
  messageCount: number;
};

type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  kind: WorkerEntry["type"];
};

function materializableMessages(entries: WorkerEntry[]): TranscriptMessage[] {
  return entries
    .map((entry): TranscriptMessage | null => {
      const text = entry.text?.trim();
      if (!text) return null;
      if (entry.type === "user_input" || entry.type === "supervisor_input") {
        return { id: entry.id || randomUUID(), role: "user" as const, text, timestamp: entry.timestamp, kind: entry.type };
      }
      if (entry.type === "message") {
        return { id: entry.id || randomUUID(), role: "assistant" as const, text, timestamp: entry.timestamp, kind: entry.type };
      }
      if (entry.type === "thought") {
        return { id: entry.id || randomUUID(), role: "assistant" as const, text, timestamp: entry.timestamp, kind: entry.type };
      }
      return null;
    })
    .filter((message): message is TranscriptMessage => Boolean(message));
}

function safeIsoTimestamp(value: string | null | undefined) {
  const parsed = new Date(value ?? "");
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function millisTimestamp(value: string | null | undefined) {
  return new Date(safeIsoTimestamp(value)).getTime();
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function defaultHomeDir(name: string) {
  return path.join(os.homedir(), name);
}

function geminiProjectHash(cwd: string) {
  return createHash("sha256").update(cwd).digest("hex");
}

function geminiSessionFileTimestamp(timestamp: string) {
  const parsed = new Date(timestamp);
  const value = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return value.toISOString().replace(/\.\d{3}Z$/, "Z").replaceAll(":", "-").replace(/Z$/, "");
}

function geminiMessageFromWorkerEntry(entry: WorkerEntry) {
  const text = entry.text?.trim();
  if (!text) {
    return null;
  }
  if (entry.type === "user_input" || entry.type === "supervisor_input") {
    return {
      id: entry.id || randomUUID(),
      timestamp: entry.timestamp,
      type: "user",
      content: [{ text }],
    };
  }
  if (entry.type === "message") {
    return {
      id: entry.id || randomUUID(),
      timestamp: entry.timestamp,
      type: "gemini",
      content: text,
      thoughts: [],
    };
  }
  if (entry.type === "thought") {
    return {
      id: entry.id || randomUUID(),
      timestamp: entry.timestamp,
      type: "gemini",
      content: "",
      thoughts: [{
        subject: "Recovered thought",
        description: text,
        timestamp: entry.timestamp,
      }],
    };
  }
  return null;
}

export async function materializeGeminiSessionFromWorkerStream(args: {
  runId: string;
  workerId: string;
  sessionId: string;
  cwd: string;
  chatsDir: string;
}) {
  const entries = await readWorkerOutputEntries(args.runId, args.workerId);
  const messages = entries
    .map((entry) => geminiMessageFromWorkerEntry(entry as WorkerEntry))
    .filter((message): message is NonNullable<typeof message> => Boolean(message));
  if (messages.length === 0) {
    return null;
  }

  const firstTimestamp = messages[0]?.timestamp ?? new Date().toISOString();
  const lastTimestamp = messages.at(-1)?.timestamp ?? firstTimestamp;
  const metadata = {
    sessionId: args.sessionId,
    projectHash: geminiProjectHash(args.cwd),
    startTime: firstTimestamp,
    lastUpdated: lastTimestamp,
    kind: "main",
  };
  const shortId = args.sessionId.slice(0, 8);
  const fileName = `session-${geminiSessionFileTimestamp(firstTimestamp)}-omniharness-${shortId}.jsonl`;
  const filePath = path.join(args.chatsDir, fileName);
  const setLastUpdated = { $set: { lastUpdated: lastTimestamp } };
  const lines = [
    JSON.stringify(metadata),
    ...messages.map((message) => JSON.stringify(message)),
    JSON.stringify(setLastUpdated),
  ];
  await fs.mkdir(args.chatsDir, { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  return {
    provider: "gemini" as const,
    filePath,
    messageCount: messages.length,
  };
}

function parseCodexRolloutPath(value: string | null | undefined) {
  const text = String(value ?? "");
  const quoted = text.match(/(?:rollout_path|from file|file)\s*[:=]?\s*["']([^"'\n]+\.jsonl)["']/i);
  if (quoted?.[1]) return quoted[1].trim();
  const bare = text.match(/(\/[^\s"']*rollout-[^\s"']+\.jsonl)/i);
  return bare?.[1]?.trim() || null;
}

function codexHome(env: Record<string, string | undefined> | undefined) {
  return env?.CODEX_HOME?.trim() || defaultHomeDir(".codex");
}

function codexSqliteHome(env: Record<string, string | undefined> | undefined) {
  return env?.CODEX_SQLITE_HOME?.trim() || codexHome(env);
}

function codexRolloutPath(args: MaterializeArgs, firstTimestamp: string) {
  const explicit = parseCodexRolloutPath(args.errorMessage);
  if (explicit) return explicit;
  const date = new Date(firstTimestamp);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const stamp = firstTimestamp.replace(/\.\d{3}Z$/, "Z").replaceAll(":", "-").replace(/Z$/, "");
  return path.join(codexHome(args.env), "sessions", year, month, day, `rollout-${stamp}-${sanitizeFilename(args.sessionId)}.jsonl`);
}

function codexResponseItem(message: TranscriptMessage) {
  return {
    timestamp: safeIsoTimestamp(message.timestamp),
    type: "response_item",
    payload: {
      type: "message",
      role: message.role,
      content: [{ type: message.role === "user" ? "input_text" : "output_text", text: message.text }],
    },
  };
}

function sqlString(value: string | null | undefined) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

async function upsertCodexThreadMetadata(args: MaterializeArgs, rolloutPath: string, messages: TranscriptMessage[]) {
  const sqliteHome = codexSqliteHome(args.env);
  const dbPath = path.join(sqliteHome, "state_5.sqlite");
  const firstTimestamp = safeIsoTimestamp(messages[0]?.timestamp);
  const lastTimestamp = safeIsoTimestamp(messages.at(-1)?.timestamp);
  const firstMs = Math.floor(new Date(firstTimestamp).getTime() / 1000);
  const lastMs = Math.floor(new Date(lastTimestamp).getTime() / 1000);
  const firstUserMessage = messages.find((message) => message.role === "user")?.text ?? "";
  try {
    const sql = `CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        rollout_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT NOT NULL,
        sandbox_policy TEXT NOT NULL,
        approval_mode TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        has_user_event INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        git_sha TEXT,
        git_branch TEXT,
        git_origin_url TEXT,
        cli_version TEXT NOT NULL DEFAULT '',
        first_user_message TEXT NOT NULL DEFAULT '',
        agent_nickname TEXT,
        agent_role TEXT,
        memory_mode TEXT NOT NULL DEFAULT 'enabled',
        model TEXT,
        reasoning_effort TEXT,
        agent_path TEXT,
        created_at_ms INTEGER,
        updated_at_ms INTEGER,
        thread_source TEXT,
        preview TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO threads (
        id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,
        sandbox_policy, approval_mode, tokens_used, has_user_event, archived, cli_version,
        first_user_message, memory_mode, created_at_ms, updated_at_ms, thread_source, preview
      ) VALUES (
        ${sqlString(args.sessionId)}, ${sqlString(rolloutPath)}, ${firstMs}, ${lastMs},
        'cli', 'openai', ${sqlString(args.cwd)}, 'Recovered OmniHarness session',
        'danger-full-access', 'never', 0, ${firstUserMessage ? 1 : 0}, 0, 'omniharness-recovered',
        ${sqlString(firstUserMessage)}, 'enabled', ${new Date(firstTimestamp).getTime()}, ${new Date(lastTimestamp).getTime()},
        'omniharness', ${sqlString(firstUserMessage)}
      ) ON CONFLICT(id) DO UPDATE SET
        rollout_path = excluded.rollout_path,
        updated_at = excluded.updated_at,
        cwd = excluded.cwd,
        title = excluded.title,
        first_user_message = excluded.first_user_message,
        updated_at_ms = excluded.updated_at_ms,
        preview = excluded.preview;`;
    await execFileAsync("sqlite3", [dbPath, sql], { timeout: 5_000 });
  } catch {
    // The rollout file is still the authoritative recovery artifact. Older
    // Codex builds can recover from the JSONL alone; SQLite metadata only
    // improves lookup for builds that require the thread index.
  }
}

async function materializeCodexSession(args: MaterializeArgs, entries: WorkerEntry[]): Promise<MaterializedSession | null> {
  const messages = materializableMessages(entries);
  if (messages.length === 0) return null;
  const firstTimestamp = safeIsoTimestamp(messages[0]?.timestamp);
  const lastTimestamp = safeIsoTimestamp(messages.at(-1)?.timestamp);
  const filePath = codexRolloutPath(args, firstTimestamp);
  const meta = {
    timestamp: firstTimestamp,
    type: "session_meta",
    payload: {
      id: args.sessionId,
      timestamp: firstTimestamp,
      cwd: args.cwd,
      originator: "omniharness",
      cli_version: "omniharness-recovered",
      source: "cli",
      thread_source: "omniharness",
      model_provider: "openai",
      rollout_path: filePath,
    },
  };
  const turnContext = {
    timestamp: lastTimestamp,
    type: "turn_context",
    payload: {
      cwd: args.cwd,
      approval_policy: "never",
      sandbox_policy: { mode: "danger-full-access" },
      model: "gpt-5-codex",
      effort: "medium",
      summary: "auto",
    },
  };
  const lines = [JSON.stringify(meta), ...messages.map((message) => JSON.stringify(codexResponseItem(message))), JSON.stringify(turnContext)];
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.mkdir(codexSqliteHome(args.env), { recursive: true });
  await upsertCodexThreadMetadata(args, filePath, messages);
  const indexLine = JSON.stringify({ id: args.sessionId, thread_name: "Recovered OmniHarness session", updated_at: lastTimestamp });
  await fs.appendFile(path.join(codexHome(args.env), "session_index.jsonl"), `${indexLine}\n`, { encoding: "utf8" }).catch(() => undefined);
  return { provider: "codex", filePath, messageCount: messages.length };
}

function claudeProjectDir(cwd: string) {
  return cwd.replace(/[\\/]+/g, "-") || "-";
}

function claudeConfigDir(env: Record<string, string | undefined> | undefined) {
  return env?.CLAUDE_CONFIG_DIR?.trim() || defaultHomeDir(".claude");
}

function claudeEntry(message: TranscriptMessage, sessionId: string, cwd: string, parentUuid: string | null) {
  const uuid = randomUUID();
  if (message.role === "user") {
    return {
      parentUuid,
      isSidechain: false,
      type: "user",
      message: { role: "user", content: [{ type: "text", text: message.text }] },
      uuid,
      timestamp: safeIsoTimestamp(message.timestamp),
      userType: "external",
      entrypoint: "omniharness",
      cwd,
      sessionId,
      version: "omniharness-recovered",
    };
  }
  return {
    parentUuid,
    isSidechain: false,
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: message.kind === "thought" ? "thinking" : "text", [message.kind === "thought" ? "thinking" : "text"]: message.text }],
    },
    uuid,
    timestamp: safeIsoTimestamp(message.timestamp),
    userType: "external",
    entrypoint: "omniharness",
    cwd,
    sessionId,
    version: "omniharness-recovered",
  };
}

async function materializeClaudeSession(args: MaterializeArgs, entries: WorkerEntry[]): Promise<MaterializedSession | null> {
  const messages = materializableMessages(entries);
  if (messages.length === 0) return null;
  const filePath = path.join(claudeConfigDir(args.env), "projects", claudeProjectDir(args.cwd), `${sanitizeFilename(args.sessionId)}.jsonl`);
  const firstTimestamp = safeIsoTimestamp(messages[0]?.timestamp);
  const lines: string[] = [
    JSON.stringify({ type: "queue-operation", operation: "enqueue", timestamp: firstTimestamp, sessionId: args.sessionId }),
    JSON.stringify({ type: "queue-operation", operation: "dequeue", timestamp: firstTimestamp, sessionId: args.sessionId }),
  ];
  let parentUuid: string | null = null;
  for (const message of messages) {
    const entry = claudeEntry(message, args.sessionId, args.cwd, parentUuid);
    parentUuid = entry.uuid;
    lines.push(JSON.stringify(entry));
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  return { provider: "claude", filePath, messageCount: messages.length };
}

function opencodeStorageRoot(env: Record<string, string | undefined> | undefined) {
  const dataHome = env?.XDG_DATA_HOME?.trim() || path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "opencode", "storage");
}

function opencodeProjectId(cwd: string) {
  return createHash("sha1").update(cwd).digest("hex");
}

function opencodePart(message: TranscriptMessage, messageId: string, sessionId: string) {
  return {
    id: `prt_${message.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || randomUUID().replaceAll("-", "")}`,
    sessionID: sessionId,
    messageID: messageId,
    type: "text",
    text: message.text,
  };
}

async function materializeOpenCodeSession(args: MaterializeArgs, entries: WorkerEntry[]): Promise<MaterializedSession | null> {
  const messages = materializableMessages(entries);
  if (messages.length === 0) return null;
  const storageRoot = opencodeStorageRoot(args.env);
  const projectID = opencodeProjectId(args.cwd);
  const firstTimestamp = millisTimestamp(messages[0]?.timestamp);
  const lastTimestamp = millisTimestamp(messages.at(-1)?.timestamp);
  const sessionPath = path.join(storageRoot, "session", projectID, `${sanitizeFilename(args.sessionId)}.json`);
  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, `${JSON.stringify({
    id: args.sessionId,
    slug: "recovered-omniharness-session",
    version: "omniharness-recovered",
    projectID,
    directory: args.cwd,
    title: "Recovered OmniHarness session",
    time: { created: firstTimestamp, updated: lastTimestamp },
    summary: { additions: 0, deletions: 0, files: 0 },
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

  for (const message of messages) {
    const messageId = `msg_${message.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || randomUUID().replaceAll("-", "")}`;
    const messagePath = path.join(storageRoot, "message", args.sessionId, `${messageId}.json`);
    const partPath = path.join(storageRoot, "part", messageId, `${opencodePart(message, messageId, args.sessionId).id}.json`);
    await fs.mkdir(path.dirname(messagePath), { recursive: true });
    await fs.mkdir(path.dirname(partPath), { recursive: true });
    await fs.writeFile(messagePath, `${JSON.stringify({
      id: messageId,
      sessionID: args.sessionId,
      role: message.role,
      time: { created: millisTimestamp(message.timestamp), completed: millisTimestamp(message.timestamp) },
      agent: "build",
    }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.writeFile(partPath, `${JSON.stringify(opencodePart(message, messageId, args.sessionId), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  const diffPath = path.join(storageRoot, "session_diff", `${sanitizeFilename(args.sessionId)}.json`);
  await fs.mkdir(path.dirname(diffPath), { recursive: true });
  await fs.writeFile(diffPath, "[]\n", { encoding: "utf8", mode: 0o600 });
  return { provider: "opencode", filePath: sessionPath, messageCount: messages.length };
}

export async function materializeProviderSessionFromWorkerStream(args: MaterializeArgs): Promise<MaterializedSession | null> {
  const type = args.type as ProviderType;
  const entries = await readWorkerOutputEntries(args.runId, args.workerId) as WorkerEntry[];
  if (type === "gemini") {
    const chatsDir = await inferGeminiChatsDir(args);
    return materializeGeminiSessionFromWorkerStream({ ...args, chatsDir });
  }
  if (type === "codex") {
    return materializeCodexSession(args, entries);
  }
  if (type === "claude") {
    return materializeClaudeSession(args, entries);
  }
  if (type === "opencode") {
    return materializeOpenCodeSession(args, entries);
  }
  return null;
}
