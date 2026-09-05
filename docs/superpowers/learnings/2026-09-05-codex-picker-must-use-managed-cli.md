# Codex Model Discovery Must Use the ACP-Managed CLI

**Date:** 2026-09-05
**Context:** OmniHarness Codex worker model picker and ACP runtime
**Symptom:** GPT-6 Astra was available in the current Codex CLI but did not appear in the OmniHarness worker model picker.
**Root Cause:** ACP workers used the managed npm Codex executable through `CODEX_PATH`, while model discovery and managed ACP catalog generation resolved a separate bare `codex` executable from `PATH`. The local managed ACP and Codex packages were also stale as a pair.
**Fix:** Added a shared Codex resolver that prefers the ACP-exported path and managed npm roots, used it for worker catalog discovery and managed ACP configuration, added GPT-6 Astra to worker and Codex-provider catalogs, and refreshed the paired ACP/Codex installation.
**Verification:** `pnpm test tests/server/worker-models.test.ts tests/server/agent-runtime/tool-env.test.ts tests/scripts/install-agent-acp.test.ts`; `pnpm test tests/ui/composer-shell.test.ts tests/api/agents-catalog-route.test.ts tests/runtime/agents-catalog-route.test.ts`; package-specific typechecks; `pnpm lint`; `pnpm build:interface:web`; live managed `codex debug models` returned visible `gpt-6-astra`.
**Prevention:** When adding or discovering Codex models, resolve the same executable used by ACP before reading model metadata. Keep the official `@agentclientprotocol/codex-acp` and `@openai/codex` managed packages on the paired update path, and retain a catalog fallback for discovery outages.
**Skill/Doc Updates:** No general skill update was needed; this is a project-specific executable-resolution contract captured here for future OmniHarness changes.
