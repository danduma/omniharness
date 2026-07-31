# Interface/runner platform split verification

Verified on 2026-07-31 on macOS arm64 with Node 22.22.3 and pnpm.

## Outcome

The split is complete:

- one logical headless runner owns API/SSE, persistence, ACP processes, PTYs,
  authentication, and the managed loopback bridge;
- the complete browser/PWA interface is a Vite SPA in `dist/interface` and is
  served by a normal runner unless `--no-static` is selected;
- the same interface can be hosted separately and connect to remote runners;
- browser, Electron, VS Code, iOS, and Android hosts use the shared runtime API
  boundary and can keep concurrent runner profiles connected;
- Next.js is no longer a dependency, build target, server, or interface owner.

## Final command results

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 33 warnings. |
| `pnpm typecheck` | Passed all shared, runner, interface, and repository TypeScript projects. |
| `pnpm test` | Passed: 368 files, 2,337 tests; 5 tests intentionally skipped. |
| `pnpm test:lifecycle` | Passed: 24 files, 33 tests. |
| `pnpm build` | Passed: built the final Vite web/PWA interface. |
| `pnpm build:interface:packaged` | Passed: built the relative-path packaged interface. |
| `pnpm test:e2e` | Passed: 8 deterministic browser journeys in 56.2 seconds. |
| `pnpm mobile:sync` | Passed: synchronized the final web artifact and native plugins into iOS and Android, then applied the native-only CSP. |
| `swiftc -parse apps/mobile/ios/App/App/OmniNativeRuntimePlugin.swift` | Passed. |
| `pnpm electron:package:local` | Passed: produced a 289 MB macOS arm64 application. |
| Packaged Electron smoke launch | Passed: the packaged executable stayed alive for five seconds and stopped cleanly; its smoke log was empty. |
| `pnpm vscode:package` | Passed: produced a 419 KB VSIX. The packager reported only missing repository and license metadata warnings. |
| `git diff --check` | Passed. |

The deterministic Playwright command intentionally excludes
`autonomous-run.spec.ts`. That journey requires a valid external agent
credential and, under the approved design, separate approval before running an
autonomous coding agent. It remains available through the explicit live-agent
test command and is not represented as covered here.

## Runner and interface verification

The final browser suite covered:

- two real runners connected concurrently;
- eight live runner event streams;
- runner switching, revocation, reauthorization, restart recovery, identity
  rekey detection, and terminal replay;
- a client aggregate heap below 750 MB and incremental heap below 40 MB for
  each added runner;
- mobile layout and branch/worktree safety journeys.

The pre-split development baseline varied by 17.3% between repeated filtered
peak measurements, exceeding the 15% tolerance by 2.3 percentage points. It is
recorded as an unstable baseline in
`docs/architecture/benchmarks/pre-split-next-development.md` and did not weaken
the split design's absolute targets.

The route fixture contains 70 routes plus 2 runner-only classifications. Its
schema version is 1 and its fingerprint is `fnv1a32:05be65bf`. The declared API
window remains revision 1–1. The change is classified as the
`runner_administration` additive capability, so no transport revision bump is
required. Tests reject an undeclared additive capability or an unbumped
transport-breaking change.

An explicit artifact scan checked 52 JavaScript, HTML, and JSON files across
`dist/interface` and `dist/interface-packaged`; it found no server source,
runtime HTTP source, Next import, Next package marker, or `NEXT_PUBLIC_`
reference. Source-boundary tests additionally reject direct `fetch`,
`EventSource`, API route construction, Electron globals, and VS Code globals
outside runtime adapters.

## Security and lifecycle review

The focused security/contract run passed 19 files and 76 tests. Review and
automated checks covered:

- named lifecycle events and stable `error.surfaced` codes for relevant
  failure/refusal paths;
- an `id:` on every SSE event, `Last-Event-ID` replay, stale-cursor resync, and
  reconnect storms;
- one-use scoped stream tickets;
- native originless bearer login and HTTPS requirements away from loopback;
- browser PKCE authorization and origin-bound credentials;
- session list, revoke, revoke-all, LRU eviction, password rotation, and
  identity binding;
- no credential-bearing CORS responses and no
  `Access-Control-Allow-Credentials`;
- redaction of account credentials, passwords, bearer tokens, tickets, and
  authorization codes from renderer payloads, snapshots, and logs;
- bounded HTTP subscribers, native renderer delivery queues, preview caches,
  and event/state caches;
- Electron `safeStorage`, VS Code `SecretStorage`, iOS Keychain, Android
  Keystore, and explicit TLS SPKI confirmation/re-pin behavior.

All four synchronized mobile shell files enforce `connect-src 'self'`, so
native WebViews cannot contact runners directly; networking and bearer
credentials stay in native code.

Trusted Types remains the one documented exception. It is sent as
`Content-Security-Policy-Report-Only` until React lazy loading, xterm, Markdown
and syntax highlighting, and Base UI portals/dialogs are violation-free or use
the narrow `omni` policy. This does not relax enforced `script-src`; the full
rationale and promotion gate are in `docs/architecture/trusted-types-rollout.md`.

## Native toolchain limits

Capacitor sync, JavaScript/native contracts, native source inspection, and
Swift parsing passed. Full native builds could not run on this host:

- `pnpm mobile:build:ios` stopped because `xcodebuild` requires full Xcode,
  while the active developer directory is
  `/Library/Developer/CommandLineTools`.
- `pnpm mobile:build:android` stopped before Gradle because no Java runtime is
  installed.

These are recorded toolchain limitations, not successful native builds.
Android unit/assemble and the iOS simulator no-sign build must be run on a host
with those toolchains before signing or store distribution.

## Cleanup

The verification-created package directories, Electron smoke profile/log,
Playwright result directory, and recent `omni-e2e-*` fixture repositories were
moved to the macOS Trash. No user session, database, runner data root,
pre-existing lock file, source file, or unrelated process was removed. The
final `dist/interface` and `dist/interface-packaged` build artifacts were kept
as the runnable outputs.
