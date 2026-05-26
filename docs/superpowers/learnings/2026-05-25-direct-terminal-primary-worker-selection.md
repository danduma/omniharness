# Direct Terminal Primary Worker Selection

**Date:** 2026-05-25
**Context:** OmniHarness direct-control conversations using the unified worker stream.
**Symptom:** A direct conversation could show only user checkpoint bubbles while worker output looked missing, even though worker JSONL streams still existed on disk.
**Root Cause:** When every worker in a direct run was terminal/cancelled, the frontend selected the first agent snapshot as the primary terminal worker. In respawned conversations, that can be the original empty worker, while later cancelled workers contain the actual persisted transcript.
**Fix:** Direct primary-worker selection now prefers non-cancelled active workers first, then non-cancelled workers, then the newest cancelled worker with readable persisted output.
**Verification:** `pnpm test tests/lib/conversation-workers.test.ts` passed. A real-session check with `readWorkerLatestSeq` returned seqs `2`, `256`, and `92` for `2182b07381c8` workers 1-3, proving the hidden worker streams are readable from disk.
**Prevention:** For direct conversations, never assume the first worker owns the visible terminal after respawn, cancellation, or recovery. Selection must be based on active ownership first and readable persisted output second.
**Skill/Doc Updates:** No general skill update needed; the repo-level learning note captures the local invariant for this product surface.
