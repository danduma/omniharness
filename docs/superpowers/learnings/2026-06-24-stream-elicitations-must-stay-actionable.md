# Stream Elicitations Must Stay Actionable

**Date:** 2026-06-24
**Context:** OmniHarness direct worker conversations, unified worker stream, Claude `AskUserQuestion`
**Symptom:** Session `157c26683999` showed Claude's "Asking for your input" activity in the worker stream, but the frontend did not show an actionable ask form.
**Root Cause:** `/api/events` intentionally strips `agent.outputEntries` after the unified worker stream migration, while `WorkerCard` rendered its elicitation control only from live `agent.pendingElicitations`. When the durable stream contained a pending `elicitation` entry but the live snapshot did not carry `pendingElicitations`, the question was visible as terminal activity but not promoted into actionable UI state.
**Fix:** Derive pending elicitations from unified worker stream entries, remove them when later terminal rows for the same `requestId` arrive, and merge them into `WorkerCard`'s actionable pending elicitation list behind live bridge metadata.
**Verification:** `pnpm vitest run tests/app/worker-elicitations.test.ts tests/app/direct-control-activity.test.ts tests/app/conversation-execution-status.test.ts`; `pnpm exec eslint src/app/home/worker-elicitations.ts src/components/WorkerCard.tsx tests/app/worker-elicitations.test.ts`; `git diff --check`. Full `pnpm exec tsc --noEmit` is still blocked by the unrelated existing `tests/app/home-utils.test.ts` `runMode` type error.
**Prevention:** Any UI that renders or acts on worker input requests must consume the unified worker stream as an authoritative fallback, not only live `/api/events` agent metadata. If content moved out of the snapshot, every state classifier and action surface that depended on that content needs a stream-backed replacement.
**Skill/Doc Updates:** No general skill update needed; this reinforces the existing worker-conversation-stream and client/server state invariant rules.
