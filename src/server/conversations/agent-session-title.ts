import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs } from "@/server/db/schema";
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

type AgentSessionTitleRejection = "prompt_leak" | "too_long";

/**
 * Why this title cannot be shown, or null when it can be.
 */
function agentSessionTitleRejection(title: string): AgentSessionTitleRejection | null {
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
 * The title the agent chose for its own session.
 *
 * Claude Code reports this over ACP as a `session_info_update`, which
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
}): Promise<"applied" | "unchanged" | "rejected"> {
  const title = args.title.trim();
  if (!title) {
    return "rejected";
  }

  const rejection = agentSessionTitleRejection(title);
  if (rejection) {
    emitNamedEvent({
      kind: "conversation.title_rejected",
      runId: args.runId,
      source: "agent_session",
      reason: rejection,
      titleLength: title.length,
      titlePreview: title.slice(0, 120),
    });
    return "rejected";
  }

  const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || (run.title ?? "").trim() === title) {
    return "unchanged";
  }

  await db.update(runs).set({ title, updatedAt: new Date() }).where(eq(runs.id, args.runId));
  emitNamedEvent({
    kind: "conversation.title_updated",
    runId: args.runId,
    source: "agent_session",
    title,
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
    .select({ id: runs.id, title: runs.title })
    .from(runs)
    .where(or(
      sql`length(${runs.title}) > ${MAX_AGENT_TITLE_CHARS}`,
      ...HARNESS_PROMPT_MARKERS.map((marker) => like(sql`lower(${runs.title})`, `%${marker}%`)),
    ))
    .all();

  let repaired = 0;
  for (const candidate of candidates) {
    const stored = (candidate.title ?? "").trim();
    // The SQL above is a prefilter — `length()` counts bytes rather than
    // characters, so the real verdict is the guard the writes use.
    if (!stored || !agentSessionTitleRejection(stored)) {
      continue;
    }

    const title = await titleFromFirstUserMessage(candidate.id);
    await db.update(runs).set({ title }).where(eq(runs.id, candidate.id));
    emitNamedEvent({
      kind: "conversation.title_updated",
      runId: candidate.id,
      source: "leak_repair",
      title,
    });
    repaired += 1;
  }

  if (repaired > 0) {
    notifyEventStreamSubscribers();
  }
  return repaired;
}
