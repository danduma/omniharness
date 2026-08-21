# Coupled Interface and Server Routes Require Runtime Verification

**Date:** 2026-08-22
**Context:** OmniHarness generated-image delivery from the unified worker conversation stream
**Symptom:** Generated PNGs appeared as broken images even though the interface had the new image renderer and the files were valid on disk.
**Root Cause:** The production interface was rebuilt after the binary-content client shipped, but the already-running runner predated the matching `contentEntryId` server branch. The old handler ignored the unknown query parameter and returned the ordinary transcript JSON with HTTP 200. The client accepted any successful blob, created an object URL for JSON, and rendered it as an image.
**Fix:** Generated-image loading now rejects successful responses whose MIME type is not `image/*`. Generated images are also projected into a turn-level carousel instead of being rendered as protocol cards inside tool details. The runner must be restarted after the interface build so the matching binary route is live.
**Verification:** Red/green tests cover non-image 200 responses and turn-level carousel grouping; the exact persisted session is projected to one three-image gallery; TypeScript, targeted tests, the production interface build, and the live post-restart binary endpoint are checked.
**Prevention:** Treat a frontend call to a new backend route as one deployable unit. Verify the real running process after restart with the expected status, MIME type, byte signature, and historical record—not only with an imported route handler. At binary boundaries, validate both HTTP success and the declared media type before creating a browser object URL.
**Skill/Doc Updates:** No global skill update was needed. The repository regression tests and this project-specific note capture the deploy/runtime invariant, while the existing lifecycle verification guidance already requires real product-surface evidence.
