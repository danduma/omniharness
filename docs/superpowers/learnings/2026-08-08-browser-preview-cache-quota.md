# Browser Preview Caches Must Not Compete With Preferences

**Date:** 2026-08-08  
**Context:** OmniHarness web-interface localStorage persistence  
**Symptom:** Rendering failed while persisting a tiny composer-effort value, followed by a visible failure to persist project-group navigation state. Reloading did not recover the session.  
**Root Cause:** Event snapshots and worker transcript previews were persisted as multi-megabyte localStorage envelopes. Their failed writes did not evict the already-occupied cache data, while several preference writes were not quota-safe.  
**Fix:** Production defaults for event-snapshot and worker-transcript preview managers are now memory-only. Startup and reload remove legacy disposable preview keys, and small browser writes clear only those disposable keys before retrying once. Transactional runner-profile persistence retains its original reject-and-rollback semantics.  
**Verification:** Browser-storage regression tests cover memory-only defaults, targeted quota cleanup, and a still-full origin. Focused app/UI/state tests passed (169 tests); `pnpm typecheck` passed.  
**Prevention:** Treat localStorage as a small settings store. Server/SSE state remains authoritative, preview bodies must be bounded and disposable, and preview caches must never crowd out credentials or user preferences. Keep quota failures covered with a fake Storage implementation.  
**Skill/Doc Updates:** Updated `docs/architecture/frontend-state-and-rendering.md` to document server-authoritative state and memory-only preview bodies. No generic skill update was needed.
