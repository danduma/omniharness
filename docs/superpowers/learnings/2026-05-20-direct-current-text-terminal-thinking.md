# Direct Current Text Must Mean Live Work

**Date:** 2026-05-20
**Context:** OmniHarness direct-control conversations and unified worker stream
**Symptom:** Session `a463020eb4ef` showed final CLI output but still rendered a trailing "Thinking..." indicator. Earlier reloads could also briefly show no output or hide the session before the full transcript appeared.
**Root Cause:** The runtime completed the prompt by setting the agent to `idle` and copying `currentText` into `lastText`, but it did not clear `currentText`. The frontend treats non-empty `currentText` as live work. Separately, duplicate stable worker entries could re-emit old `worker.entry_appended` wake-ups, so a seq gap could be observed while an older fetch was in flight.
**Fix:** Runtime completion now clears `currentText`; direct terminal sync removes stale `currentText` from terminal idle workers; stream-writer wake events are emitted only for newly appended entries; and `WorkerEntriesManager` retries when any useful wake-up arrives during an in-flight fetch while the contiguous cursor still trails the known cursor.
**Verification:** `pnpm exec vitest run tests/app/worker-entries-manager.test.ts tests/server/agent-runtime/http.test.ts tests/server/conversations-sync.test.ts tests/server/workers/output-store.test.ts --pool=forks --poolOptions.forks.singleFork=true`
**Prevention:** Never publish a terminal/idle state with live-current fields populated. For append-only streams, deduped writes must not re-announce old seqs; wake-up events are edge hints and must not become contradictory ordering evidence.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` because this is another reusable client/server state invariant, not a one-off UI artifact.
