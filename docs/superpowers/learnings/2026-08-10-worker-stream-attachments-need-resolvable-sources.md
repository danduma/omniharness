# Worker Stream Attachments Need Resolvable Sources

**Date:** 2026-08-10
**Context:** OmniHarness composer attachments and the unified worker conversation stream
**Symptom:** A pasted image showed a thumbnail in the composer, but the thumbnail disappeared from the human message after send.
**Root Cause:** The optimistic attachment carried a temporary `previewUrl`, while the persisted attachment carried a `storagePath`. Worker-stream attachment descriptors dropped `storagePath`, so the authoritative stream-backed message had no source from which the thumbnail URL manager could load the image.
**Fix:** Added `storagePath` to `WorkerEntryAttachment`, preserved it on every user-input stream write path (initial send, follow-up, queue delivery, interrupt, recovery, snapshot seeding, and backfill), and mapped it back into `ChatAttachment` when rendering the terminal conversation. Legacy stream rows fill only missing resolver metadata from the matching persisted message mirror so already-affected conversations recover without rewriting the append-only stream.
**Verification:** Reproduced the missing field, missing `<img>`, and legacy-stream failure with failing API and UI tests; then passed 119 focused tests, `pnpm typecheck`, and `pnpm build`.
**Prevention:** At every optimistic-to-authoritative handoff, compare the complete render-critical descriptor rather than only identity and display metadata. Persisted image records must include a durable resolver such as `storagePath`; temporary object URLs must never be the only thumbnail source.
**Skill/Doc Updates:** Updated `docs/architecture/worker-conversation-stream.md` with the attachment-source invariant. No general skill update was needed because the existing client/server state and unified-stream ownership guidance already requires complete authoritative payloads.
