# Generated Binaries Need Entry-Addressable Readers

**Date:** 2026-08-22
**Context:** OmniHarness unified worker conversation stream and direct-control transcript rendering
**Symptom:** Codex generated three PNGs in session `1a403d29718c`, but the direct conversation displayed no images.
**Root Cause:** Two boundaries independently discarded renderability. The unified-stream projection omitted `agent_content` entries, and the runtime/output history compactors truncated large base64 strings. The complete files still existed under the Codex worker's `generated_images` directory, but the UI only knew the compacted stream payload.
**Fix:** Project image `agent_content` rows into the Terminal, load full binary bodies through an authenticated `(workerId, entryId)` runtime API, validate referenced files against the canonical Codex generated-image root, and manage browser object URLs through `WorkerEntryContentUrlManager`. Missing or unsafe content emits `worker.output_content_unavailable` and renders a localized error.
**Verification:** Red/green regression tests cover unified projection, the binary route, runtime adapters, Manager URL lifecycle, path traversal, event emission, and locale parity. `pnpm exec tsc --noEmit` passed; `pnpm build:interface:web` passed; the reader returned all three historical PNGs at 1,110,961, 1,093,886, and 1,015,714 bytes.
**Prevention:** Treat append-only JSONL as binary metadata and ordering authority, not as an unbounded blob store. Every non-text content entry needs a stable entry-addressable reader, bounded authenticated delivery, explicit lifecycle ownership in the client, and a revisit test using compacted history.
**Skill/Doc Updates:** Updated `docs/architecture/worker-conversation-stream.md` with the binary-content contract. No general skill update was needed because the existing client/server invariants and control-plane skills already require one authoritative stream, bounded hot paths, Manager ownership, and surfaced failures.
