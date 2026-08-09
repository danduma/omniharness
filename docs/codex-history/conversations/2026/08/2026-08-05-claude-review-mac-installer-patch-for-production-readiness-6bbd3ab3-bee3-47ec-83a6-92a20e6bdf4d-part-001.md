---
provider: "claude"
codex_thread_id: "6bbd3ab3-bee3-47ec-83a6-92a20e6bdf4d"
title: "Review Mac installer patch for production readiness"
started_at: "2026-08-05T21:00:31.600Z"
updated_at: "2026-08-05T21:01:53.228Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review Mac installer patch for production readiness

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T21:00:31.600Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T21:00:31.600Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-05T21:00:31.600Z",
  "sessionId": "6bbd3ab3-bee3-47ec-83a6-92a20e6bdf4d",
  "content": "Act as a release-blocking code reviewer. Review only the supplied Mac installer/runtime patch for correctness, security, rollback safety, portability on current macOS, and whether a fresh user can install without compiling ACP adapters. Ignore style and unrelated repository changes. Reply in at most 800 words. List only concrete blockers or important bugs with file and explanation. End exactly with VERDICT: READY or VERDICT: FIX.\ndiff --git a/omniharness b/omniharness\nindex da6ad4a..92b2df4 100755\n--- a/omniharness\n+++ b/omniharness\n@@ -160,7 +160,11 @@ else\n   echo \"[omniharness] Using pnpm ${CURRENT_PNPM_VERSION:-unknown} (minimum supported major: $MIN_PNPM_MAJOR; known-good default: $PNPM_VERSION).\"\n fi\n \n-if [ ! -d \"$ROOT_DIR/node_modules\" ] || [ ! -f \"$ROOT_DIR/node_modules/.modules.yaml\" ] || [ ! -d \"$ROOT_DIR/node_modules/.pnpm\" ]; then\n+if [ ! -d \"$ROOT_DIR/node_modules\" ] \\\n+  || [ ! -f \"$ROOT_DIR/node_modules/.modules.yaml\" ] \\\n+  || [ ! -d \"$ROOT_DIR/node_modules/.pnpm\" ] \\\n+  || [ ! -f \"$ROOT_DIR/node_modules/.pnpm/lock.yaml\" ] \\\n+  || ! cmp -s \"$ROOT_DIR/pnpm-lock.yaml\" \"$ROOT_DIR/node_modules/.pnpm/lock.yaml\"; then\n   echo \"[omniharness] Installing dependencies with $PACKAGE_MANAGER...\"\n   env pnpm_config_dangerously_allow_all_builds=true \"${PNPM_CMD[@]}\" install\n fi\n@@ -175,7 +179,7 @@ if [ \"${OMNIHARNESS_SKIP_AGENT_ACP_SETUP:-0}\" != \"1\" ]; then\n   ./scripts/install-agent-acp.sh --ensure-only || echo \"[omniharness] Agent ACP adapter setup reported issues; continuing.\" >&2\n fi\n \n-WEB_PORT=\"${PORT:-3050}\"\n+WEB_PORT=\"${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}\"\n LOCAL_URL=\"http://localhost:${WEB_PORT}\"\n \n local_omniharness_status() {\n@@ -262,12 +266,10 @@ NODE\n }\n \n print_tunnel_guidance() {\n-  echo \"[omniharness] Remote/tunnel setup:\"\n-  echo \"  1. Expose only the web UI port, for example:\"\n-  echo \"     cloudflared tunnel --url http://localhost:${WEB_PORT}\"\n-  echo \"  2. Copy the generated https://... URL into .env:\"\n-  echo \"     OMNIHARNESS_PUBLIC_ORIGIN=https://your-tunnel-url\"\n-  echo \"  3. Restart ./omniharness so pairing links and public URLs use the tunnel.\"\n+  echo \"[omniharness] Private remote access (recommended):\"\n+  echo \"  pnpm setup:tailscale\"\n+  echo \"  This exposes only the web/API port to devices allowed by your tailnet.\"\n+  echo \"[omniharness] Public internet access (optional): see the Cloudflare section in README.md.\"\n }\n \n print_start_guidance() {\n@@ -308,27 +310,17 @@ if [ \"$CURRENT_STATUS\" = \"configuration_error\" ]; then\n   exit 1\n fi\n \n-# A production `next start` needs a complete production build in .next. Running\n-# `pnpm dev` (next dev --turbo) writes dev-shaped manifests into the same .next\n-# directory, leaving BUILD_ID intact but clobbering routes-manifest.json so it\n-# lacks `dataRoutes` -> `next start` then crashes with\n-# \"routesManifest.dataRoutes is not iterable\". So validate the manifest, not just\n-# the presence of BUILD_ID, before deciding whether to skip the build.\n-needs_production_build() {\n-  [ -f \"$ROOT_DIR/.next/BUILD_ID\" ] || return 0\n-  node --input-type=module -e '\n-    import { readFileSync } from \"node:fs\";\n-    try {\n-      const m = JSON.parse(readFileSync(process.argv[1], \"utf8\"));\n-      process.exit(Array.isArray(m.dataRoutes) ? 0 : 1);\n-    } catch { process.exit(1); }\n-  ' \"$ROOT_DIR/.next/routes-manifest.json\" || return 0\n-  return 1\n-}\n-\n-if needs_production_build; then\n-  echo \"[omniharness] Building production server...\"\n+if node ./scripts/interface-build-state.mjs --check; then\n+  :\n+else\n+  BUILD_STATE_EXIT=$?\n+  if [ \"$BUILD_STATE_EXIT\" -ne 10 ]; then\n+    echo \"[omniharness] Could not inspect the production interface build.\" >&2\n+    exit \"$BUILD_STATE_EXIT\"\n+  fi\n+  echo \"[omniharness] Building production interface...\"\n   \"${PNPM_CMD[@]}\" build\n+  node ./scripts/interface-build-state.mjs --write\n fi\n \n print_start_guidance\ndiff --git a/package.json b/package.json\nindex 45215a3..81c4e1a 100644\n--- a/package.json\n+++ b/package.json\n@@ -18,15 +18,16 @@\n     \"predev\": \"node ./scripts/check-pnpm.mjs --verify-native\",\n     \"dev\": \"pnpm exec tsx scripts/dev.ts\",\n     \"dev:interface\": \"vite --config apps/interface/vite.config.ts --mode web\",\n-    \"runner\": \"node --import tsx scripts/runner.ts\",\n+    \"runner\": \"node --env-file-if-exists=.env --import tsx scripts/runner.ts\",\n     \"auth:password\": \"node ./scripts/auth-password.mjs\",\n     \"restart:control\": \"pnpm exec tsx scripts/remote-restart.ts\",\n     \"prebuild\": \"node ./scripts/check-pnpm.mjs --verify-native\",\n     \"setup:agents\": \"./scripts/install-agent-acp.sh\",\n+    \"setup:tailscale\": \"node ./scripts/setup-tailscale.mjs\",\n     \"build\": \"pnpm build:interface:web\",\n     \"build:interface:web\": \"vite build --config apps/interface/vite.config.ts --mode web\",\n     \"build:interface:packaged\": \"vite build --config apps/interface/vite.config.ts --mode packaged\",\n-    \"start\": \"node --import tsx scripts/runner.ts\",\n+    \"start\": \"node --env-file-if-exists=.env --import tsx scripts/runner.ts\",\n     \"lint\": \"eslint\",\n     \"typecheck\": \"tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.runner.json --noEmit && tsc -p tsconfig.interface.json --noEmit && tsc --noEmit\",\n     \"test\": \"vitest run\",\ndiff --git a/scripts/runner.ts b/scripts/runner.ts\nindex 7d95eb4..f428066 100644\n--- a/scripts/runner.ts\n+++ b/scripts/runner.ts\n@@ -2,9 +2,27 @@\n import fs from \"node:fs\";\n import { resolveRunnerConfig } from \"../src/server/runner/config\";\n \n+const RUNNER_HELP = `Usage: pnpm runner -- [options]\n+\n+Options:\n+  --host <address>               API and interface bind address (default: 0.0.0.0)\n+  --port <0-65535>               API and interface port (default: 3050)\n+  --bridge-url <url>             Loopback ACP bridge URL (default: http://127.0.0.1:7800)\n+  --static-dir <directory>       Serve an explicit built interface directory\n+  --no-static                    Start the API without a production interface\n+  --interface-dev-url <url>      Proxy interface requests to a Vite development server\n+  -h, --help                     Show this help\n+`;\n+\n async function main() {\n+  const rawArgv = process.argv.slice(2);\n+  const argv = rawArgv[0] === \"--\" ? rawArgv.slice(1) : rawArgv;\n+  if (argv.length === 1 && [\"--help\", \"-h\"].includes(argv[0])) {\n+    process.stdout.write(RUNNER_HELP);\n+    return;\n+  }\n   const config = resolveRunnerConfig({\n-    argv: process.argv.slice(2),\n+    argv,\n     cwd: process.cwd(),\n     env: process.env,\n   });\n#!/usr/bin/env node\n\nimport { createHash } from \"node:crypto\";\nimport fs from \"node:fs/promises\";\nimport path from \"node:path\";\n\nconst MARKER_VERSION = 1;\nconst BUILD_REQUIRED_EXIT = 10;\nconst INPUT_PATHS = [\n  \"package.json\",\n  \"pnpm-lock.yaml\",\n  \"tsconfig.json\",\n  \"tsconfig.interface.json\",\n  \"tsconfig.shared.json\",\n  \"apps/interface\",\n  \"shared/locales\",\n  \"src/components\",\n  \"src/interface\",\n  \"src/lib\",\n  \"src/runtime-api\",\n  \"src/shared\",\n  \"src/ui\",\n];\n\nfunction readArgs(argv) {\n  let mode = null;\n  let root = process.cwd();\n  for (let index = 0; index < argv.length; index += 1) {\n    const arg = argv[index];\n    if (arg === \"--check\" || arg === \"--write\") {\n      if (mode) throw new TypeError(\"Use exactly one of --check or --write.\");\n      mode = arg;\n      continue;\n    }\n    if (arg === \"--root\") {\n      const value = argv[index + 1];\n      if (!value) throw new TypeError(\"--root requires a directory.\");\n      root = path.resolve(value);\n      index += 1;\n      continue;\n    }\n    throw new TypeError(`Unknown interface build-state option: ${arg}`);\n  }\n  if (!mode) throw new TypeError(\"Use --check or --write.\");\n  return { mode, root };\n}\n\nasync function collectFiles(root, relativePath) {\n  const absolutePath = path.join(root, relativePath);\n  let stat;\n  try {\n    stat = await fs.stat(absolutePath);\n  } catch (error) {\n    if (error && error.code === \"ENOENT\") return [];\n    throw error;\n  }\n  if (stat.isFile()) return [relativePath];\n  if (!stat.isDirectory()) return [];\n\n  const entries = await fs.readdir(absolutePath, { withFileTypes: true });\n  const files = [];\n  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {\n    if (entry.name === \".DS_Store\") continue;\n    files.push(...await collectFiles(root, path.join(relativePath, entry.name)));\n  }\n  return files;\n}\n\nasync function fingerprintInputs(root) {\n  const hash = createHash(\"sha256\");\n  const files = [];\n  for (const inputPath of INPUT_PATHS) {\n    files.push(...await collectFiles(root, inputPath));\n  }\n  files.sort((left, right) => left.localeCompare(right));\n  if (files.length === 0) throw new Error(\"No interface build inputs were found.\");\n  for (const relativePath of files) {\n    hash.update(relativePath.split(path.sep).join(\"/\"));\n    hash.update(\"\\0\");\n    hash.update(await fs.readFile(path.join(root, relativePath)));\n    hash.update(\"\\0\");\n  }\n  return hash.digest(\"hex\");\n}\n\nasync function validateOutput(root) {\n  const outputDir = path.join(root, \"dist\", \"interface\");\n  const indexPath = path.join(outputDir, \"index.html\");\n  let html;\n  try {\n    html = await fs.readFile(indexPath, \"utf8\");\n  } catch (error) {\n    if (error && error.code === \"ENOENT\") {\n      return { ok: false, reason: \"production interface is missing\" };\n    }\n    throw error;\n  }\n\n  const references = [...html.matchAll(/(?:src|href)=[\"']\\/?(assets\\/[^\"'#?]+)[\"']/g)]\n    .map((match) => match[1]);\n  if (references.length === 0) {\n    return { ok: false, reason: \"production interface has no referenced assets\" };\n  }\n  for (const reference of references) {\n    try {\n      const stat = await fs.stat(path.join(outputDir, reference));\n      if (!stat.isFile()) throw new Error(\"not a file\");\n    } catch {\n      return { ok: false, reason: `referenced asset is missing: ${reference}` };\n    }\n  }\n  return { ok: true, outputDir };\n}\n\nasync function readMarker(outputDir) {\n  try {\n    return JSON.parse(await fs.readFile(path.join(outputDir, \".build-state.json\"), \"utf8\"));\n  } catch {\n    return null;\n  }\n}\n\nasync function check(root) {\n  const output = await validateOutput(root);\n  if (!output.ok) return output.reason;\n  const marker = await readMarker(output.outputDir);\n  if (marker?.version !== MARKER_VERSION || typeof marker.fingerprint !== \"string\") {\n    return \"build marker is missing or invalid\";\n  }\n  const fingerprint = await fingerprintInputs(root);\n  if (marker.fingerprint !== fingerprint) return \"source fingerprint changed\";\n  return null;\n}\n\nasync function write(root) {\n  const output = await validateOutput(root);\n  if (!output.ok) throw new Error(output.reason);\n  const markerPath = path.join(output.outputDir, \".build-state.json\");\n  const temporaryPath = `${markerPath}.tmp-${process.pid}`;\n  const marker = {\n    version: MARKER_VERSION,\n    fingerprint: await fingerprintInputs(root),\n  };\n  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\\n`, \"utf8\");\n  await fs.rename(temporaryPath, markerPath);\n  process.stdout.write(`[omniharness] Recorded interface build ${marker.fingerprint.slice(0, 12)}.\\n`);\n}\n\nasync function main() {\n  const { mode, root } = readArgs(process.argv.slice(2));\n  if (mode === \"--write\") {\n    await write(root);\n    return;\n  }\n  const reason = await check(root);\n  if (reason) {\n    process.stdout.write(`[omniharness] Interface build required: ${reason}.\\n`);\n    process.exit(BUILD_REQUIRED_EXIT);\n  }\n  process.stdout.write(\"[omniharness] Production interface is current.\\n\");\n}\n\nmain().catch((error) => {\n  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\\n`);\n  process.exit(1);\n});\n#!/usr/bin/env node\n\nimport fs from \"node:fs\";\nimport fsp from \"node:fs/promises\";\nimport path from \"node:path\";\nimport { spawnSync } from \"node:child_process\";\n\nconst MANAGED_START = \"# omniharness-tailscale-managed:start\";\nconst MANAGED_END = \"# omniharness-tailscale-managed:end\";\nconst OWNED_KEYS = [\"OMNIHARNESS_PUBLIC_ORIGIN\", \"OMNIHARNESS_RUNNER_HOST\"];\n\nfunction readArgs(argv) {\n  if (argv[0] === \"--\") argv = argv.slice(1);\n  const options = {\n    root: process.cwd(),\n    port: Number(process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || \"3050\"),\n    dryRun: false,\n    force: false,\n    reset: false,\n  };\n  for (let index = 0; index < argv.length; index += 1) {\n    const arg = argv[index];\n    if (arg === \"--root\" || arg === \"--port\") {\n      const value = argv[index + 1];\n      if (!value) throw new TypeError(`${arg} requires a value.`);\n      if (arg === \"--root\") options.root = path.resolve(value);\n      else options.port = Number(value);\n      index += 1;\n      continue;\n    }\n    if (arg === \"--dry-run\") options.dryRun = true;\n    else if (arg === \"--force\") options.force = true;\n    else if (arg === \"--reset\") options.reset = true;\n    else throw new TypeError(`Unknown Tailscale setup option: ${arg}`);\n  }\n  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {\n    throw new TypeError(\"--port must be an integer from 1 to 65535.\");\n  }\n  return options;\n}\n\nfunction isExecutable(filePath) {\n  try {\n    fs.accessSync(filePath, fs.constants.X_OK);\n    return true;\n  } catch {\n    return false;\n  }\n}\n\nfunction findTailscale() {\n  const explicit = process.env.OMNIHARNESS_TAILSCALE_BIN?.trim();\n  if (explicit) return isExecutable(explicit) ? explicit : null;\n  for (const directory of (process.env.PATH || \"\").split(path.delimiter)) {\n    if (!directory) continue;\n    const candidate = path.join(directory, \"tailscale\");\n    if (isExecutable(candidate)) return candidate;\n  }\n  for (const candidate of [\n    \"/Applications/Tailscale.app/Contents/MacOS/Tailscale\",\n    \"/Applications/Tailscale.app/Contents/MacOS/tailscale\",\n  ]) {\n    if (isExecutable(candidate)) return candidate;\n  }\n  return null;\n}\n\nfunction invoke(tailscale, args, options = {}) {\n  const result = spawnSync(tailscale, args, { encoding: \"utf8\" });\n  if (result.error) throw result.error;\n  if (result.status !== 0 && !options.allowFailure) {\n    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();\n    throw new Error(`${detail}\\nTailscale Serve may require an administrator, a configured operator, and HTTPS enabled for the tailnet.`);\n  }\n  return result;\n}\n\nfunction readTailnetStatus(tailscale) {\n  const result = invoke(tailscale, [\"status\", \"--json\"]);\n  let status;\n  try {\n    status = JSON.parse(result.stdout);\n  } catch {\n    throw new Error(\"Tailscale returned invalid status JSON.\");\n  }\n  if (status.BackendState !== \"Running\") {\n    throw new Error(`Tailscale is not connected (state: ${status.BackendState || \"unknown\"}). Run \\`tailscale up\\`, then retry.`);\n  }\n  const dnsName = String(status.Self?.DNSName || \"\").replace(/\\.$/, \"\");\n  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\\.ts\\.net$/.test(dnsName)) {\n    throw new Error(\"Tailscale status did not provide a valid tailnet DNS name. Ensure MagicDNS and HTTPS are enabled for the tailnet.\");\n  }\n  return { dnsName, origin: `https://${dnsName}` };\n}\n\nfunction removeManagedBlock(text) {\n  const start = text.indexOf(MANAGED_START);\n  if (start === -1) return text;\n  const end = text.indexOf(MANAGED_END, start);\n  if (end === -1) throw new Error(\"The OmniHarness Tailscale block in .env is incomplete; repair it before continuing.\");\n  let removeStart = start;\n  if (removeStart > 0 && text[removeStart - 1] === \"\\n\") removeStart -= 1;\n  let removeEnd = end + MANAGED_END.length;\n  if (text[removeEnd] === \"\\r\") removeEnd += 1;\n  if (text[removeEnd] === \"\\n\") removeEnd += 1;\n  return `${text.slice(0, removeStart)}${text.slice(removeEnd)}`;\n}\n\nfunction activeOwnedSettings(text) {\n  const values = new Map();\n  for (const line of removeManagedBlock(text).split(/\\r?\\n/)) {\n    if (/^\\s*#/.test(line)) continue;\n    const match = line.match(/^\\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\\s*=\\s*(.*)\\s*$/);\n    if (match) values.set(match[1], match[2]);\n  }\n  return values;\n}\n\nfunction buildManagedEnv(text, settings, force) {\n  const withoutManaged = removeManagedBlock(text);\n  const existing = activeOwnedSettings(withoutManaged);\n  const conflicts = OWNED_KEYS.filter((key) => {\n    const current = existing.get(key);\n    return current && current !== settings[key];\n  });\n  if (conflicts.length > 0 && !force) {\n    const details = conflicts.map((key) => `${key}=${existing.get(key)}`).join(\", \");\n    throw new Error(`Existing remote-access settings would be replaced (${details}). Re-run with --force to preserve them as comments and continue.`);\n  }\n\n  const keptLines = [];\n  const previousLines = [];\n  for (const line of withoutManaged.split(/\\r?\\n/)) {\n    const match = line.match(/^\\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\\s*=\\s*(.*)\\s*$/);\n    if (!match) {\n      keptLines.push(line);\n      continue;\n    }\n    if (force && match[2] && match[2] !== settings[match[1]]) {\n      previousLines.push(`# omniharness-tailscale-previous: ${match[1]}=${match[2]}`);\n    }\n  }\n  while (keptLines.at(-1) === \"\") keptLines.pop();\n  const base = [...keptLines, ...previousLines].join(\"\\n\");\n  const block = [\n    MANAGED_START,\n    `OMNIHARNESS_PUBLIC_ORIGIN=${settings.OMNIHARNESS_PUBLIC_ORIGIN}`,\n    `OMNIHARNESS_RUNNER_HOST=${settings.OMNIHARNESS_RUNNER_HOST}`,\n    MANAGED_END,\n  ].join(\"\\n\");\n  return `${base ? `${base}\\n\\n` : \"\"}${block}\\n`;\n}\n\nfunction resetManagedEnv(text) {\n  return removeManagedBlock(text).replace(/\\n{2,}$/g, \"\\n\");\n}\n\nasync function readEnv(envPath) {\n  try {\n    return await fsp.readFile(envPath, \"utf8\");\n  } catch (error) {\n    if (error?.code === \"ENOENT\") return \"\";\n    throw error;\n  }\n}\n\nasync function stageEnv(envPath, text) {\n  await fsp.mkdir(path.dirname(envPath), { recursive: true });\n  const temporaryPath = `${envPath}.omniharness-tailscale.tmp-${process.pid}`;\n  await fsp.writeFile(temporaryPath, text, { encoding: \"utf8\", mode: 0o600 });\n  await fsp.chmod(temporaryPath, 0o600);\n  return temporaryPath;\n}\n\nfunction inspectServeState(tailscale, target, force) {\n  const result = invoke(tailscale, [\"serve\", \"status\", \"--json\"], { allowFailure: true });\n  if (result.status !== 0 || !result.stdout.trim()) return;\n  try {\n    const status = JSON.parse(result.stdout);\n    if (Object.keys(status).length > 0 && !JSON.stringify(status).includes(target) && !force) {\n      throw new Error(\"Tailscale already has Serve configuration on this device. Re-run with --force only if OmniHarness may replace the default HTTPS listener.\");\n    }\n  } catch (error) {\n    if (error instanceof SyntaxError) return;\n    throw error;\n  }\n}\n\nasync function setup(options, tailscale) {\n  const { origin } = readTailnetStatus(tailscale);\n  const target = `http://127.0.0.1:${options.port}`;\n  inspectServeState(tailscale, target, options.force);\n  const envPath = path.join(options.root, \".env\");\n  const currentEnv = await readEnv(envPath);\n  const nextEnv = buildManagedEnv(currentEnv, {\n    OMNIHARNESS_PUBLIC_ORIGIN: origin,\n    OMNIHARNESS_RUNNER_HOST: \"127.0.0.1\",\n  }, options.force);\n\n  if (options.dryRun) {\n    process.stdout.write(`[omniharness] Would run: tailscale serve --bg ${target}\\n`);\n    process.stdout.write(`[omniharness] Would configure private origin: ${origin}\\n`);\n    return;\n  }\n\n  const stagedPath = await stageEnv(envPath, nextEnv);\n  try {\n    invoke(tailscale, [\"serve\", \"--bg\", target]);\n  } catch (error) {\n    await fsp.rm(stagedPath, { force: true });\n    throw error;\n  }\n  try {\n    await fsp.rename(stagedPath, envPath);\n  } catch (error) {\n    const rollback = invoke(tailscale, [\"serve\", \"--https=443\", \"off\"], { allowFailure: true });\n    await fsp.rm(stagedPath, { force: true });\n    const rollbackDetail = rollback.status === 0 ? \"The new Serve listener was disabled.\" : `Serve rollback also failed: ${(rollback.stderr || rollback.stdout).trim()}`;\n    throw new Error(`Tailscale Serve was configured, but .env could not be published. ${rollbackDetail}\\n${error instanceof Error ? error.message : String(error)}`);\n  }\n  process.stdout.write(`[omniharness] Private OmniHarness URL: ${origin}\\n`);\n  process.stdout.write(\"[omniharness] Restart ./omniharness so the runner binds to loopback and uses this origin.\\n\");\n}\n\nasync function reset(options, tailscale) {\n  const envPath = path.join(options.root, \".env\");\n  const currentEnv = await readEnv(envPath);\n  const nextEnv = resetManagedEnv(currentEnv);\n  if (options.dryRun) {\n    process.stdout.write(\"[omniharness] Would run: tailscale serve --https=443 off\\n\");\n    process.stdout.write(\"[omniharness] Would remove the managed OmniHarness Tailscale settings from .env.\\n\");\n    return;\n  }\n  const stagedPath = await stageEnv(envPath, nextEnv);\n  try {\n    invoke(tailscale, [\"serve\", \"--https=443\", \"off\"]);\n    await fsp.rename(stagedPath, envPath);\n  } catch (error) {\n    await fsp.rm(stagedPath, { force: true });\n    throw error;\n  }\n  process.stdout.write(\"[omniharness] Disabled the OmniHarness HTTPS Serve listener and removed its managed .env settings.\\n\");\n}\n\nasync function main() {\n  const options = readArgs(process.argv.slice(2));\n  const tailscale = findTailscale();\n  if (!tailscale) {\n    throw new Error(\"Tailscale is not installed or its CLI is unavailable. Install the recommended standalone Mac app: https://tailscale.com/download/mac\");\n  }\n  if (options.reset) await reset(options, tailscale);\n  else await setup(options, tailscale);\n}\n\nmain().catch((error) => {\n  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\\n`);\n  process.exit(1);\n});\nname: Verify macOS installation\n\non:\n  push:\n    branches: [master]\n  pull_request:\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: macos-install-${{ github.ref }}\n  cancel-in-progress: true\n\njobs:\n  macos-install:\n    name: Fresh Mac launcher\n    runs-on: macos-15\n    timeout-minutes: 20\n    env:\n      OMNIHARNESS_AUTH_PASSWORD: macos-release-smoke-password\n      OMNIHARNESS_ROOT: ${{ runner.temp }}/omniharness-install-smoke\n      OMNIHARNESS_RUNNER_HOST: 127.0.0.1\n      OMNIHARNESS_RUNNER_PORT: 3059\n      OMNIHARNESS_BRIDGE_URL: http://127.0.0.1:17809\n      OMNIHARNESS_OPEN_BROWSER: 0\n      OMNIHARNESS_SKIP_RECOMMENDED_TOOLS: 1\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup supported Node\n        uses: actions/setup-node@v4\n        with:\n          node-version-file: .nvmrc\n\n      - name: Confirm this is a fresh interface install\n        run: test ! -e dist/interface/.build-state.json\n\n      - name: Start through the real Mac launcher\n        run: |\n          ./omniharness > \"$RUNNER_TEMP/omniharness-install.log\" 2>&1 &\n          echo \"$!\" > \"$RUNNER_TEMP/omniharness-install.pid\"\n\n      - name: Wait for API health\n        run: |\n          node --input-type=module <<'NODE'\n          const deadline = Date.now() + 120_000;\n          const url = \"http://127.0.0.1:3059/api/healthz\";\n          while (Date.now() < deadline) {\n            try {\n              const response = await fetch(url);\n              if (response.ok) process.exit(0);\n            } catch {}\n            await new Promise((resolve) => setTimeout(resolve, 750));\n          }\n          throw new Error(`Timed out waiting for ${url}`);\n          NODE\n\n      - name: Verify production interface and build marker\n        run: |\n          node --input-type=module <<'NODE'\n          import fs from \"node:fs\";\n          const origin = \"http://127.0.0.1:3059\";\n          const response = await fetch(origin);\n          if (!response.ok) throw new Error(`Interface returned ${response.status}`);\n          const html = await response.text();\n          if (!html.includes(\"OmniHarness\")) throw new Error(\"Response is not the OmniHarness interface\");\n          const assetPath = html.match(/(?:src|href)=[\"'](\\/assets\\/[^\"'#?]+)[\"']/)?.[1];\n          if (!assetPath) throw new Error(\"Interface HTML references no hashed asset\");\n          const assetResponse = await fetch(new URL(assetPath, origin));\n          if (!assetResponse.ok) throw new Error(`Interface asset returned ${assetResponse.status}: ${assetPath}`);\n          const marker = JSON.parse(fs.readFileSync(\"dist/interface/.build-state.json\", \"utf8\"));\n          if (marker.version !== 1 || !/^[a-f0-9]{64}$/.test(marker.fingerprint)) {\n            throw new Error(\"Interface build marker is invalid\");\n          }\n          NODE\n\n      - name: Show launcher log on failure\n        if: failure()\n        run: test ! -f \"$RUNNER_TEMP/omniharness-install.log\" || tail -n 300 \"$RUNNER_TEMP/omniharness-install.log\"\n\n      - name: Upload launcher log on failure\n        if: failure()\n        uses: actions/upload-artifact@v4\n        with:\n          name: macos-install-log\n          path: ${{ runner.temp }}/omniharness-install.log\n\n      - name: Stop isolated runner\n        if: always()\n        run: |\n          if test -f \"$RUNNER_TEMP/omniharness-install.pid\"; then\n            install_pid=\"$(cat \"$RUNNER_TEMP/omniharness-install.pid\")\"\n            if test -n \"$install_pid\" && kill -0 \"$install_pid\" 2>/dev/null; then\n              kill \"$install_pid\"\n              wait \"$install_pid\" 2>/dev/null || true\n            fi\n          fi\n"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T21:00:31.601Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T21:00:31.601Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-05T21:00:31.601Z",
  "sessionId": "6bbd3ab3-bee3-47ec-83a6-92a20e6bdf4d"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-05T21:00:31.620Z","phase":null} -->
## User · 2026-08-05T21:00:31.620Z

Act as a release-blocking code reviewer. Review only the supplied Mac installer/runtime patch for correctness, security, rollback safety, portability on current macOS, and whether a fresh user can install without compiling ACP adapters. Ignore style and unrelated repository changes. Reply in at most 800 words. List only concrete blockers or important bugs with file and explanation. End exactly with VERDICT: READY or VERDICT: FIX.
diff --git a/omniharness b/omniharness
index da6ad4a..92b2df4 100755
--- a/omniharness
+++ b/omniharness
@@ -160,7 +160,11 @@ else
   echo "[omniharness] Using pnpm ${CURRENT_PNPM_VERSION:-unknown} (minimum supported major: $MIN_PNPM_MAJOR; known-good default: $PNPM_VERSION)."
 fi
 
-if [ ! -d "$ROOT_DIR/node_modules" ] || [ ! -f "$ROOT_DIR/node_modules/.modules.yaml" ] || [ ! -d "$ROOT_DIR/node_modules/.pnpm" ]; then
+if [ ! -d "$ROOT_DIR/node_modules" ] \
+  || [ ! -f "$ROOT_DIR/node_modules/.modules.yaml" ] \
+  || [ ! -d "$ROOT_DIR/node_modules/.pnpm" ] \
+  || [ ! -f "$ROOT_DIR/node_modules/.pnpm/lock.yaml" ] \
+  || ! cmp -s "$ROOT_DIR/pnpm-lock.yaml" "$ROOT_DIR/node_modules/.pnpm/lock.yaml"; then
   echo "[omniharness] Installing dependencies with $PACKAGE_MANAGER..."
   env pnpm_config_dangerously_allow_all_builds=true "${PNPM_CMD[@]}" install
 fi
@@ -175,7 +179,7 @@ if [ "${OMNIHARNESS_SKIP_AGENT_ACP_SETUP:-0}" != "1" ]; then
   ./scripts/install-agent-acp.sh --ensure-only || echo "[omniharness] Agent ACP adapter setup reported issues; continuing." >&2
 fi
 
-WEB_PORT="${PORT:-3050}"
+WEB_PORT="${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}"
 LOCAL_URL="http://localhost:${WEB_PORT}"
 
 local_omniharness_status() {
@@ -262,12 +266,10 @@ NODE
 }
 
 print_tunnel_guidance() {
-  echo "[omniharness] Remote/tunnel setup:"
-  echo "  1. Expose only the web UI port, for example:"
-  echo "     cloudflared tunnel --url http://localhost:${WEB_PORT}"
-  echo "  2. Copy the generated https://... URL into .env:"
-  echo "     OMNIHARNESS_PUBLIC_ORIGIN=https://your-tunnel-url"
-  echo "  3. Restart ./omniharness so pairing links and public URLs use the tunnel."
+  echo "[omniharness] Private remote access (recommended):"
+  echo "  pnpm setup:tailscale"
+  echo "  This exposes only the web/API port to devices allowed by your tailnet."
+  echo "[omniharness] Public internet access (optional): see the Cloudflare section in README.md."
 }
 
 print_start_guidance() {
@@ -308,27 +310,17 @@ if [ "$CURRENT_STATUS" = "configuration_error" ]; then
   exit 1
 fi
 
-# A production `next start` needs a complete production build in .next. Running
-# `pnpm dev` (next dev --turbo) writes dev-shaped manifests into the same .next
-# directory, leaving BUILD_ID intact but clobbering routes-manifest.json so it
-# lacks `dataRoutes` -> `next start` then crashes with
-# "routesManifest.dataRoutes is not iterable". So validate the manifest, not just
-# the presence of BUILD_ID, before deciding whether to skip the build.
-needs_production_build() {
-  [ -f "$ROOT_DIR/.next/BUILD_ID" ] || return 0
-  node --input-type=module -e '
-    import { readFileSync } from "node:fs";
-    try {
-      const m = JSON.parse(readFileSync(process.argv[1], "utf8"));
-      process.exit(Array.isArray(m.dataRoutes) ? 0 : 1);
-    } catch { process.exit(1); }
-  ' "$ROOT_DIR/.next/routes-manifest.json" || return 0
-  return 1
-}
-
-if needs_production_build; then
-  echo "[omniharness] Building production server..."
+if node ./scripts/interface-build-state.mjs --check; then
+  :
+else
+  BUILD_STATE_EXIT=$?
+  if [ "$BUILD_STATE_EXIT" -ne 10 ]; then
+    echo "[omniharness] Could not inspect the production interface build." >&2
+    exit "$BUILD_STATE_EXIT"
+  fi
+  echo "[omniharness] Building production interface..."
   "${PNPM_CMD[@]}" build
+  node ./scripts/interface-build-state.mjs --write
 fi
 
 print_start_guidance
diff --git a/package.json b/package.json
index 45215a3..81c4e1a 100644
--- a/package.json
+++ b/package.json
@@ -18,15 +18,16 @@
     "predev": "node ./scripts/check-pnpm.mjs --verify-native",
     "dev": "pnpm exec tsx scripts/dev.ts",
     "dev:interface": "vite --config apps/interface/vite.config.ts --mode web",
-    "runner": "node --import tsx scripts/runner.ts",
+    "runner": "node --env-file-if-exists=.env --import tsx scripts/runner.ts",
     "auth:password": "node ./scripts/auth-password.mjs",
     "restart:control": "pnpm exec tsx scripts/remote-restart.ts",
     "prebuild": "node ./scripts/check-pnpm.mjs --verify-native",
     "setup:agents": "./scripts/install-agent-acp.sh",
+    "setup:tailscale": "node ./scripts/setup-tailscale.mjs",
     "build": "pnpm build:interface:web",
     "build:interface:web": "vite build --config apps/interface/vite.config.ts --mode web",
     "build:interface:packaged": "vite build --config apps/interface/vite.config.ts --mode packaged",
-    "start": "node --import tsx scripts/runner.ts",
+    "start": "node --env-file-if-exists=.env --import tsx scripts/runner.ts",
     "lint": "eslint",
     "typecheck": "tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.runner.json --noEmit && tsc -p tsconfig.interface.json --noEmit && tsc --noEmit",
     "test": "vitest run",
diff --git a/scripts/runner.ts b/scripts/runner.ts
index 7d95eb4..f428066 100644
--- a/scripts/runner.ts
+++ b/scripts/runner.ts
@@ -2,9 +2,27 @@
 import fs from "node:fs";
 import { resolveRunnerConfig } from "../src/server/runner/config";
 
+const RUNNER_HELP = `Usage: pnpm runner -- [options]
+
+Options:
+  --host <address>               API and interface bind address (default: 0.0.0.0)
+  --port <0-65535>               API and interface port (default: 3050)
+  --bridge-url <url>             Loopback ACP bridge URL (default: http://127.0.0.1:7800)
+  --static-dir <directory>       Serve an explicit built interface directory
+  --no-static                    Start the API without a production interface
+  --interface-dev-url <url>      Proxy interface requests to a Vite development server
+  -h, --help                     Show this help
+`;
+
 async function main() {
+  const rawArgv = process.argv.slice(2);
+  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
+  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
+    process.stdout.write(RUNNER_HELP);
+    return;
+  }
   const config = resolveRunnerConfig({
-    argv: process.argv.slice(2),
+    argv,
     cwd: process.cwd(),
     env: process.env,
   });
#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MARKER_VERSION = 1;
const BUILD_REQUIRED_EXIT = 10;
const INPUT_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.interface.json",
  "tsconfig.shared.json",
  "apps/interface",
  "shared/locales",
  "src/components",
  "src/interface",
  "src/lib",
  "src/runtime-api",
  "src/shared",
  "src/ui",
];

function readArgs(argv) {
  let mode = null;
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check" || arg === "--write") {
      if (mode) throw new TypeError("Use exactly one of --check or --write.");
      mode = arg;
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new TypeError("--root requires a directory.");
      root = path.resolve(value);
      index += 1;
      continue;
    }
    throw new TypeError(`Unknown interface build-state option: ${arg}`);
  }
  if (!mode) throw new TypeError("Use --check or --write.");
  return { mode, root };
}

async function collectFiles(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  if (stat.isFile()) return [relativePath];
  if (!stat.isDirectory()) return [];

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".DS_Store") continue;
    files.push(...await collectFiles(root, path.join(relativePath, entry.name)));
  }
  return files;
}

async function fingerprintInputs(root) {
  const hash = createHash("sha256");
  const files = [];
  for (const inputPath of INPUT_PATHS) {
    files.push(...await collectFiles(root, inputPath));
  }
  files.sort((left, right) => left.localeCompare(right));
  if (files.length === 0) throw new Error("No interface build inputs were found.");
  for (const relativePath of files) {
    hash.update(relativePath.split(path.sep).join("/"));
    hash.update("\0");
    hash.update(await fs.readFile(path.join(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function validateOutput(root) {
  const outputDir = path.join(root, "dist", "interface");
  const indexPath = path.join(outputDir, "index.html");
  let html;
  try {
    html = await fs.readFile(indexPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, reason: "production interface is missing" };
    }
    throw error;
  }

  const references = [...html.matchAll(/(?:src|href)=["']\/?(assets\/[^"'#?]+)["']/g)]
    .map((match) => match[1]);
  if (references.length === 0) {
    return { ok: false, reason: "production interface has no referenced assets" };
  }
  for (const reference of references) {
    try {
      const stat = await fs.stat(path.join(outputDir, reference));
      if (!stat.isFile()) throw new Error("not a file");
    } catch {
      return { ok: false, reason: `referenced asset is missing: ${reference}` };
    }
  }
  return { ok: true, outputDir };
}

async function readMarker(outputDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(outputDir, ".build-state.json"), "utf8"));
  } catch {
    return null;
  }
}

async function check(root) {
  const output = await validateOutput(root);
  if (!output.ok) return output.reason;
  const marker = await readMarker(output.outputDir);
  if (marker?.version !== MARKER_VERSION || typeof marker.fingerprint !== "string") {
    return "build marker is missing or invalid";
  }
  const fingerprint = await fingerprintInputs(root);
  if (marker.fingerprint !== fingerprint) return "source fingerprint changed";
  return null;
}

async function write(root) {
  const output = await validateOutput(root);
  if (!output.ok) throw new Error(output.reason);
  const markerPath = path.join(output.outputDir, ".build-state.json");
  const temporaryPath = `${markerPath}.tmp-${process.pid}`;
  const marker = {
    version: MARKER_VERSION,
    fingerprint: await fingerprintInputs(root),
  };
  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, markerPath);
  process.stdout.write(`[omniharness] Recorded interface build ${marker.fingerprint.slice(0, 12)}.\n`);
}

async function main() {
  const { mode, root } = readArgs(process.argv.slice(2));
  if (mode === "--write") {
    await write(root);
    return;
  }
  const reason = await check(root);
  if (reason) {
    process.stdout.write(`[omniharness] Interface build required: ${reason}.\n`);
    process.exit(BUILD_REQUIRED_EXIT);
  }
  process.stdout.write("[omniharness] Production interface is current.\n");
}

main().catch((error) => {
  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MANAGED_START = "# omniharness-tailscale-managed:start";
const MANAGED_END = "# omniharness-tailscale-managed:end";
const OWNED_KEYS = ["OMNIHARNESS_PUBLIC_ORIGIN", "OMNIHARNESS_RUNNER_HOST"];

function readArgs(argv) {
  if (argv[0] === "--") argv = argv.slice(1);
  const options = {
    root: process.cwd(),
    port: Number(process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || "3050"),
    dryRun: false,
    force: false,
    reset: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root" || arg === "--port") {
      const value = argv[index + 1];
      if (!value) throw new TypeError(`${arg} requires a value.`);
      if (arg === "--root") options.root = path.resolve(value);
      else options.port = Number(value);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--reset") options.reset = true;
    else throw new TypeError(`Unknown Tailscale setup option: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new TypeError("--port must be an integer from 1 to 65535.");
  }
  return options;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findTailscale() {
  const explicit = process.env.OMNIHARNESS_TAILSCALE_BIN?.trim();
  if (explicit) return isExecutable(explicit) ? explicit : null;
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, "tailscale");
    if (isExecutable(candidate)) return candidate;
  }
  for (const candidate of [
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    "/Applications/Tailscale.app/Contents/MacOS/tailscale",
  ]) {
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function invoke(tailscale, args, options = {}) {
  const result = spawnSync(tailscale, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`${detail}\nTailscale Serve may require an administrator, a configured operator, and HTTPS enabled for the tailnet.`);
  }
  return result;
}

function readTailnetStatus(tailscale) {
  const result = invoke(tailscale, ["status", "--json"]);
  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new Error("Tailscale returned invalid status JSON.");
  }
  if (status.BackendState !== "Running") {
    throw new Error(`Tailscale is not connected (state: ${status.BackendState || "unknown"}). Run \`tailscale up\`, then retry.`);
  }
  const dnsName = String(status.Self?.DNSName || "").replace(/\.$/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.ts\.net$/.test(dnsName)) {
    throw new Error("Tailscale status did not provide a valid tailnet DNS name. Ensure MagicDNS and HTTPS are enabled for the tailnet.");
  }
  return { dnsName, origin: `https://${dnsName}` };
}

function removeManagedBlock(text) {
  const start = text.indexOf(MANAGED_START);
  if (start === -1) return text;
  const end = text.indexOf(MANAGED_END, start);
  if (end === -1) throw new Error("The OmniHarness Tailscale block in .env is incomplete; repair it before continuing.");
  let removeStart = start;
  if (removeStart > 0 && text[removeStart - 1] === "\n") removeStart -= 1;
  let removeEnd = end + MANAGED_END.length;
  if (text[removeEnd] === "\r") removeEnd += 1;
  if (text[removeEnd] === "\n") removeEnd += 1;
  return `${text.slice(0, removeStart)}${text.slice(removeEnd)}`;
}

function activeOwnedSettings(text) {
  const values = new Map();
  for (const line of removeManagedBlock(text).split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function buildManagedEnv(text, settings, force) {
  const withoutManaged = removeManagedBlock(text);
  const existing = activeOwnedSettings(withoutManaged);
  const conflicts = OWNED_KEYS.filter((key) => {
    const current = existing.get(key);
    return current && current !== settings[key];
  });
  if (conflicts.length > 0 && !force) {
    const details = conflicts.map((key) => `${key}=${existing.get(key)}`).join(", ");
    throw new Error(`Existing remote-access settings would be replaced (${details}). Re-run with --force to preserve them as comments and continue.`);
  }

  const keptLines = [];
  const previousLines = [];
  for (const line of withoutManaged.split(/\r?\n/)) {
    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
    if (!match) {
      keptLines.push(line);
      continue;
    }
    if (force && match[2] && match[2] !== settings[match[1]]) {
      previousLines.push(`# omniharness-tailscale-previous: ${match[1]}=${match[2]}`);
    }
  }
  while (keptLines.at(-1) === "") keptLines.pop();
  const base = [...keptLines, ...previousLines].join("\n");
  const block = [
    MANAGED_START,
    `OMNIHARNESS_PUBLIC_ORIGIN=${settings.OMNIHARNESS_PUBLIC_ORIGIN}`,
    `OMNIHARNESS_RUNNER_HOST=${settings.OMNIHARNESS_RUNNER_HOST}`,
    MANAGED_END,
  ].join("\n");
  return `${base ? `${base}\n\n` : ""}${block}\n`;
}

function resetManagedEnv(text) {
  return removeManagedBlock(text).replace(/\n{2,}$/g, "\n");
}

async function readEnv(envPath) {
  try {
    return await fsp.readFile(envPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function stageEnv(envPath, text) {
  await fsp.mkdir(path.dirname(envPath), { recursive: true });
  const temporaryPath = `${envPath}.omniharness-tailscale.tmp-${process.pid}`;
  await fsp.writeFile(temporaryPath, text, { encoding: "utf8", mode: 0o600 });
  await fsp.chmod(temporaryPath, 0o600);
  return temporaryPath;
}

function inspectServeState(tailscale, target, force) {
  const result = invoke(tailscale, ["serve", "status", "--json"], { allowFailure: true });
  if (result.status !== 0 || !result.stdout.trim()) return;
  try {
    const status = JSON.parse(result.stdout);
    if (Object.keys(status).length > 0 && !JSON.stringify(status).includes(target) && !force) {
      throw new Error("Tailscale already has Serve configuration on this device. Re-run with --force only if OmniHarness may replace the default HTTPS listener.");
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

async function setup(options, tailscale) {
  const { origin } = readTailnetStatus(tailscale);
  const target = `http://127.0.0.1:${options.port}`;
  inspectServeState(tailscale, target, options.force);
  const envPath = path.join(options.root, ".env");
  const currentEnv = await readEnv(envPath);
  const nextEnv = buildManagedEnv(currentEnv, {
    OMNIHARNESS_PUBLIC_ORIGIN: origin,
    OMNIHARNESS_RUNNER_HOST: "127.0.0.1",
  }, options.force);

  if (options.dryRun) {
    process.stdout.write(`[omniharness] Would run: tailscale serve --bg ${target}\n`);
    process.stdout.write(`[omniharness] Would configure private origin: ${origin}\n`);
    return;
  }

  const stagedPath = await stageEnv(envPath, nextEnv);
  try {
    invoke(tailscale, ["serve", "--bg", target]);
  } catch (error) {
    await fsp.rm(stagedPath, { force: true });
    throw error;
  }
  try {
    await fsp.rename(stagedPath, envPath);
  } catch (error) {
    const rollback = invoke(tailscale, ["serve", "--https=443", "off"], { allowFailure: true });
    await fsp.rm(stagedPath, { force: true });
    const rollbackDetail = rollback.status === 0 ? "The new Serve listener was disabled." : `Serve rollback also failed: ${(rollback.stderr || rollback.stdout).trim()}`;
    throw new Error(`Tailscale Serve was configured, but .env could not be published. ${rollbackDetail}\n${error instanceof Error ? error.message : String(error)}`);
  }
  process.stdout.write(`[omniharness] Private OmniHarness URL: ${origin}\n`);
  process.stdout.write("[omniharness] Restart ./omniharness so the runner binds to loopback and uses this origin.\n");
}

async function reset(options, tailscale) {
  const envPath = path.join(options.root, ".env");
  const currentEnv = await readEnv(envPath);
  const nextEnv = resetManagedEnv(currentEnv);
  if (options.dryRun) {
    process.stdout.write("[omniharness] Would run: tailscale serve --https=443 off\n");
    process.stdout.write("[omniharness] Would remove the managed OmniHarness Tailscale settings from .env.\n");
    return;
  }
  const stagedPath = await stageEnv(envPath, nextEnv);
  try {
    invoke(tailscale, ["serve", "--https=443", "off"]);
    await fsp.rename(stagedPath, envPath);
  } catch (error) {
    await fsp.rm(stagedPath, { force: true });
    throw error;
  }
  process.stdout.write("[omniharness] Disabled the OmniHarness HTTPS Serve listener and removed its managed .env settings.\n");
}

async function main() {
  const options = readArgs(process.argv.slice(2));
  const tailscale = findTailscale();
  if (!tailscale) {
    throw new Error("Tailscale is not installed or its CLI is unavailable. Install the recommended standalone Mac app: https://tailscale.com/download/mac");
  }
  if (options.reset) await reset(options, tailscale);
  else await setup(options, tailscale);
}

main().catch((error) => {
  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
name: Verify macOS installation

on:
  push:
    branches: [master]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: macos-install-${{ github.ref }}
  cancel-in-progress: true

jobs:
  macos-install:
    name: Fresh Mac launcher
    runs-on: macos-15
    timeout-minutes: 20
    env:
      OMNIHARNESS_AUTH_PASSWORD: macos-release-smoke-password
      OMNIHARNESS_ROOT: ${{ runner.temp }}/omniharness-install-smoke
      OMNIHARNESS_RUNNER_HOST: 127.0.0.1
      OMNIHARNESS_RUNNER_PORT: 3059
      OMNIHARNESS_BRIDGE_URL: http://127.0.0.1:17809
      OMNIHARNESS_OPEN_BROWSER: 0
      OMNIHARNESS_SKIP_RECOMMENDED_TOOLS: 1

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup supported Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc

      - name: Confirm this is a fresh interface install
        run: test ! -e dist/interface/.build-state.json

      - name: Start through the real Mac launcher
        run: |
          ./omniharness > "$RUNNER_TEMP/omniharness-install.log" 2>&1 &
          echo "$!" > "$RUNNER_TEMP/omniharness-install.pid"

      - name: Wait for API health
        run: |
          node --input-type=module <<'NODE'
          const deadline = Date.now() + 120_000;
          const url = "http://127.0.0.1:3059/api/healthz";
          while (Date.now() < deadline) {
            try {
              const response = await fetch(url);
              if (response.ok) process.exit(0);
            } catch {}
            await new Promise((resolve) => setTimeout(resolve, 750));
          }
          throw new Error(`Timed out waiting for ${url}`);
          NODE

      - name: Verify production interface and build marker
        run: |
          node --input-type=module <<'NODE'
          import fs from "node:fs";
          const origin = "http://127.0.0.1:3059";
          const response = await fetch(origin);
          if (!response.ok) throw new Error(`Interface returned ${response.status}`);
          const html = await response.text();
          if (!html.includes("OmniHarness")) throw new Error("Response is not the OmniHarness interface");
          const assetPath = html.match(/(?:src|href)=["'](\/assets\/[^"'#?]+)["']/)?.[1];
          if (!assetPath) throw new Error("Interface HTML references no hashed asset");
          const assetResponse = await fetch(new URL(assetPath, origin));
          if (!assetResponse.ok) throw new Error(`Interface asset returned ${assetResponse.status}: ${assetPath}`);
          const marker = JSON.parse(fs.readFileSync("dist/interface/.build-state.json", "utf8"));
          if (marker.version !== 1 || !/^[a-f0-9]{64}$/.test(marker.fingerprint)) {
            throw new Error("Interface build marker is invalid");
          }
          NODE

      - name: Show launcher log on failure
        if: failure()
        run: test ! -f "$RUNNER_TEMP/omniharness-install.log" || tail -n 300 "$RUNNER_TEMP/omniharness-install.log"

      - name: Upload launcher log on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: macos-install-log
          path: ${{ runner.temp }}/omniharness-install.log

      - name: Stop isolated runner
        if: always()
        run: |
          if test -f "$RUNNER_TEMP/omniharness-install.pid"; then
            install_pid="$(cat "$RUNNER_TEMP/omniharness-install.pid")"
            if test -n "$install_pid" && kill -0 "$install_pid" 2>/dev/null; then
              kill "$install_pid"
              wait "$install_pid" 2>/dev/null || true
            fi
          fi


uuid: 0867191c-34ac-46c5-a850-e0e2765fa38a

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-05T21:01:30.565Z","phase":null} -->
## Claude thinking · 2026-08-05T21:01:30.565Z



uuid: a107e332-9951-4b57-9bb5-647dc61bc7ea
parent: 0867191c-34ac-46c5-a850-e0e2765fa38a

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-05T21:01:53.228Z","phase":null} -->
## Claude · 2026-08-05T21:01:53.228Z

## Blockers

**1. `omniharness` launcher port can disagree with the runner's actual port**
`package.json` now starts the runner with `--env-file-if-exists=.env`, so `OMNIHARNESS_RUNNER_PORT`/`OMNIHARNESS_RUNNER_HOST` from `.env` reach Node — but the launcher shell never reads `.env`. `WEB_PORT="${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}"` only sees the exported shell environment. A user who runs `pnpm setup:tailscale` (which writes into `.env`) or sets the port in `.env` gets a launcher that health-checks, prints, and pairs against `localhost:3050` while the server listens elsewhere — `local_omniharness_status` will report the wrong thing and startup guidance/pairing links will be wrong. The launcher must source the same `.env` (or ask the runner for its resolved port) before computing `WEB_PORT`.

**2. `setup-tailscale.mjs` rollback destroys unrelated Serve state**
Both the rename-failure path and `--reset` run `tailscale serve --https=443 off`, which disables the entire HTTPS:443 Serve configuration on the device, not just the listener this script added. Combined with `--force` (which lets `serve --bg` overwrite pre-existing config with no saved copy), a user with an existing Serve setup can lose it permanently. Snapshot `serve status --json` before mutating and restore it via `tailscale serve set`/config import on rollback, and scope `--reset` to the mount this tool created.

**3. `inspectServeState` mis-detects existing config (two bugs)**
- `tailscale serve status --json` emits `null` when nothing is configured on several versions; `Object.keys(null)` throws a `TypeError`, which the `catch` re-throws (only `SyntaxError` is tolerated). Fresh machines can hard-fail here.
- `JSON.stringify(status).includes(target)` is a substring test: target `http://127.0.0.1:3050` matches an unrelated existing proxy to `http://127.0.0.1:30500`, so the guard silently passes and the script overwrites that listener. Compare parsed proxy targets exactly.

**4. `--env-file-if-exists` has a Node floor that isn't enforced**
It requires Node ≥ 20.12 / 21.7. `pnpm start` and `pnpm runner` now fail with `bad option` on older supported Node. Confirm `.nvmrc` and the engines range enforce this, and note that `--env-file-if-exists=.env` is CWD-relative, so `pnpm start` from a subdirectory silently loses `.env`.

## Important bugs

**5. `scripts/interface-build-state.mjs` fingerprints whole directories, including generated/untracked files.** `apps/interface`, `src/lib`, `src/interface` etc. are walked with no ignore list beyond `.DS_Store` — no `node_modules`, `.vite`, `dist`, or editor temp filtering, and `fs.stat` follows symlinks (a symlinked or self-referential directory recurses forever). If the build or dev server writes anything under an `INPUT_PATH` (e.g. `apps/interface/.vite`), every launch rebuilds forever. Restrict inputs to tracked source or add an explicit ignore set, and use `lstat`.

**6. Launcher exits instead of building when the state script errors.** Any non-10 exit (missing script, permission error, transient ENOENT during the directory walk, symlink recursion from #5) aborts startup with `exit "$BUILD_STATE_EXIT"`. Failing open by rebuilding is the safer default for a user-facing installer.

**7. Lockfile comparison likely forces a reinstall on every launch.** `cmp -s pnpm-lock.yaml node_modules/.pnpm/lock.yaml` assumes pnpm always mirrors the lockfile byte-for-byte. It is not written under `node-linker=hoisted`, and it reflects the lockfile *after* pnpm's own normalization, so a repo whose committed lockfile differs cosmetically reinstalls on every start. Gate on the mismatch only after one install attempt, or compare a hash pnpm actually guarantees.

**8. The macOS CI job does not verify the stated release goal.** The claim under review is that a fresh user can install *without compiling ACP adapters*, but the workflow never asserts any adapter is present or that no compiler ran — and the launcher swallows adapter failures (`|| echo ... continuing`). As written, the job would pass with every ACP adapter broken. Add an assertion on `install-agent-acp.sh --ensure-only` output/exit and on the resolved adapter binaries.

## Minor (not blocking)

- `scripts/runner.ts`: help is only recognized when it is the sole argument, so `--port 3050 --help` falls through to config resolution.
- Removing the tunnel guidance leaves no in-CLI warning that the runner still defaults to binding `0.0.0.0` until `setup:tailscale` runs.
- Staged `.env.omniharness-tailscale.tmp-<pid>` files are left behind if the process is killed between `stageEnv` and rename (mode 0600, so low severity).

VERDICT: FIX

uuid: 75bf58dc-820b-45eb-afee-5f824bbd414c
parent: a107e332-9951-4b57-9bb5-647dc61bc7ea

<!-- /codex-event -->
