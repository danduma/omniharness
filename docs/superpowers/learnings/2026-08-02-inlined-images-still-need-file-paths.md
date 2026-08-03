# Inlined Images Still Need File Paths

**Date:** 2026-08-02
**Context:** OmniHarness chat attachments and ACP worker prompt delivery
**Symptom:** In session `5103761b36e9`, Claude correctly received and visually understood an uploaded PNG, but searched unrelated temporary directories when asked to turn that image into project assets.
**Root Cause:** The attachment handoff treated visual access and file access as mutually exclusive. When an image was sent as an inline ACP content block, `formatAttachmentContext` deliberately omitted its saved absolute path. Claude could reason about the pixels but had no file it could pass to image-processing or file-copying tools.
**Fix:** Keep the inline image content block and include the verified absolute saved path in the same prompt context. Initial conversations, follow-up delivery, and canceled-message retries now preserve both forms.
**Verification:** The initial full run passed all type checks and 2,386 executed tests (5 skipped). After hardening saved-session and fresh-worker retries, type checking and all 111 attachment, conversation, and run-route tests passed. A later full run had one unrelated agent-startup timeout; that exact test passed immediately when rerun alone. The new follow-up and retry regression tests assert that `askAgent` receives both the image attachment object and the exact absolute path in the prompt.
**Prevention:** Treat multimodal visibility and filesystem availability as separate attachment capabilities. Image delivery tests must assert both whenever a worker may create, transform, copy, or inspect the original file with tools.
**Skill/Doc Updates:** No general skill update was needed. The rule is specific to OmniHarness's ACP attachment boundary and is enforced in the shared formatter plus route-level regression tests.
