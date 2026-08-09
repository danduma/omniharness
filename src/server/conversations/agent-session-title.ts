import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

const DIRECT_CONTROL_PROMPT_MARKER = "omniharness direct-control instruction";

function isPromptLeakTitle(title: string) {
  return title.toLowerCase().includes(DIRECT_CONTROL_PROMPT_MARKER);
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
 * Adopt the agent's title for the conversation. Returns whether the row
 * changed, so callers can skip the notify when nothing moved.
 */
export async function applyAgentSessionTitle(args: { runId: string; title: string }) {
  const title = args.title.trim();
  if (!title || isPromptLeakTitle(title)) {
    return false;
  }

  const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || (run.title ?? "").trim() === title) {
    return false;
  }

  await db.update(runs).set({ title, updatedAt: new Date() }).where(eq(runs.id, args.runId));
  emitNamedEvent({
    kind: "conversation.title_updated",
    runId: args.runId,
    source: "agent_session",
    title,
  });
  notifyEventStreamSubscribers();
  return true;
}
