# Capped Transcript Cursors Must Track Consumed Rows

**Date:** 2026-06-14
**Context:** OmniHarness direct-control conversation transcript pagination
**Symptom:** Recent direct-control Claude Code conversations could show clipped final output in the client, usually missing a sentence or two at a seemingly random boundary.
**Root Cause:** `/api/conversations/:runId/transcript` called `readWorkerEntriesSince`, whose forward reads can cap large pages at 200 entries, then encoded the next per-worker cursor as the file's latest seq. When more than 200 worker stream rows arrived between transcript polls, the client advanced past rows it had not received.
**Fix:** The transcript route now advances each worker cursor to the highest seq actually returned when a page contains entries. Empty pages still advance to the known latest seq for the caught-up fast path.
**Verification:** `./node_modules/.bin/vitest run tests/api/conversation-transcript-route.test.ts tests/app/conversation-transcript-pipeline.test.ts tests/app/worker-entries-manager.test.ts --pool=forks --poolOptions.forks.singleFork=true` under Node 22 passed: 27 tests.
**Prevention:** For capped or partial stream endpoints, separate "known latest" from "consumed cursor." A replay token may only acknowledge rows that were actually delivered to the client unless the response explicitly proves no rows remain.
**Skill/Doc Updates:** No global skill update needed; `client-server-state-invariants` already requires payload completeness and ordering, and this repo note captures the concrete OmniHarness transcript endpoint failure mode.
