# Auto-Commit Messages Must Be Project-Neutral

**Date:** 2026-07-02
**Context:** Milestone auto-commit workflow for user projects edited through OmniHarness.
**Symptom:** Commits created in non-OmniHarness projects included "OmniHarness" in the commit subject/body.
**Root Cause:** `runMilestoneAutoCommit` generated commit metadata with a product-branded subject prefix and body footer, even though the commit belongs to the target project.
**Fix:** Use the run title directly as the commit subject and replace the branded body footer with neutral workflow wording.
**Verification:** `pnpm test tests/server/git/run-auto-commit.test.ts`; production scan: `rg -n "OmniHarness:|Created by OmniHarness|commit.*OmniHarness|OmniHarness.*commit" src -g '!*.json'`.
**Prevention:** Treat commit messages, PR text, and project-local artifacts as belonging to the target project. Do not insert OmniHarness branding unless the target project is OmniHarness itself or the user asks for it.
**Skill/Doc Updates:** No global skill update needed; the project rule is captured here and by the regression test.
