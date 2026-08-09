---
provider: "claude"
codex_thread_id: "505a066f-f635-4766-85cb-e7d5aef66e82"
title: "Review OmniHarness handoff-ready installation plan"
started_at: "2026-08-05T20:37:32.097Z"
updated_at: "2026-08-05T20:38:55.282Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review OmniHarness handoff-ready installation plan

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:37:32.097Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T20:37:32.097Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-05T20:37:32.097Z",
  "sessionId": "505a066f-f635-4766-85cb-e7d5aef66e82",
  "content": "You are my second-opinion planning reviewer. Use only the content in this prompt. Do not inspect or edit files and do not call tools.\n\nUser goal: Make OmniHarness genuinely handoff-ready from a fresh clone on macOS, Linux, and Windows; install and serve both API and production UI; use published ACP packages without source compilation; prioritize Tailscale for private access.\n\nRepository constraints: work in current checkout, never create a branch or worktree, preserve unrelated dirty changes, never delete files without explicit authorization.\n\nArtifact spec:\n# Handoff-Ready Installation And Tailscale Design\n\n## Goal\n\nA new OmniHarness user can clone the repository and use one platform-native\ncommand to install dependencies, configure authentication, install published\nACP packages, build the production interface, and start the runner. Private\nremote access is documented and automated through Tailscale Serve before any\npublic-tunnel option.\n\n## First User And Core Job\n\nThe first user is a developer or operator installing OmniHarness on a personal\nmacOS, Linux, or Windows machine. Their core job is to start one durable\nOmniHarness deployment and open its web interface without learning the internal\nrunner/bridge/build layout.\n\n## Supporting Jobs\n\n- Understand what was installed and which URLs are safe to expose.\n- Start both the API and production web interface with one command.\n- Configure a password on first run without storing plaintext credentials.\n- Install maintained, published ACP packages without compiling an adapter.\n- Reach the web interface privately from another tailnet device.\n- Diagnose missing prerequisites or a failed startup from concrete messages.\n- Update the checkout and restart without rebuilding the interface unnecessarily.\n- Verify installation behavior continuously on macOS, Linux, and Windows.\n\n## Approved Approach\n\n### One runner, one public application port\n\nProduction keeps the existing architecture: the runner serves both the API/SSE\nsurface and the built Vite interface on port `3050`. The managed ACP bridge stays\non loopback port `7800`. The user does not start a second UI process in\nproduction; separate runner and Vite processes remain development-only.\n\n### Platform-native launchers\n\n- macOS and Linux use `./omniharness`.\n- Windows uses `./omniharness.ps1` from PowerShell.\n\nBoth launchers validate Node, obtain a supported pnpm when necessary, install\nrepository dependencies, configure password authentication, ensure ACP\nadapters, build the interface when its artifact is missing or stale, print the\nsame service and private-access guidance, and start the runner in the foreground.\nThey preserve explicit runner arguments and fail with the real command error.\n\nThe Windows launcher does not silently install Node because choosing and\nauthorizing a system Node installation is outside the repository's safe control.\nIt gives an exact supported-version error instead. Other repository-owned setup\nsteps are automatic.\n\n### Published ACP packages\n\nThe normal Codex path installs the maintained\n`@agentclientprotocol/codex-acp` and `@openai/codex` npm packages. These packages\ncontain the published adapter and platform Codex binary; normal installation\ndoes not invoke Rust or Cargo. The rolling package check and the three-platform\nmodel-metadata workflow remain the update rail. Legacy binary, Cargo, and Docker\nmodes are documented only as explicit developer or recovery overrides, never as\nthe default end-user path.\n\n### Interface build freshness\n\nA small cross-platform Node helper owns the definition of a usable production\ninterface artifact. It reports a rebuild when `dist/interface/index.html` is\nmissing or older than interface source/configuration inputs. Both launchers use\nthat helper, replacing the stale `.next` check left by the previous web stack.\n\n### Tailscale-first private access\n\n`pnpm setup:tailscale` runs a cross-platform Node setup command. It:\n\n1. verifies that the Tailscale CLI is installed;\n2. verifies that the local device is connected to a tailnet;\n3. configures persistent private HTTPS proxying with\n   `tailscale serve --bg http://127.0.0.1:3050`;\n4. derives the stable `https://<device>.<tailnet>.ts.net` origin from Tailscale\n   status;\n5. persists `OMNIHARNESS_PUBLIC_ORIGIN` and\n   `OMNIHARNESS_RUNNER_HOST=127.0.0.1` in the ignored local `.env` file; and\n6. tells the user to restart OmniHarness and prints the private URL.\n\nThe command is explicit because it changes host networking and tailnet Serve\nconfiguration. It never enables Tailscale Funnel and never exposes the ACP\nbridge. If Tailscale is missing or logged out, it exits without changing `.env`\nand gives the exact next action. Re-running it is safe and refreshes only the two\nOmniHarness settings it owns.\n\nThe launcher recommends `pnpm setup:tailscale` first. Cloudflare Tunnel remains\ndocumented as an optional public-access path, clearly separated from private\ntailnet access.\n\n## State And Persistence\n\nInstallation has these user-visible states: prerequisite check, dependency\ninstall, authentication setup, adapter setup, interface build, starting,\nready, and failed. Commands print each transition and preserve underlying errors.\n\nTailscale itself owns VPN login, device identity, ACLs, HTTPS certificates, and\nServe state. OmniHarness owns only its `.env` origin and loopback binding. The\nignored `.env` file survives runner restarts and repository updates but is not\ncommitted or synchronized to another machine. Running the setup command again\nupdates those settings. Removal instructions reset Tailscale Serve and remove or\nreplace the two `.env` settings without touching other configuration.\n\n## Operational Readiness And Trust\n\n- The web/API port may be proxied; the ACP bridge remains loopback-only.\n- Password authentication stays mandatory even inside a tailnet.\n- Tailscale ACLs provide an additional private-network boundary, not a\n  replacement for OmniHarness authentication.\n- Setup never silently invokes public Funnel access.\n- Missing tools, failed downloads, invalid Tailscale state, build errors, port\n  conflicts, and runner failures remain visible with their original details.\n- The README uses the real GitHub clone URL and does not imply that users need\n  to compile the ACP adapter or run two production web processes.\n\n## Verification\n\nDeterministic tests cover interface-build freshness, Unix launcher contracts,\nWindows launcher contracts, runner help, Tailscale status/configuration/env-file\nbehavior, and ACP default documentation. A GitHub Actions installation matrix\nruns macOS, Linux, and Windows entry points from a fresh checkout, waits on the\nreal health endpoint, fetches the real interface document, and shuts the runner\ndown. The existing rolling ACP workflow continues to verify current Codex model\nmetadata on all three operating systems.\n\nNo browser-driving journey is required for this milestone: health and actual\nHTML delivery prove the installation boundary without creating user data or\nrequiring a browser session.\n\n## Acceptance Criteria\n\n- A fresh macOS/Linux checkout starts through `./omniharness`.\n- A fresh Windows checkout starts through `./omniharness.ps1`.\n- Both entry points install/build the same API-plus-interface deployment.\n- Normal Codex ACP installation uses published npm packages and no compiler.\n- `pnpm setup:tailscale` creates private HTTPS Serve configuration and persists\n  the correct OmniHarness origin/bind settings, or fails without partial writes.\n- Tailscale is the first remote-access recommendation; public tunnels are\n  secondary and clearly labeled.\n- `pnpm runner --help` prints supported options and exits successfully.\n- Automated macOS, Linux, and Windows installation smoke checks pass.\n\n## North Star And Current Milestone\n\nThe north star is a trustworthy self-hosted agent control plane that a user can\ninstall, privately connect to, update, and recover without understanding its\ninternal process topology. This milestone completes the native repository\ninstallation and private Tailscale onboarding path. Packaged OS services and\noffline multi-architecture release bundles remain product direction, not claims\nmade by this milestone.\n\n\nArtifact implementation plan:\n# Handoff-Ready Installation And Tailscale Implementation Plan\n\n> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.\n\n**Goal:** Make a fresh OmniHarness checkout install and start its API plus production interface through one native command on macOS, Linux, and Windows, with Tailscale Serve as the primary private-access path.\n\n**Architecture:** Keep the production interface and API on the existing runner port and keep ACP on loopback. Add shared Node helpers for build freshness and Tailscale setup, add a PowerShell launcher matching the Unix entry point, and verify the real entry points in a three-platform CI matrix.\n\n**Tech Stack:** Bash, PowerShell, Node.js ESM, pnpm, Vite, Vitest, GitHub Actions, Tailscale CLI.\n\n**North Star Product:** A trustworthy self-hosted agent control plane that a user can install, privately connect to, update, and recover without understanding its internal process topology.\n\n**Current Milestone:** Complete the native repository installation and private Tailscale onboarding path on macOS, Linux, and Windows.\n\n**Future Product Direction:** Signed OS packages, managed background services, and offline multi-architecture bundles can build on this contract but are not claimed here.\n\n**Final Functionality Standard:** The real launchers install and start the real API-plus-interface deployment, the real Tailscale CLI configures private Serve access, and CI proves the entry points on every supported desktop OS.\n\n---\n\n## File Map\n\nCreate:\n\n- `omniharness.ps1` — Windows first-run and production launcher.\n- `scripts/interface-build-state.mjs` — cross-platform production-interface freshness decision.\n- `scripts/setup-tailscale.mjs` — explicit private Tailscale Serve setup and `.env` persistence.\n- `tests/scripts/interface-build-state.test.ts` — build-state behavior.\n- `tests/scripts/setup-tailscale.test.ts` — real child-process/status parsing and `.env` behavior with isolated command fixtures.\n- `tests/scripts/omniharness-powershell-launcher.test.ts` — Windows launcher contract.\n- `.github/workflows/install-smoke.yml` — fresh-checkout launcher, health, and HTML matrix.\n\nModify:\n\n- `omniharness` — use the shared build check and Tailscale-first guidance.\n- `package.json` — expose `setup:tailscale`.\n- `src/server/runner/config.ts` — expose stable runner help text/argument handling.\n- `scripts/runner.ts` — print help and exit successfully.\n- `tests/server/runner/config.test.ts` — runner help/option contract.\n- `tests/scripts/omniharness-launcher.test.ts` — Vite build and Tailscale guidance contracts.\n- `README.md` — real clone URL, one-command platform setup, actual ACP packaging, API/UI topology, Tailscale first, Cloudflare second.\n- `.env.example` — neutral Tailscale/private-origin examples.\n- `docs/deployment/runner-operations.md` — Tailscale Serve deployment and loopback rules.\n- `docs/security/authentication-and-tls.md` — tailnet trust boundary and password requirement.\n\nExisting large files are not expanded with implementation logic: the new setup\nlogic lives in focused scripts, and `README.md` is edited for accuracy rather\nthan duplicated with another installation guide. Secrets, `.env`, dependencies,\nbuild output, logs, databases, and `.omniharness` state already have appropriate\n`.gitignore` coverage.\n\n## Tasks\n\n- [ ] **1. Specify build freshness and runner help with failing tests.**\n  - Add tests proving a missing/stale `dist/interface/index.html` requires a\n    build and a newer artifact does not.\n  - Add tests proving `--help`/`-h` prints every supported runner option and\n    exits without starting a runner.\n  - Run the focused tests and confirm they fail for the missing behavior.\n  - Implement `scripts/interface-build-state.mjs`, runner help text, and Unix\n    launcher integration; rerun until green.\n\n- [ ] **2. Specify Tailscale setup with failing tests.**\n  - Test missing CLI, disconnected tailnet, valid `status --json`, Serve command\n    arguments, DNS normalization, idempotent `.env` replacement, and no partial\n    write after failure.\n  - Confirm the focused suite fails before implementation.\n  - Implement `scripts/setup-tailscale.mjs` and the package script with real\n    child-process execution and explicit errors; rerun until green.\n\n- [ ] **3. Specify and implement the Windows launcher.**\n  - Add contract tests for supported Node validation, pnpm recovery, dependency\n    install, auth setup, `install-agent-acp.ps1 -EnsureOnly`, build-state use,\n    loopback ACP path, Tailscale-first guidance, argument forwarding, and real\n    `pnpm start` execution.\n  - Confirm the tests fail because `omniharness.ps1` is absent.\n  - Implement the PowerShell launcher with terminating errors and no hidden\n    fallback server.\n  - Run static tests locally and run PowerShell syntax/execution checks when\n    `pwsh` is available.\n\n- [ ] **4. Make installation documentation match reality.**\n  - Replace placeholder clone commands and stale Rust/default-binary text.\n  - Put the one-command macOS/Linux and Windows flows first.\n  - State plainly that production API and UI share port `3050`, while the ACP\n    bridge stays on loopback `7800`.\n  - Document `pnpm setup:tailscale`, private HTTPS, ACL/password boundaries,\n    removal/recovery, and Cloudflare only as an optional public route.\n  - Update `.env.example`, runner operations, security guidance, troubleshooting,\n    and launcher terminal guidance consistently.\n  - Verify links, commands, ports, and absence of contradictory default-install\n    claims with targeted searches.\n\n- [ ] **5. Add real clean-install CI coverage.**\n  - Add a macOS/Linux/Windows matrix that invokes the platform launcher from a\n    fresh checkout with isolated auth/data and browser opening disabled.\n  - Poll `/api/healthz`, fetch `/`, assert OmniHarness HTML, preserve logs on\n    failure, and stop the launched process without deleting repository files.\n  - Keep the existing rolling Codex ACP/model workflow responsible for current\n    package and GPT-5.6 Sol metadata checks.\n  - Validate workflow YAML and inspect the exact platform commands.\n\n- [ ] **6. Run final verification against the real checkout.**\n  - Run focused script and runner tests.\n  - Run `pnpm typecheck`, targeted lint, `pnpm build`, and ACP compatibility.\n  - Start an isolated runner on a non-default port using the existing checkout,\n    verify `/api/healthz` and the production interface, then stop only that\n    isolated process and remove only its explicitly created temporary data root.\n  - Run `pnpm setup:tailscale` only in a non-mutating check/dry-run mode locally;\n    do not alter the developer's live Serve configuration during verification.\n  - Review the final diff for unrelated files and preserve all pre-existing user\n    changes.\n\n## Product And Operational Checks\n\n- Installation states and failures remain visible in terminal output.\n- `.env` is the source of truth only for OmniHarness origin/bind settings;\n  Tailscale remains the source of truth for VPN identity, ACLs, certificates,\n  and Serve state.\n- Re-running either launcher or Tailscale setup is idempotent.\n- The UI has no new state ownership or persistence changes; no React Manager or\n  localization changes are required.\n- The final milestone contains no mock server, placeholder adapter, silent public\n  tunnel, or second production UI process.\n\n\nPlease judge whether these artifacts are ready to execute. Look for missing requirements, unsafe network/config behavior, vague tasks, false cross-platform assumptions, incomplete testing, missing rollback or recovery, and sequencing problems. Return exactly these sections:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone\n"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:37:32.098Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T20:37:32.098Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-05T20:37:32.098Z",
  "sessionId": "505a066f-f635-4766-85cb-e7d5aef66e82"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-05T20:37:32.117Z","phase":null} -->
## User · 2026-08-05T20:37:32.117Z

You are my second-opinion planning reviewer. Use only the content in this prompt. Do not inspect or edit files and do not call tools.

User goal: Make OmniHarness genuinely handoff-ready from a fresh clone on macOS, Linux, and Windows; install and serve both API and production UI; use published ACP packages without source compilation; prioritize Tailscale for private access.

Repository constraints: work in current checkout, never create a branch or worktree, preserve unrelated dirty changes, never delete files without explicit authorization.

Artifact spec:
# Handoff-Ready Installation And Tailscale Design

## Goal

A new OmniHarness user can clone the repository and use one platform-native
command to install dependencies, configure authentication, install published
ACP packages, build the production interface, and start the runner. Private
remote access is documented and automated through Tailscale Serve before any
public-tunnel option.

## First User And Core Job

The first user is a developer or operator installing OmniHarness on a personal
macOS, Linux, or Windows machine. Their core job is to start one durable
OmniHarness deployment and open its web interface without learning the internal
runner/bridge/build layout.

## Supporting Jobs

- Understand what was installed and which URLs are safe to expose.
- Start both the API and production web interface with one command.
- Configure a password on first run without storing plaintext credentials.
- Install maintained, published ACP packages without compiling an adapter.
- Reach the web interface privately from another tailnet device.
- Diagnose missing prerequisites or a failed startup from concrete messages.
- Update the checkout and restart without rebuilding the interface unnecessarily.
- Verify installation behavior continuously on macOS, Linux, and Windows.

## Approved Approach

### One runner, one public application port

Production keeps the existing architecture: the runner serves both the API/SSE
surface and the built Vite interface on port `3050`. The managed ACP bridge stays
on loopback port `7800`. The user does not start a second UI process in
production; separate runner and Vite processes remain development-only.

### Platform-native launchers

- macOS and Linux use `./omniharness`.
- Windows uses `./omniharness.ps1` from PowerShell.

Both launchers validate Node, obtain a supported pnpm when necessary, install
repository dependencies, configure password authentication, ensure ACP
adapters, build the interface when its artifact is missing or stale, print the
same service and private-access guidance, and start the runner in the foreground.
They preserve explicit runner arguments and fail with the real command error.

The Windows launcher does not silently install Node because choosing and
authorizing a system Node installation is outside the repository's safe control.
It gives an exact supported-version error instead. Other repository-owned setup
steps are automatic.

### Published ACP packages

The normal Codex path installs the maintained
`@agentclientprotocol/codex-acp` and `@openai/codex` npm packages. These packages
contain the published adapter and platform Codex binary; normal installation
does not invoke Rust or Cargo. The rolling package check and the three-platform
model-metadata workflow remain the update rail. Legacy binary, Cargo, and Docker
modes are documented only as explicit developer or recovery overrides, never as
the default end-user path.

### Interface build freshness

A small cross-platform Node helper owns the definition of a usable production
interface artifact. It reports a rebuild when `dist/interface/index.html` is
missing or older than interface source/configuration inputs. Both launchers use
that helper, replacing the stale `.next` check left by the previous web stack.

### Tailscale-first private access

`pnpm setup:tailscale` runs a cross-platform Node setup command. It:

1. verifies that the Tailscale CLI is installed;
2. verifies that the local device is connected to a tailnet;
3. configures persistent private HTTPS proxying with
   `tailscale serve --bg http://127.0.0.1:3050`;
4. derives the stable `https://<device>.<tailnet>.ts.net` origin from Tailscale
   status;
5. persists `OMNIHARNESS_PUBLIC_ORIGIN` and
   `OMNIHARNESS_RUNNER_HOST=127.0.0.1` in the ignored local `.env` file; and
6. tells the user to restart OmniHarness and prints the private URL.

The command is explicit because it changes host networking and tailnet Serve
configuration. It never enables Tailscale Funnel and never exposes the ACP
bridge. If Tailscale is missing or logged out, it exits without changing `.env`
and gives the exact next action. Re-running it is safe and refreshes only the two
OmniHarness settings it owns.

The launcher recommends `pnpm setup:tailscale` first. Cloudflare Tunnel remains
documented as an optional public-access path, clearly separated from private
tailnet access.

## State And Persistence

Installation has these user-visible states: prerequisite check, dependency
install, authentication setup, adapter setup, interface build, starting,
ready, and failed. Commands print each transition and preserve underlying errors.

Tailscale itself owns VPN login, device identity, ACLs, HTTPS certificates, and
Serve state. OmniHarness owns only its `.env` origin and loopback binding. The
ignored `.env` file survives runner restarts and repository updates but is not
committed or synchronized to another machine. Running the setup command again
updates those settings. Removal instructions reset Tailscale Serve and remove or
replace the two `.env` settings without touching other configuration.

## Operational Readiness And Trust

- The web/API port may be proxied; the ACP bridge remains loopback-only.
- Password authentication stays mandatory even inside a tailnet.
- Tailscale ACLs provide an additional private-network boundary, not a
  replacement for OmniHarness authentication.
- Setup never silently invokes public Funnel access.
- Missing tools, failed downloads, invalid Tailscale state, build errors, port
  conflicts, and runner failures remain visible with their original details.
- The README uses the real GitHub clone URL and does not imply that users need
  to compile the ACP adapter or run two production web processes.

## Verification

Deterministic tests cover interface-build freshness, Unix launcher contracts,
Windows launcher contracts, runner help, Tailscale status/configuration/env-file
behavior, and ACP default documentation. A GitHub Actions installation matrix
runs macOS, Linux, and Windows entry points from a fresh checkout, waits on the
real health endpoint, fetches the real interface document, and shuts the runner
down. The existing rolling ACP workflow continues to verify current Codex model
metadata on all three operating systems.

No browser-driving journey is required for this milestone: health and actual
HTML delivery prove the installation boundary without creating user data or
requiring a browser session.

## Acceptance Criteria

- A fresh macOS/Linux checkout starts through `./omniharness`.
- A fresh Windows checkout starts through `./omniharness.ps1`.
- Both entry points install/build the same API-plus-interface deployment.
- Normal Codex ACP installation uses published npm packages and no compiler.
- `pnpm setup:tailscale` creates private HTTPS Serve configuration and persists
  the correct OmniHarness origin/bind settings, or fails without partial writes.
- Tailscale is the first remote-access recommendation; public tunnels are
  secondary and clearly labeled.
- `pnpm runner --help` prints supported options and exits successfully.
- Automated macOS, Linux, and Windows installation smoke checks pass.

## North Star And Current Milestone

The north star is a trustworthy self-hosted agent control plane that a user can
install, privately connect to, update, and recover without understanding its
internal process topology. This milestone completes the native repository
installation and private Tailscale onboarding path. Packaged OS services and
offline multi-architecture release bundles remain product direction, not claims
made by this milestone.


Artifact implementation plan:
# Handoff-Ready Installation And Tailscale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh OmniHarness checkout install and start its API plus production interface through one native command on macOS, Linux, and Windows, with Tailscale Serve as the primary private-access path.

**Architecture:** Keep the production interface and API on the existing runner port and keep ACP on loopback. Add shared Node helpers for build freshness and Tailscale setup, add a PowerShell launcher matching the Unix entry point, and verify the real entry points in a three-platform CI matrix.

**Tech Stack:** Bash, PowerShell, Node.js ESM, pnpm, Vite, Vitest, GitHub Actions, Tailscale CLI.

**North Star Product:** A trustworthy self-hosted agent control plane that a user can install, privately connect to, update, and recover without understanding its internal process topology.

**Current Milestone:** Complete the native repository installation and private Tailscale onboarding path on macOS, Linux, and Windows.

**Future Product Direction:** Signed OS packages, managed background services, and offline multi-architecture bundles can build on this contract but are not claimed here.

**Final Functionality Standard:** The real launchers install and start the real API-plus-interface deployment, the real Tailscale CLI configures private Serve access, and CI proves the entry points on every supported desktop OS.

---

## File Map

Create:

- `omniharness.ps1` — Windows first-run and production launcher.
- `scripts/interface-build-state.mjs` — cross-platform production-interface freshness decision.
- `scripts/setup-tailscale.mjs` — explicit private Tailscale Serve setup and `.env` persistence.
- `tests/scripts/interface-build-state.test.ts` — build-state behavior.
- `tests/scripts/setup-tailscale.test.ts` — real child-process/status parsing and `.env` behavior with isolated command fixtures.
- `tests/scripts/omniharness-powershell-launcher.test.ts` — Windows launcher contract.
- `.github/workflows/install-smoke.yml` — fresh-checkout launcher, health, and HTML matrix.

Modify:

- `omniharness` — use the shared build check and Tailscale-first guidance.
- `package.json` — expose `setup:tailscale`.
- `src/server/runner/config.ts` — expose stable runner help text/argument handling.
- `scripts/runner.ts` — print help and exit successfully.
- `tests/server/runner/config.test.ts` — runner help/option contract.
- `tests/scripts/omniharness-launcher.test.ts` — Vite build and Tailscale guidance contracts.
- `README.md` — real clone URL, one-command platform setup, actual ACP packaging, API/UI topology, Tailscale first, Cloudflare second.
- `.env.example` — neutral Tailscale/private-origin examples.
- `docs/deployment/runner-operations.md` — Tailscale Serve deployment and loopback rules.
- `docs/security/authentication-and-tls.md` — tailnet trust boundary and password requirement.

Existing large files are not expanded with implementation logic: the new setup
logic lives in focused scripts, and `README.md` is edited for accuracy rather
than duplicated with another installation guide. Secrets, `.env`, dependencies,
build output, logs, databases, and `.omniharness` state already have appropriate
`.gitignore` coverage.

## Tasks

- [ ] **1. Specify build freshness and runner help with failing tests.**
  - Add tests proving a missing/stale `dist/interface/index.html` requires a
    build and a newer artifact does not.
  - Add tests proving `--help`/`-h` prints every supported runner option and
    exits without starting a runner.
  - Run the focused tests and confirm they fail for the missing behavior.
  - Implement `scripts/interface-build-state.mjs`, runner help text, and Unix
    launcher integration; rerun until green.

- [ ] **2. Specify Tailscale setup with failing tests.**
  - Test missing CLI, disconnected tailnet, valid `status --json`, Serve command
    arguments, DNS normalization, idempotent `.env` replacement, and no partial
    write after failure.
  - Confirm the focused suite fails before implementation.
  - Implement `scripts/setup-tailscale.mjs` and the package script with real
    child-process execution and explicit errors; rerun until green.

- [ ] **3. Specify and implement the Windows launcher.**
  - Add contract tests for supported Node validation, pnpm recovery, dependency
    install, auth setup, `install-agent-acp.ps1 -EnsureOnly`, build-state use,
    loopback ACP path, Tailscale-first guidance, argument forwarding, and real
    `pnpm start` execution.
  - Confirm the tests fail because `omniharness.ps1` is absent.
  - Implement the PowerShell launcher with terminating errors and no hidden
    fallback server.
  - Run static tests locally and run PowerShell syntax/execution checks when
    `pwsh` is available.

- [ ] **4. Make installation documentation match reality.**
  - Replace placeholder clone commands and stale Rust/default-binary text.
  - Put the one-command macOS/Linux and Windows flows first.
  - State plainly that production API and UI share port `3050`, while the ACP
    bridge stays on loopback `7800`.
  - Document `pnpm setup:tailscale`, private HTTPS, ACL/password boundaries,
    removal/recovery, and Cloudflare only as an optional public route.
  - Update `.env.example`, runner operations, security guidance, troubleshooting,
    and launcher terminal guidance consistently.
  - Verify links, commands, ports, and absence of contradictory default-install
    claims with targeted searches.

- [ ] **5. Add real clean-install CI coverage.**
  - Add a macOS/Linux/Windows matrix that invokes the platform launcher from a
    fresh checkout with isolated auth/data and browser opening disabled.
  - Poll `/api/healthz`, fetch `/`, assert OmniHarness HTML, preserve logs on
    failure, and stop the launched process without deleting repository files.
  - Keep the existing rolling Codex ACP/model workflow responsible for current
    package and GPT-5.6 Sol metadata checks.
  - Validate workflow YAML and inspect the exact platform commands.

- [ ] **6. Run final verification against the real checkout.**
  - Run focused script and runner tests.
  - Run `pnpm typecheck`, targeted lint, `pnpm build`, and ACP compatibility.
  - Start an isolated runner on a non-default port using the existing checkout,
    verify `/api/healthz` and the production interface, then stop only that
    isolated process and remove only its explicitly created temporary data root.
  - Run `pnpm setup:tailscale` only in a non-mutating check/dry-run mode locally;
    do not alter the developer's live Serve configuration during verification.
  - Review the final diff for unrelated files and preserve all pre-existing user
    changes.

## Product And Operational Checks

- Installation states and failures remain visible in terminal output.
- `.env` is the source of truth only for OmniHarness origin/bind settings;
  Tailscale remains the source of truth for VPN identity, ACLs, certificates,
  and Serve state.
- Re-running either launcher or Tailscale setup is idempotent.
- The UI has no new state ownership or persistence changes; no React Manager or
  localization changes are required.
- The final milestone contains no mock server, placeholder adapter, silent public
  tunnel, or second production UI process.


Please judge whether these artifacts are ready to execute. Look for missing requirements, unsafe network/config behavior, vague tasks, false cross-platform assumptions, incomplete testing, missing rollback or recovery, and sequencing problems. Return exactly these sections:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone


uuid: 22e49962-c33d-4032-a731-0881bd357424

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:37:32.117Z","phase":null} -->
## Claude attachment · 2026-08-05T20:37:32.117Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-my-second-opinion-zany-melody.md",
  "planExists": false
}

binary omitted from archive

uuid: 8398f7c8-3be7-4974-aa5f-b21c19e64997
parent: 22e49962-c33d-4032-a731-0881bd357424
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-05T20:38:21.572Z","phase":null} -->
## Claude thinking · 2026-08-05T20:38:21.572Z



uuid: 91f51a71-704d-426b-bd01-05f1709debce
parent: 8398f7c8-3be7-4974-aa5f-b21c19e64997

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-05T20:38:55.282Z","phase":null} -->
## Claude · 2026-08-05T20:38:55.282Z

## 1. Verdict

**HARDEN** — the shape is right, but there are load-bearing external assumptions, a real partial-mutation window in the Tailscale path, and several tests that would pass without the behavior working.

(Per your instruction I inspected nothing and wrote no plan file; this is review only.)

## 2. Highest-impact findings

**a. The Tailscale sequence mutates host networking before it can fail.**
Spec order is: check CLI → check tailnet → `tailscale serve --bg` → derive origin → write `.env`. If origin derivation or the `.env` write fails, Serve is already configured — that contradicts "fails without partial writes." Fix: derive and validate the `DNSName`/cert domain from `status --json` *first*, write `.env` atomically (temp file + rename), then apply Serve; on any Serve failure after the write, revert the two keys. Add the removal path (`tailscale serve --bg off` / `tailscale serve reset`) as an implemented, tested command, not just prose.

**b. Three unchecked Tailscale preconditions will produce raw, unhelpful failures.**
(1) `tailscale serve` needs root/admin on Linux unless `tailscale set --operator=$USER` is set, and elevation on Windows. (2) HTTPS Serve requires MagicDNS + HTTPS certificates enabled for the tailnet in the admin console; if disabled, Serve fails at cert issuance. (3) On macOS the App Store build does not put `tailscale` on `PATH` (`/Applications/Tailscale.app/Contents/MacOS/Tailscale`). Fix: add CLI discovery fallbacks and explicit precondition checks with the exact remediation command for each, before any mutation.

**c. Overwriting `OMNIHARNESS_PUBLIC_ORIGIN` and forcing `OMNIHARNESS_RUNNER_HOST=127.0.0.1` can silently break an existing deployment.**
A user already on Cloudflare Tunnel or LAN-bound loses that config with no warning. Fix: if either key exists with a differing non-empty value, print the current value and require `--force` (or prompt); preserve the prior value as a commented line.

**d. Nothing in the plan verifies that `.env` actually reaches the runner.**
The plan never names the loader or asserts that these two variables affect binding, CORS/cookie origin, and SSE checks — and if any origin value is baked in at Vite build time, "restart OmniHarness" is wrong advice (a rebuild is needed). Fix: add a step to trace the config path and a test asserting the runner honors both vars end-to-end; correct the restart guidance if it's build-time.

**e. The published-ACP-package claim is load-bearing and unverified.**
Task 4 rewrites the README to promise "no compiler" before anything proves `@agentclientprotocol/codex-acp` / `@openai/codex` ship prebuilt binaries for every target you claim (Windows arm64, Linux arm64, musl/Alpine). Fix: add a Task 0 that checks package existence, versions, published platform/arch matrix, and postinstall network behavior; keep Cargo documented as a supported fallback for unsupported arches rather than "recovery override."

**f. mtime-based build freshness is wrong on the exact path you care about.**
`git clone`/`git pull` sets source mtimes to checkout time, so a stale `dist/` can look newer, and `index.html` existing says nothing about whether its hashed chunks were emitted. A failed build can also leave a half-written `dist/` that then reads as fresh. Fix: hash the interface source list + `vite.config` + `package.json` + lockfile into `dist/interface/.build-state.json`, compare hashes, write the marker only after a successful build (build to temp + rename). This also makes the tests deterministic instead of sleep-based.

**g. Windows launcher contract has real gaps.**
Default `RemoteSigned` policy blocks a downloaded `omniharness.ps1`; `$ErrorActionPreference='Stop'` does *not* trap native exe failures (you must check `$LASTEXITCODE` after every `pnpm`/`node` call); PowerShell 5.1 vs 7 differences are untested since the plan only runs `pwsh` "when available"; paths with spaces and Ctrl-C child teardown are unaddressed. Fix: declare a `#requires -Version`, check `$LASTEXITCODE` explicitly, test both 5.1 and 7 in CI, and document the `powershell -ExecutionPolicy Bypass -File .\omniharness.ps1` invocation in the README.

**h. `tests/scripts/omniharness-powershell-launcher.test.ts` as specified is a tautology.**
Asserting from Vitest that a `.ps1` file contains certain strings verifies text, not behavior. Fix: replace with (1) a real parse check via `[System.Management.Automation.Language.Parser]::ParseFile` and (2) a `-DryRun` mode in both launchers that exercises the actual decision logic (Node check, build-state call, arg forwarding) without starting anything — then let the CI matrix carry the behavioral assertion. Keep the injected-fake-CLI pattern you already planned for `setup-tailscale`; apply it to the launchers too.

**i. CI install-smoke will hang or flake as specified.**
The launcher "configures password authentication" — an interactive prompt blocks the matrix job. Fix: define an explicit non-interactive contract (env-provided or generated password, browser-open disabled, alternate port), bound the health poll with a timeout, kill the process in an `always()` step, upload logs on failure, and state that the smoke job never runs Tailscale steps.

**j. Sequencing: docs assert what isn't yet proven, and update-path work is unassigned.**
Task 4 rewrites installation claims before Tasks 5–6 validate them; move authoritative README claims after the matrix is green (or gate them on it). Separately, the supporting job "update the checkout and restart without rebuilding unnecessarily" has no task: a `git pull` that changes the lockfile must trigger `pnpm install`, which the freshness helper should key on (see f).

**k. Task 6 conflicts with your own constraint.**
"Remove only its explicitly created temporary data root" is a deletion, and the repo constraint is "never delete files without explicit authorization." Fix: place temp roots under the OS temp dir and leave them in place, or get authorization for that one path explicitly before Task 6.

**l. Unhandled operational cases named but unassigned:** port 3050 already in use, an OmniHarness runner already running, and rollback of a failed build. Give each a concrete detection + message owner in a task.

## 3. Anything I would deliberately leave alone

- **One runner, one public port (3050), ACP loopback-only on 7800.** Correct, and the right thing to state plainly in docs.
- **Refusing to auto-install Node on Windows.** Good boundary; the exact-version error is the right substitute.
- **Tailscale-first ordering with Funnel explicitly never enabled, and password auth mandatory inside the tailnet.** Don't soften either.
- **No browser-driving journey for this milestone.** Health + real HTML is a sufficient installation boundary; adding Playwright here would buy flake, not signal.
- **Keeping the rolling ACP/model-metadata workflow separate from install-smoke.** Different cadence, different failure meaning — correct to keep split.
- **Not claiming packaged OS services or offline bundles.** The scope discipline in "North Star vs. Current Milestone" is good; keep it.

uuid: e2dc5438-e97a-40f3-9b6e-76bd72ab7053
parent: 91f51a71-704d-426b-bd01-05f1709debce

<!-- /codex-event -->
