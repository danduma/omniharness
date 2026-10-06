import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { HARNESS_PROMPT_PREAMBLES } from "@/server/conversations/harness-prompt-preambles";
import { buildInitialConversationTitle } from "@/server/conversations/initial-title";

/**
 * Longest title worth trusting from a provider.
 *
 * Nothing OmniHarness generates itself exceeds 80 characters, and no agent has
 * ever reported a title anywhere near that. Codex, though, reports its ACP
 * session title as the verbatim prompt it received, so the moment a prompt is
 * long the "title" is really the prompt — a 4KB one, in the case that motivated
 * this bound. Length is the reliable tell, because the harness cannot enumerate
 * every prompt shape a provider might echo back.
 */
const MAX_AGENT_TITLE_CHARS = 120;

/**
 * Codex collapses the prompt's newlines into spaces before echoing it, so the
 * multi-line preamble constants only match after the same normalisation.
 */
function normalizeForComparison(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

const HARNESS_PROMPT_MARKERS = HARNESS_PROMPT_PREAMBLES.map((preamble) =>
  normalizeForComparison(preamble.split("\n")[0] ?? preamble),
);

type AgentSessionTitleRejection = "prompt_leak" | "too_long" | "prompt_echo";

/**
 * Which of the provider's own stores the candidate came out of. Kept on both
 * the accept and the reject event so a conversation that never gets a title can
 * be traced to the source that stayed silent.
 */
export type AgentSessionTitleSource =
  | "agent_session"
  | "agent_transcript"
  | "agent_thread_index"
  | "provider_custom"
  | "provider_generated";

const TITLE_SOURCE_RANK: Record<string, number> = {
  initial: 0,
  harness_fallback: 1,
  agent_session: 2,
  provider_generated: 3,
  agent_transcript: 3,
  harness_llm: 4,
  agent_thread_index: 5,
  provider_custom: 6,
  manual: 100,
  legacy: 100,
};

export async function isConversationTitleOwningWorker(runId: string, workerId: string) {
  const owner = await db.select({ id: workers.id })
    .from(workers)
    .where(eq(workers.runId, runId))
    .orderBy(asc(workers.workerNumber), asc(workers.createdAt), asc(workers.id))
    .get();
  return !owner || owner.id === workerId;
}

/**
 * Why this title cannot be shown, judged on the text alone.
 */
function staticTitleRejection(title: string): AgentSessionTitleRejection | null {
  const normalized = normalizeForComparison(title);
  if (HARNESS_PROMPT_MARKERS.some((marker) => normalized.includes(marker))) {
    return "prompt_leak";
  }
  if (title.length > MAX_AGENT_TITLE_CHARS) {
    return "too_long";
  }
  return null;
}

/**
 * Whether the candidate is a prompt we sent, handed back as a title.
 *
 * The Codex ACP adapter publishes `createPromptFallbackTitle(prompt)` whenever
 * the thread has no name of its own, so a prompt short enough to clear the
 * length bound and free of any preamble arrives looking exactly like a real
 * title. Accepting it is worse than useless: the conversation keeps showing the
 * first line of what the user typed — which is what the untitled fallback
 * already shows — while `applied` tells the caller to stop looking, so a real
 * title sitting in the provider's own store never gets read.
 *
 * Only an exact match or a truncated one counts. A title that merely starts
 * with the same words as the prompt is what a good summary of a short request
 * looks like, and rejecting those would cost more than it saves.
 */
function isPromptEcho(title: string, prompts: readonly string[]) {
  const normalized = normalizeForComparison(title);
  const untruncated = normalized.replace(/(\.\.\.|…)$/, "").trim();
  return prompts.some((prompt) => {
    const normalizedPrompt = normalizeForComparison(prompt);
    if (!normalizedPrompt) {
      return false;
    }
    if (normalized === normalizedPrompt) {
      return true;
    }
    return untruncated !== normalized && untruncated.length > 0 && normalizedPrompt.startsWith(untruncated);
  });
}

/**
 * The prompts this run has sent, newest first — the pool a candidate could be
 * an echo of. Superseded messages count: a title published before a retry was
 * still an echo.
 */
async function runPromptTexts(runId: string) {
  const userMessages = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.runId, runId), eq(messages.role, "user")))
    .orderBy(asc(messages.createdAt))
    .all();

  const workerPrompts = await db
    .select({ initialPrompt: workers.initialPrompt })
    .from(workers)
    .where(eq(workers.runId, runId))
    .all();

  return [
    ...userMessages.map((message) => message.content),
    ...workerPrompts.map((worker) => worker.initialPrompt),
  ].filter((prompt) => prompt.trim().length > 0);
}

/**
 * Why this title cannot be shown, or null when it can be.
 */
async function agentSessionTitleRejection(
  runId: string,
  title: string,
): Promise<AgentSessionTitleRejection | null> {
  const staticRejection = staticTitleRejection(title);
  if (staticRejection) {
    return staticRejection;
  }
  // Deliberately last: it is the only check that costs a query.
  return isPromptEcho(title, await runPromptTexts(runId)) ? "prompt_echo" : null;
}

/**
 * The title the agent chose for its own session.
 *
 * ACP adapters may report this as a `session_info_update`, which
 * `normalizeSessionUpdate` flattens to
 * `{ type: "session_info", text: update.title ?? update.updatedAt ?? "", raw }`.
 * Until now nothing consumed it: the entry was appended to the worker output
 * and rendered as low-signal protocol noise, while the conversation title came
 * from a separate LLM call that re-summarised the user's first message.
 *
 * Read the title out of `raw` rather than `text` — `text` falls back to the
 * update's timestamp when no title was sent, so trusting it would put a date
 * in the sidebar. The newest titled update wins; an untitled one that follows
 * it is not a retraction.
 */
export function extractAgentSessionTitle(
  entries: readonly unknown[] | null | undefined,
): string | null {
  if (!Array.isArray(entries)) {
    return null;
  }

  let latest: string | null = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const { type, raw } = entry as { type?: unknown; raw?: unknown };
    if (type !== "session_info" || !raw || typeof raw !== "object") {
      continue;
    }
    const candidate = (raw as { title?: unknown }).title;
    if (typeof candidate !== "string") {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed) {
      latest = trimmed;
    }
  }
  return latest;
}

/**
 * Adopt the agent's title for the conversation.
 *
 * `"rejected"` is distinct from `"unchanged"` so a caller that has a second
 * source for the title knows the first one was thrown away and it is worth
 * asking the next one.
 */
export async function applyAgentSessionTitle(args: {
  runId: string;
  title: string;
  source?: AgentSessionTitleSource;
  workerId?: string;
  knownProviderPrompt?: string | null;
}): Promise<"applied" | "unchanged" | "rejected"> {
  const title = args.title.trim();
  if (!title) {
    return "rejected";
  }

  const source = args.source ?? "agent_session";
  const run = await db.select({
    title: runs.title,
    titleOwnership: runs.titleOwnership,
    titleSource: runs.titleSource,
    titleRevision: runs.titleRevision,
    titleOwnerWorkerId: runs.titleOwnerWorkerId,
  }).from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || run.titleOwnership !== "automatic") return "unchanged";
  if (args.workerId) {
    if (run.titleOwnerWorkerId && run.titleOwnerWorkerId !== args.workerId) return "unchanged";
    if (!await isConversationTitleOwningWorker(args.runId, args.workerId)) return "unchanged";
  }
  if ((TITLE_SOURCE_RANK[source] ?? 0) < (TITLE_SOURCE_RANK[run.titleSource] ?? 0)) {
    return "unchanged";
  }
  const rejection = await agentSessionTitleRejection(args.runId, title);
  const normalizedProviderPrompt = normalizeForComparison(args.knownProviderPrompt ?? "");
  const normalizedTitle = normalizeForComparison(title);
  const providerPrefixEcho = normalizedProviderPrompt.length > normalizedTitle.length
    && normalizedProviderPrompt.startsWith(normalizedTitle);
  if (rejection || providerPrefixEcho) {
    emitNamedEvent({
      kind: "conversation.title_rejected",
      runId: args.runId,
      source,
      reason: rejection ?? "prompt_echo",
      titleLength: title.length,
      titlePreview: title.slice(0, 120),
    });
    return "rejected";
  }
  if ((run.title ?? "").trim() === title) {
    return "unchanged";
  }

  const updated = await db.update(runs).set({
    title,
    titleSource: source,
    titleRevision: run.titleRevision + 1,
    ...(args.workerId ? { titleOwnerWorkerId: args.workerId } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(runs.id, args.runId),
    eq(runs.titleOwnership, "automatic"),
    eq(runs.titleRevision, run.titleRevision),
    args.workerId
      ? or(isNull(runs.titleOwnerWorkerId), eq(runs.titleOwnerWorkerId, args.workerId))
      : undefined,
  )).returning({ revision: runs.titleRevision }).get();
  if (!updated) return "unchanged";
  emitNamedEvent({
    kind: "conversation.title_updated",
    runId: args.runId,
    source,
    title,
    revision: updated.revision,
    workerId: args.workerId,
  });
  notifyEventStreamSubscribers();
  return "applied";
}

/**
 * The title the conversation would have shown had the echoed prompt never
 * arrived: its first surviving user message, the same text `create` titles a
 * new conversation from.
 */
async function titleFromFirstUserMessage(runId: string) {
  const first = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(
      eq(messages.runId, runId),
      eq(messages.role, "user"),
      isNull(messages.supersededAt),
      or(
        isNull(messages.kind),
        sql`lower(${messages.kind}) not in ('internal', 'intervention')`,
      ),
    ))
    .orderBy(asc(messages.createdAt))
    .get();

  return buildInitialConversationTitle(first?.content ?? "");
}

/**
 * Put back the titles that were poisoned before the guard existed.
 *
 * `applyAgentSessionTitle` only filters writes, so it cannot help a run that
 * was already poisoned: Codex keeps echoing the prompt rather than summarising
 * it, so no clean title ever arrives to overwrite the garbage, and a 4KB
 * preamble sits in the sidebar forever. The rejection is also silent by
 * design — a rejected candidate leaves the stored title untouched, which is
 * right when that title is good and wrong when it is the leak itself.
 *
 * Runs at boot, where the orphaned-delivery reclaim already lives, because the
 * damaged rows are historical and a sweep per write would cost far more than
 * it repairs.
 */
export async function repairLeakedConversationTitles(): Promise<number> {
  const candidates = await db
    .select({ id: runs.id, title: runs.title, revision: runs.titleRevision })
    .from(runs)
    .where(and(
      eq(runs.titleOwnership, "automatic"),
      or(
        sql`length(${runs.title}) > ${MAX_AGENT_TITLE_CHARS}`,
        ...HARNESS_PROMPT_MARKERS.map((marker) => like(sql`lower(${runs.title})`, `%${marker}%`)),
      ),
    ))
    .all();

  let repaired = 0;
  for (const candidate of candidates) {
    const stored = (candidate.title ?? "").trim();
    // The SQL above is a prefilter — `length()` counts bytes rather than
    // characters, so the real verdict is the guard the writes use. Only the
    // text-only half of it: a stored title that echoes a prompt already reads
    // as the untitled fallback, so rewriting it would change nothing.
    if (!stored || !staticTitleRejection(stored)) {
      continue;
    }

    const title = await titleFromFirstUserMessage(candidate.id);
    const updated = await db.update(runs).set({
      title,
      titleSource: "leak_repair",
      titleRevision: candidate.revision + 1,
    }).where(and(
      eq(runs.id, candidate.id),
      eq(runs.titleOwnership, "automatic"),
      eq(runs.titleRevision, candidate.revision),
    )).returning({ revision: runs.titleRevision }).get();
    if (!updated) continue;
    emitNamedEvent({
      kind: "conversation.title_updated",
      runId: candidate.id,
      source: "leak_repair",
      title,
      revision: updated.revision,
    });
    repaired += 1;
  }

  if (repaired > 0) {
    notifyEventStreamSubscribers();
  }
  return repaired;
}
