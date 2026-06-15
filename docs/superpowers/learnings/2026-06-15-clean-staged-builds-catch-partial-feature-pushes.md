# Clean Staged Builds Catch Partial Feature Pushes

**Date:** 2026-06-15
**Context:** OmniHarness launcher/install build on Windows Git Bash and WSL-adjacent environments.
**Symptom:** A pulled `master` failed `next build` because tracked files imported modules and props that only existed in the local dirty worktree.
**Root Cause:** Previous work was pushed from a partial index while companion source files, route handlers, schema changes, and tests remained unstaged. The developer machine could appear healthier because the dirty worktree still contained those files.
**Fix:** Reconstructed a clean tree from `HEAD + git diff --cached --binary`, followed the compiler failures to each stranded companion file, and staged the implementation, API routes, schema migration, UI managers, and tests needed for the committed code to build.
**Verification:** Ran a clean staged production build with `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm build`, then ran the focused clean staged Vitest suite covering launcher auth, queued-message interruption, elicitation flow, schema migration, and UI source assertions.
**Prevention:** Before pushing from a dirty repo, verify the exact index in a clean temp checkout. Do not rely on local untracked files or unstaged modifications when the remote build failure says "module not found" or type errors point at code already referenced by `HEAD`.
**Skill/Doc Updates:** No shared skill update needed; the existing verification-before-completion rule already requires checking the actual staged/published artifact.
