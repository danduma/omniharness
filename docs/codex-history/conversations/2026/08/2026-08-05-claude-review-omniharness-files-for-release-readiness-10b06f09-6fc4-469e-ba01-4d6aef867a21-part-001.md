---
provider: "claude"
codex_thread_id: "10b06f09-6fc4-469e-ba01-4d6aef867a21"
title: "Review omniharness files for release readiness"
started_at: "2026-08-05T21:12:43.157Z"
updated_at: "2026-08-05T21:13:49.835Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review omniharness files for release readiness

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T21:12:43.157Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T21:12:43.157Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-05T21:12:43.157Z",
  "sessionId": "10b06f09-6fc4-469e-ba01-4d6aef867a21",
  "content": "Read and review only these files in /Users/masterman/NLP/omniharness: omniharness, package.json, scripts/runner.ts, scripts/interface-build-state.mjs, scripts/setup-tailscale.mjs, .github/workflows/install-smoke.yml, README.md. Check only concrete release-blocking or important correctness/security/rollback/macOS-install problems. Do not modify anything. Reply under 500 words and end exactly VERDICT: READY or VERDICT: FIX."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T21:12:43.158Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T21:12:43.158Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-05T21:12:43.158Z",
  "sessionId": "10b06f09-6fc4-469e-ba01-4d6aef867a21"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-05T21:12:43.175Z","phase":null} -->
## User · 2026-08-05T21:12:43.175Z

Read and review only these files in /Users/masterman/NLP/omniharness: omniharness, package.json, scripts/runner.ts, scripts/interface-build-state.mjs, scripts/setup-tailscale.mjs, .github/workflows/install-smoke.yml, README.md. Check only concrete release-blocking or important correctness/security/rollback/macOS-install problems. Do not modify anything. Reply under 500 words and end exactly VERDICT: READY or VERDICT: FIX.

uuid: f3f56f1d-bbc2-4fb5-a96d-81ec070619f0

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-05T21:12:44.854Z","phase":null} -->
## Claude · 2026-08-05T21:12:44.854Z

I'll read those files now.

uuid: 60e33c79-b1e1-48d2-9aa0-9fccbf649b26
parent: f3f56f1d-bbc2-4fb5-a96d-81ec070619f0

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:45.326Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:45.326Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/omniharness"
}

uuid: 4995f2eb-982b-499c-af33-a2d246ad78f4
parent: 60e33c79-b1e1-48d2-9aa0-9fccbf649b26
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:45.344Z","phase":null} -->
## Claude tool result: toolu_01WHu9ph54svSKTDh2Hzz55t · 2026-08-05T21:12:45.344Z

```text
1	#!/usr/bin/env bash
2	set -euo pipefail
3	
4	ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
5	
6	cd "$ROOT_DIR"
7	
8	AUTH_PASSWORD_NOTICE_FILE=""
9	
10	print_auth_password_notice() {
11	  if [ -n "$AUTH_PASSWORD_NOTICE_FILE" ] && [ -s "$AUTH_PASSWORD_NOTICE_FILE" ]; then
12	    printf '\n'
13	    cat "$AUTH_PASSWORD_NOTICE_FILE"
14	    printf '\n'
15	    rm -f "$AUTH_PASSWORD_NOTICE_FILE"
16	    AUTH_PASSWORD_NOTICE_FILE=""
17	  fi
18	}
19	
20	cleanup_auth_password_notice() {
21	  if [ -n "$AUTH_PASSWORD_NOTICE_FILE" ]; then
22	    rm -f "$AUTH_PASSWORD_NOTICE_FILE"
23	  fi
24	}
25	
26	trap 'print_auth_password_notice; cleanup_auth_password_notice' EXIT
27	
28	# --- Ensure a supported Node.js version (>=22.13 <26) ---
29	# Native deps (better-sqlite3, @node-rs/argon2, sharp) only build on this range,
30	# so if the active Node is outside it, switch via nvm (installing nvm if needed)
31	# rather than failing. Set OMNIHARNESS_SKIP_NODE_AUTOINSTALL=1 to opt out.
32	MIN_NODE="${OMNIHARNESS_MIN_NODE_VERSION:-22.13.0}"
33	MAX_NODE_EXCL="${OMNIHARNESS_MAX_NODE_VERSION_EXCLUSIVE:-26.0.0}"
34	
35	node_version_ok() {
36	  command -v node >/dev/null 2>&1 || return 1
37	  node -e '
38	    const cmp = (a, b) => {
39	      a = String(a).replace(/^v/, "").split(".").map(Number);
40	      b = String(b).replace(/^v/, "").split(".").map(Number);
41	      for (let i = 0; i < 3; i += 1) {
42	        const x = a[i] || 0, y = b[i] || 0;
43	        if (x !== y) return x - y;
44	      }
45	      return 0;
46	    };
47	    const cur = process.versions.node;
48	    process.exit(cmp(cur, process.argv[1]) >= 0 && cmp(cur, process.argv[2]) < 0 ? 0 : 1);
49	  ' "$MIN_NODE" "$MAX_NODE_EXCL" 2>/dev/null
50	}
51	
52	if ! node_version_ok && [ "${OMNIHARNESS_SKIP_NODE_AUTOINSTALL:-0}" != "1" ]; then
53	  echo "[omniharness] Node $(node --version 2>/dev/null || echo 'missing') is unsupported (need >=$MIN_NODE <$MAX_NODE_EXCL); switching via nvm..." >&2
54	
55	  NODE_TARGET="22"
56	  [ -f "$ROOT_DIR/.nvmrc" ] && NODE_TARGET="$(tr -d ' \t\r\n' < "$ROOT_DIR/.nvmrc")"
57	  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
58	
59	  if [ ! -s "$NVM_DIR/nvm.sh" ] && command -v curl >/dev/null 2>&1; then
60	    echo "[omniharness] Installing nvm into $NVM_DIR..." >&2
61	    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash >/dev/null 2>&1 || true
62	  fi
63	
64	  # nvm.sh is not written for `set -euo pipefail`; relax it while sourcing/using.
65	  if [ -s "$NVM_DIR/nvm.sh" ]; then
66	    set +eu
67	    . "$NVM_DIR/nvm.sh"
68	    nvm install "$NODE_TARGET" >/dev/null 2>&1
69	    nvm use "$NODE_TARGET" >/dev/null 2>&1
70	    set -eu
71	  fi
72	fi
73	
74	if ! node_version_ok; then
75	  echo "OmniHarness requires Node.js >=$MIN_NODE <$MAX_NODE_EXCL, but the active Node is $(node --version 2>/dev/null || echo 'missing')." >&2
76	  echo "Auto-switch failed. Install a supported Node (e.g. 'nvm install ${NODE_TARGET:-22}'), then run ./omniharness again." >&2
77	  exit 1
78	elif [ -n "${NODE_TARGET:-}" ]; then
79	  echo "[omniharness] Using Node $(node --version)." >&2
80	fi
81	
82	PACKAGE_MANAGER="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; const packageJson = JSON.parse(readFileSync("package.json", "utf8")); if (!/^pnpm@/.test(packageJson.packageManager || "")) process.exit(1); process.stdout.write(packageJson.packageManager);')"
83	PNPM_VERSION="${PACKAGE_MANAGER#pnpm@}"
84	MIN_PNPM_MAJOR="${OMNIHARNESS_MIN_PNPM_MAJOR:-9}"
85	PNPM_ENV=(COREPACK_ENABLE_PROJECT_SPEC=0 pnpm_config_pm_on_fail=warn)
86	PNPM_CMD=()
87	
88	pnpm_major_ok() {
89	  local version="$1"
90	  local major="${version%%.*}"
91	  [ -n "$major" ] && [ "$major" -ge "$MIN_PNPM_MAJOR" ] 2>/dev/null
92	}
93	
94	running_under_wsl() {
95	  [ -r /proc/version ] && grep -qiE "microsoft|wsl" /proc/version
96	}
97	
98	is_windows_interop_command() {
99	  local command_path="$1"
100	  case "$command_path" in
101	    /mnt/[a-zA-Z] | /mnt/[a-zA-Z]/*) return 0 ;;
102	    *) return 1 ;;
103	  esac
104	}
105	
106	find_usable_command() {
107	  local command_name="$1"
108	  local command_path
109	  while IFS= read -r command_path; do
110	    [ -n "$command_path" ] || continue
111	    if running_under_wsl && is_windows_interop_command "$command_path"; then
112	      echo "[omniharness] Ignoring Windows $command_name shim at $command_path under WSL; using Linux tooling instead." >&2
113	      continue
114	    fi
115	    printf '%s' "$command_path"
116	    return 0
117	  done < <(type -P -a "$command_name" 2>/dev/null || true)
118	
119	  return 1
120	}
121	
122	if PNPM_PATH="$(find_usable_command pnpm)"; then
123	  CURRENT_PNPM_VERSION="$(env "${PNPM_ENV[@]}" "$PNPM_PATH" --version 2>/dev/null || true)"
124	  if pnpm_major_ok "$CURRENT_PNPM_VERSION"; then
125	    PNPM_CMD=(env "${PNPM_ENV[@]}" "$PNPM_PATH")
126	  fi
127	fi
128	
129	if [ "${#PNPM_CMD[@]}" -eq 0 ] && COREPACK_PATH="$(find_usable_command corepack)"; then
130	  echo "[omniharness] pnpm not usable; enabling it via Corepack..." >&2
131	  "$COREPACK_PATH" enable >/dev/null 2>&1 || true
132	  "$COREPACK_PATH" prepare "$PACKAGE_MANAGER" --activate >/dev/null 2>&1 || true
133	  CURRENT_PNPM_VERSION="$(env "${PNPM_ENV[@]}" "$COREPACK_PATH" pnpm --version 2>/dev/null || true)"
134	  if pnpm_major_ok "$CURRENT_PNPM_VERSION"; then
135	    PNPM_CMD=(env "${PNPM_ENV[@]}" "$COREPACK_PATH" pnpm)
136	  fi
137	fi
138	
139	# Last-resort auto-install: a global npm install of pnpm (no Corepack, no brew needed).
140	if [ "${#PNPM_CMD[@]}" -eq 0 ] && NPM_PATH="$(find_usable_command npm)"; then
141	  echo "[omniharness] pnpm not usable; installing it globally via npm..." >&2
142	  "$NPM_PATH" install -g pnpm >/dev/null 2>&1 || true
143	  if PNPM_PATH="$(find_usable_command pnpm)"; then
144	    CURRENT_PNPM_VERSION="$(env "${PNPM_ENV[@]}" "$PNPM_PATH" --version 2>/dev/null || true)"
145	    if pnpm_major_ok "$CURRENT_PNPM_VERSION"; then
146	      PNPM_CMD=(env "${PNPM_ENV[@]}" "$PNPM_PATH")
147	    fi
148	  fi
149	fi
150	
151	if [ "${#PNPM_CMD[@]}" -eq 0 ]; then
152	  if [ -n "${CURRENT_PNPM_VERSION:-}" ]; then
153	    echo "OmniHarness requires pnpm $MIN_PNPM_MAJOR or newer, but found pnpm $CURRENT_PNPM_VERSION." >&2
154	  else
155	    echo "OmniHarness requires pnpm $MIN_PNPM_MAJOR or newer. Install pnpm or enable Corepack, then run ./omniharness again." >&2
156	  fi
157	  echo "Corepack can use $PACKAGE_MANAGER as a known-good default when it is available." >&2
158	  exit 1
159	else
160	  echo "[omniharness] Using pnpm ${CURRENT_PNPM_VERSION:-unknown} (minimum supported major: $MIN_PNPM_MAJOR; known-good default: $PNPM_VERSION)."
161	fi
162	
163	LOCK_HASH_FILE="$ROOT_DIR/node_modules/.omniharness-pnpm-lock.sha256"
164	CURRENT_LOCK_HASH="$(node --input-type=module -e 'import { createHash } from "node:crypto"; import { readFileSync } from "node:fs"; process.stdout.write(createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"));' "$ROOT_DIR/pnpm-lock.yaml")"
165	INSTALLED_LOCK_HASH=""
166	if [ -f "$LOCK_HASH_FILE" ]; then
167	  INSTALLED_LOCK_HASH="$(tr -d ' \t\r\n' < "$LOCK_HASH_FILE")"
168	fi
169	
170	if [ ! -d "$ROOT_DIR/node_modules" ] \
171	  || [ ! -f "$ROOT_DIR/node_modules/.modules.yaml" ] \
172	  || [ ! -d "$ROOT_DIR/node_modules/.pnpm" ] \
173	  || [ "$INSTALLED_LOCK_HASH" != "$CURRENT_LOCK_HASH" ]; then
174	  echo "[omniharness] Installing dependencies with $PACKAGE_MANAGER..."
175	  env pnpm_config_dangerously_allow_all_builds=true "${PNPM_CMD[@]}" install
176	  node --input-type=module - "$LOCK_HASH_FILE" "$CURRENT_LOCK_HASH" <<'NODE'
177	import { renameSync, writeFileSync } from "node:fs";
178	const markerPath = process.argv[2];
179	const temporaryPath = `${markerPath}.tmp-${process.pid}`;
180	writeFileSync(temporaryPath, `${process.argv[3]}\n`, { mode: 0o600 });
181	renameSync(temporaryPath, markerPath);
182	NODE
183	fi
184	
185	./scripts/ensure-recommended-tools.sh
186	
187	AUTH_PASSWORD_NOTICE_FILE="$(mktemp "${TMPDIR:-/tmp}/omniharness-auth-password.XXXXXX")"
188	rm -f "$AUTH_PASSWORD_NOTICE_FILE"
189	OMNIHARNESS_AUTH_PASSWORD_NOTICE_FILE="$AUTH_PASSWORD_NOTICE_FILE" node ./scripts/setup-auth.mjs
190	
191	if [ "${OMNIHARNESS_SKIP_AGENT_ACP_SETUP:-0}" != "1" ]; then
192	  ./scripts/install-agent-acp.sh --ensure-only || echo "[omniharness] Agent ACP adapter setup reported issues; continuing." >&2
193	fi
194	
195	WEB_PORT="$(node --env-file-if-exists="$ROOT_DIR/.env" --input-type=module -e '
196	  const value = process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || "3050";
197	  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
198	    console.error(`Invalid OmniHarness web port: ${value}`);
199	    process.exit(1);
200	  }
201	  process.stdout.write(value);
202	')"
203	LOCAL_URL="http://localhost:${WEB_PORT}"
204	
205	local_omniharness_status() {
206	  node --input-type=module - "$LOCAL_URL" <<'NODE'
207	const localUrl = process.argv[2];
208	const sessionUrl = new URL("/api/auth/session", localUrl).toString();
209	
210	try {
211	  const response = await fetch(sessionUrl);
212	  if (!response.ok) {
213	    process.stdout.write("not_running");
214	    process.exit(0);
215	  }
216	
217	  const body = await response.json().catch(() => null);
218	  if (!body || typeof body !== "object" || !("enabled" in body) || !("authenticated" in body)) {
219	    process.stdout.write("not_running");
220	    process.exit(0);
221	  }
222	
223	  if (body.configurationError) {
224	    process.stdout.write("configuration_error");
225	    process.exit(0);
226	  }
227	
228	  process.stdout.write("ready");
229	} catch {
230	  process.stdout.write("not_running");
231	}
232	NODE
233	}
234	
235	open_browser_when_ready() {
236	  if [ "${OMNIHARNESS_OPEN_BROWSER:-1}" = "0" ]; then
237	    return
238	  fi
239	
240	  (
241	    node --input-type=module - "$LOCAL_URL" <<'NODE'
242	import { spawn } from "node:child_process";
243	
244	const localUrl = process.argv[2];
245	const sessionUrl = new URL("/api/auth/session", localUrl).toString();
246	
247	function sleep(ms) {
248	  return new Promise((resolve) => setTimeout(resolve, ms));
249	}
250	
251	async function waitUntilReady() {
252	  const deadline = Date.now() + 120_000;
253	  while (Date.now() < deadline) {
254	    try {
255	      const response = await fetch(sessionUrl);
256	      if (response.ok) {
257	        return true;
258	      }
259	    } catch {
260	      // The server is still starting.
261	    }
262	    await sleep(750);
263	  }
264	  return false;
265	}
266	
267	function openUrl(url) {
268	  const command = process.platform === "darwin"
269	    ? "open"
270	    : process.platform === "win32"
271	      ? "cmd"
272	      : "xdg-open";
273	  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
274	  const child = spawn(command, args, {
275	    detached: true,
276	    stdio: "ignore",
277	  });
278	  child.unref();
279	}
280	
281	if (await waitUntilReady()) {
282	  openUrl(localUrl);
283	}
284	NODE
285	  ) >/dev/null 2>&1 &
286	}
287	
288	print_tunnel_guidance() {
289	  echo "[omniharness] Private remote access (recommended):"
290	  echo "  pnpm setup:tailscale"
291	  echo "  This exposes only the web/API port to devices allowed by your tailnet."
292	  echo "[omniharness] Public internet access (optional): see the Cloudflare section in README.md."
293	}
294	
295	print_start_guidance() {
296	  echo ""
297	  echo "[omniharness] Starting OmniHarness."
298	  echo "[omniharness] Local URL: $LOCAL_URL"
299	  if [ "${OMNIHARNESS_OPEN_BROWSER:-1}" = "0" ]; then
300	    echo "[omniharness] Browser auto-open is disabled because OMNIHARNESS_OPEN_BROWSER=0."
301	  else
302	    echo "[omniharness] A browser window will open when the local server is ready."
303	  fi
304	  echo ""
305	  print_tunnel_guidance
306	  echo ""
307	}
308	
309	CURRENT_STATUS="$(local_omniharness_status)"
310	if [ "$CURRENT_STATUS" = "ready" ]; then
311	  echo ""
312	  echo "[omniharness] OmniHarness is already running at $LOCAL_URL."
313	  if [ "${OMNIHARNESS_OPEN_BROWSER:-1}" = "0" ]; then
314	    echo "[omniharness] Browser auto-open is disabled because OMNIHARNESS_OPEN_BROWSER=0."
315	  else
316	    echo "[omniharness] Opening the existing app."
317	  fi
318	  echo ""
319	  print_tunnel_guidance
320	  echo ""
321	  open_browser_when_ready
322	  exit 0
323	fi
324	
325	if [ "$CURRENT_STATUS" = "configuration_error" ]; then
326	  echo ""
327	  echo "[omniharness] OmniHarness is already running at $LOCAL_URL, but that process still has no auth password configured."
328	  echo "[omniharness] I created or found the password config for the next start. Stop the existing OmniHarness process, then run ./omniharness again."
329	  echo ""
330	  exit 1
331	fi
332	
333	BUILD_INTERFACE=0
334	if node ./scripts/interface-build-state.mjs --check; then
335	  :
336	else
337	  BUILD_STATE_EXIT=$?
338	  BUILD_INTERFACE=1
339	  if [ "$BUILD_STATE_EXIT" -ne 10 ]; then
340	    echo "[omniharness] Interface build inspection failed; rebuilding to recover." >&2
341	  fi
342	fi
343	
344	if [ "$BUILD_INTERFACE" -eq 1 ]; then
345	  echo "[omniharness] Building production interface..."
346	  "${PNPM_CMD[@]}" build
347	  if ! node ./scripts/interface-build-state.mjs --write; then
348	    echo "[omniharness] Could not record interface build state; future launches may rebuild it." >&2
349	  fi
350	fi
351	
352	print_start_guidance
353	print_auth_password_notice
354	open_browser_when_ready
355	
356	exec "${PNPM_CMD[@]}" start "$@"
357	

uuid: 94918f2c-d5fd-40b6-90d1-e81ed0339188
parent: 4995f2eb-982b-499c-af33-a2d246ad78f4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:45.806Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:45.806Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/package.json"
}

uuid: 249359e1-849c-4c9d-9885-c74ee46c8a7d
parent: 94918f2c-d5fd-40b6-90d1-e81ed0339188
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:45.820Z","phase":null} -->
## Claude tool result: toolu_01CJZ1DQrgJXs7xeUsYToBnx · 2026-08-05T21:12:45.820Z

```text
1	{
2	  "name": "omniharness",
3	  "version": "0.1.0",
4	  "description": "Local web UI, CLI, and ACP control plane for supervising coding agents.",
5	  "license": "AGPL-3.0-only",
6	  "private": true,
7	  "bin": {
8	    "omni": "./omni",
9	    "omniharness": "./omniharness"
10	  },
11	  "packageManager": "pnpm@11.2.2",
12	  "engines": {
13	    "node": ">=22.13 <26"
14	  },
15	  "scripts": {
16	    "smoke:claude-model-gateway": "tsx scripts/smoke-claude-model-gateway.ts",
17	    "preinstall": "node ./scripts/check-pnpm.mjs",
18	    "predev": "node ./scripts/check-pnpm.mjs --verify-native",
19	    "dev": "pnpm exec tsx scripts/dev.ts",
20	    "dev:interface": "vite --config apps/interface/vite.config.ts --mode web",
21	    "runner": "node --env-file-if-exists=.env --import tsx scripts/runner.ts",
22	    "auth:password": "node ./scripts/auth-password.mjs",
23	    "restart:control": "pnpm exec tsx scripts/remote-restart.ts",
24	    "prebuild": "node ./scripts/check-pnpm.mjs --verify-native",
25	    "setup:agents": "./scripts/install-agent-acp.sh",
26	    "setup:tailscale": "node --env-file-if-exists=.env ./scripts/setup-tailscale.mjs",
27	    "build": "pnpm build:interface:web",
28	    "build:interface:web": "vite build --config apps/interface/vite.config.ts --mode web",
29	    "build:interface:packaged": "vite build --config apps/interface/vite.config.ts --mode packaged",
30	    "start": "node --env-file-if-exists=.env --import tsx scripts/runner.ts",
31	    "lint": "eslint",
32	    "typecheck": "tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.runner.json --noEmit && tsc -p tsconfig.interface.json --noEmit && tsc --noEmit",
33	    "test": "vitest run",
34	    "test:watch": "vitest",
35	    "test:e2e": "playwright test",
36	    "test:e2e:live:claude": "playwright test --config playwright.live.config.ts",
37	    "test:e2e:live:cleanup": "tsx scripts/cleanup-live-agent-journey.ts",
38	    "test:e2e:live:unit": "vitest run --config vitest.live.config.ts",
39	    "electron:build": "node ./apps/electron/scripts/build.mjs",
40	    "electron:package:local": "node ./apps/electron/scripts/package-local.mjs",
41	    "vscode:build": "node ./apps/vscode/scripts/build.mjs",
42	    "vscode:package": "node ./apps/vscode/scripts/package.mjs",
43	    "mobile:sync": "pnpm --dir apps/mobile sync",
44	    "mobile:build:ios": "xcodebuild -project apps/mobile/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build",
45	    "mobile:build:android": "pnpm --dir apps/mobile exec -- ./android/gradlew -p ./android testDebugUnitTest assembleDebug",
46	    "test:lifecycle": "vitest run tests/lifecycle",
47	    "check:acp": "tsx scripts/check-acp-compatibility.ts",
48	    "measure:dev": "node ./scripts/measure-local-dev.mjs"
49	  },
50	  "dependencies": {
51	    "@agentclientprotocol/sdk": "0.25.0",
52	    "@ai-sdk/openai": "^3.0.64",
53	    "@base-ui/react": "^1.4.1",
54	    "@capacitor/core": "8.4.2",
55	    "@danduma/i18n": "github:danduma/i18n#ab2a85dddd2e176b61bec18d55736dbdd151fe41",
56	    "@fontsource-variable/geist": "5.3.0",
57	    "@fontsource-variable/geist-mono": "5.3.0",
58	    "@libsql/client": "^0.17.3",
59	    "@mastra/core": "^1.28.0",
60	    "@node-rs/argon2": "^2.0.2",
61	    "@tanstack/react-query": "^5.99.1",
62	    "@xterm/addon-fit": "^0.11.0",
63	    "@xterm/xterm": "^6.0.0",
64	    "adm-zip": "^0.5.17",
65	    "better-sqlite3": "^12.9.0",
66	    "class-variance-authority": "^0.7.1",
67	    "clsx": "^2.1.1",
68	    "drizzle-orm": "^0.45.2",
69	    "highlight.js": "^11.11.1",
70	    "js-yaml": "^4.1.1",
71	    "lucide-react": "^1.8.0",
72	    "node-pty": "^1.1.0",
73	    "proper-lockfile": "^4.1.2",
74	    "qrcode": "^1.5.4",
75	    "react": "19.1.0",
76	    "react-dom": "19.1.0",
77	    "shadcn": "^4.3.0",
78	    "tailwind-merge": "^3.5.0",
79	    "tw-animate-css": "^1.4.0",
80	    "web-push": "^3.6.7",
81	    "xterm": "^5.3.0",
82	    "xterm-addon-fit": "^0.8.0",
83	    "zod": "^3.25.76",
84	    "zustand": "^5.0.12"
85	  },
86	  "devDependencies": {
87	    "@playwright/test": "^1.53.0",
88	    "@electron/packager": "20.0.4",
89	    "@tailwindcss/postcss": "^4",
90	    "@types/adm-zip": "^0.5.8",
91	    "@types/better-sqlite3": "^7.6.13",
92	    "@types/blessed": "^0.1.27",
93	    "@types/js-yaml": "^4.0.9",
94	    "@types/node": "^20",
95	    "@types/proper-lockfile": "^4.1.4",
96	    "@types/qrcode": "^1.5.6",
97	    "@types/react": "^19",
98	    "@types/react-dom": "^19",
99	    "@types/vscode": "^1.120.0",
100	    "@vscode/vsce": "3.9.2",
101	    "@types/web-push": "^3.6.4",
102	    "@vitejs/plugin-react": "5.2.0",
103	    "blessed": "^0.1.81",
104	    "blessed-contrib": "^4.11.0",
105	    "drizzle-kit": "^0.31.10",
106	    "electron": "^42.2.0",
107	    "esbuild": "0.28.0",
108	    "eslint": "^9",
109	    "tailwindcss": "^4",
110	    "tsx": "^4.21.0",
111	    "typescript": "^5",
112	    "typescript-eslint": "^8.65.0",
113	    "vite": "7.3.2",
114	    "vite-tsconfig-paths": "^5.1.4",
115	    "vitest": "^3.1.0"
116	  }
117	}
118	

uuid: 39750fb1-2428-4f1a-84f9-be936ddfe8fc
parent: 249359e1-849c-4c9d-9885-c74ee46c8a7d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:46.268Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:46.268Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/scripts/runner.ts"
}

uuid: c612a5dc-0a9e-4091-bd6a-e114438b4696
parent: 39750fb1-2428-4f1a-84f9-be936ddfe8fc
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:46.276Z","phase":null} -->
## Claude tool result: toolu_01W3JhMNQjykYcbN9HHoYS66 · 2026-08-05T21:12:46.276Z

```text
1	#!/usr/bin/env node
2	import fs from "node:fs";
3	import { resolveRunnerConfig } from "../src/server/runner/config";
4	
5	const RUNNER_HELP = `Usage: pnpm runner -- [options]
6	
7	Options:
8	  --host <address>               API and interface bind address (default: 0.0.0.0)
9	  --port <0-65535>               API and interface port (default: 3050)
10	  --bridge-url <url>             Loopback ACP bridge URL (default: http://127.0.0.1:7800)
11	  --static-dir <directory>       Serve an explicit built interface directory
12	  --no-static                    Start the API without a production interface
13	  --interface-dev-url <url>      Proxy interface requests to a Vite development server
14	  -h, --help                     Show this help
15	`;
16	
17	async function main() {
18	  const rawArgv = process.argv.slice(2);
19	  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
20	  if (argv.some((arg) => ["--help", "-h"].includes(arg))) {
21	    process.stdout.write(RUNNER_HELP);
22	    return;
23	  }
24	  const config = resolveRunnerConfig({
25	    argv,
26	    cwd: process.cwd(),
27	    env: process.env,
28	  });
29	  if (
30	    config.staticDirExplicit
31	    && (!config.staticDir || !fs.existsSync(config.staticDir))
32	  ) {
33	    throw new Error(
34	      `The explicitly configured static directory does not exist: ${config.staticDir}`,
35	    );
36	  }
37	
38	  process.env.OMNIHARNESS_ROOT = config.instanceRoot;
39	  process.env.OMNIHARNESS_BRIDGE_URL = config.bridgeUrl;
40	  fs.mkdirSync(config.instanceRoot, { recursive: true });
41	  const { startRunnerProcess } = await import("../src/server/runner/run");
42	  const runner = await startRunnerProcess(config);
43	  process.stdout.write(`${JSON.stringify({
44	    ok: true,
45	    event: "runner.ready",
46	    origin: runner.origin,
47	    readiness: runner.readiness.getSnapshot(),
48	  })}\n`);
49	
50	  let shutdownPromise: Promise<void> | null = null;
51	  const shutdown = () => {
52	    if (!shutdownPromise) {
53	      shutdownPromise = runner.stop();
54	    }
55	    return shutdownPromise;
56	  };
57	  process.once("SIGINT", () => {
58	    void shutdown().then(() => process.exit(0));
59	  });
60	  process.once("SIGTERM", () => {
61	    void shutdown().then(() => process.exit(0));
62	  });
63	}
64	
65	main().catch((error) => {
66	  process.stderr.write(
67	    `[runner] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
68	  );
69	  process.exit(1);
70	});
71	

uuid: 0073eccd-1da3-4c0b-b64f-6cfc7b6a749f
parent: c612a5dc-0a9e-4091-bd6a-e114438b4696
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:47.338Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:47.338Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/scripts/interface-build-state.mjs"
}

uuid: 3483586a-5cb3-460d-816d-3355d166d7d7
parent: 0073eccd-1da3-4c0b-b64f-6cfc7b6a749f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:47.346Z","phase":null} -->
## Claude tool result: toolu_01BTCb792WnJ5TSEJqaL2dmX · 2026-08-05T21:12:47.346Z

```text
1	#!/usr/bin/env node
2	
3	import { createHash } from "node:crypto";
4	import fs from "node:fs/promises";
5	import path from "node:path";
6	
7	const MARKER_VERSION = 1;
8	const BUILD_REQUIRED_EXIT = 10;
9	const INPUT_PATHS = [
10	  "package.json",
11	  "pnpm-lock.yaml",
12	  "tsconfig.json",
13	  "tsconfig.interface.json",
14	  "tsconfig.shared.json",
15	  "apps/interface",
16	  "shared/locales",
17	  "src/components",
18	  "src/interface",
19	  "src/lib",
20	  "src/runtime-api",
21	  "src/shared",
22	  "src/ui",
23	];
24	const IGNORED_DIRECTORY_NAMES = new Set([".git", ".vite", "dist", "node_modules"]);
25	
26	function readArgs(argv) {
27	  let mode = null;
28	  let root = process.cwd();
29	  for (let index = 0; index < argv.length; index += 1) {
30	    const arg = argv[index];
31	    if (arg === "--check" || arg === "--write") {
32	      if (mode) throw new TypeError("Use exactly one of --check or --write.");
33	      mode = arg;
34	      continue;
35	    }
36	    if (arg === "--root") {
37	      const value = argv[index + 1];
38	      if (!value) throw new TypeError("--root requires a directory.");
39	      root = path.resolve(value);
40	      index += 1;
41	      continue;
42	    }
43	    throw new TypeError(`Unknown interface build-state option: ${arg}`);
44	  }
45	  if (!mode) throw new TypeError("Use --check or --write.");
46	  return { mode, root };
47	}
48	
49	async function collectFiles(root, relativePath) {
50	  const absolutePath = path.join(root, relativePath);
51	  let stat;
52	  try {
53	    stat = await fs.lstat(absolutePath);
54	  } catch (error) {
55	    if (error && error.code === "ENOENT") return [];
56	    throw error;
57	  }
58	  if (stat.isSymbolicLink()) return [{ relativePath, kind: "symlink" }];
59	  if (stat.isFile()) return [{ relativePath, kind: "file" }];
60	  if (!stat.isDirectory()) return [];
61	
62	  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
63	  const files = [];
64	  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
65	    if (entry.name === ".DS_Store" || IGNORED_DIRECTORY_NAMES.has(entry.name)) continue;
66	    files.push(...await collectFiles(root, path.join(relativePath, entry.name)));
67	  }
68	  return files;
69	}
70	
71	async function fingerprintInputs(root) {
72	  const hash = createHash("sha256");
73	  const files = [];
74	  for (const inputPath of INPUT_PATHS) {
75	    files.push(...await collectFiles(root, inputPath));
76	  }
77	  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
78	  if (files.length === 0) throw new Error("No interface build inputs were found.");
79	  for (const { relativePath, kind } of files) {
80	    hash.update(relativePath.split(path.sep).join("/"));
81	    hash.update("\0");
82	    if (kind === "symlink") {
83	      hash.update("symlink\0");
84	      hash.update(await fs.readlink(path.join(root, relativePath)));
85	    } else {
86	      hash.update(await fs.readFile(path.join(root, relativePath)));
87	    }
88	    hash.update("\0");
89	  }
90	  return hash.digest("hex");
91	}
92	
93	async function validateOutput(root) {
94	  const outputDir = path.join(root, "dist", "interface");
95	  const indexPath = path.join(outputDir, "index.html");
96	  let html;
97	  try {
98	    html = await fs.readFile(indexPath, "utf8");
99	  } catch (error) {
100	    if (error && error.code === "ENOENT") {
101	      return { ok: false, reason: "production interface is missing" };
102	    }
103	    throw error;
104	  }
105	
106	  const references = [...html.matchAll(/(?:src|href)=["']\/?(assets\/[^"'#?]+)["']/g)]
107	    .map((match) => match[1]);
108	  if (references.length === 0) {
109	    return { ok: false, reason: "production interface has no referenced assets" };
110	  }
111	  for (const reference of references) {
112	    try {
113	      const stat = await fs.stat(path.join(outputDir, reference));
114	      if (!stat.isFile()) throw new Error("not a file");
115	    } catch {
116	      return { ok: false, reason: `referenced asset is missing: ${reference}` };
117	    }
118	  }
119	  return { ok: true, outputDir };
120	}
121	
122	async function readMarker(outputDir) {
123	  try {
124	    return JSON.parse(await fs.readFile(path.join(outputDir, ".build-state.json"), "utf8"));
125	  } catch {
126	    return null;
127	  }
128	}
129	
130	async function check(root) {
131	  const output = await validateOutput(root);
132	  if (!output.ok) return output.reason;
133	  const marker = await readMarker(output.outputDir);
134	  if (marker?.version !== MARKER_VERSION || typeof marker.fingerprint !== "string") {
135	    return "build marker is missing or invalid";
136	  }
137	  const fingerprint = await fingerprintInputs(root);
138	  if (marker.fingerprint !== fingerprint) return "source fingerprint changed";
139	  return null;
140	}
141	
142	async function write(root) {
143	  const output = await validateOutput(root);
144	  if (!output.ok) throw new Error(output.reason);
145	  const markerPath = path.join(output.outputDir, ".build-state.json");
146	  const temporaryPath = `${markerPath}.tmp-${process.pid}`;
147	  const marker = {
148	    version: MARKER_VERSION,
149	    fingerprint: await fingerprintInputs(root),
150	  };
151	  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
152	  await fs.rename(temporaryPath, markerPath);
153	  process.stdout.write(`[omniharness] Recorded interface build ${marker.fingerprint.slice(0, 12)}.\n`);
154	}
155	
156	async function main() {
157	  const { mode, root } = readArgs(process.argv.slice(2));
158	  if (mode === "--write") {
159	    await write(root);
160	    return;
161	  }
162	  const reason = await check(root);
163	  if (reason) {
164	    process.stdout.write(`[omniharness] Interface build required: ${reason}.\n`);
165	    process.exit(BUILD_REQUIRED_EXIT);
166	  }
167	  process.stdout.write("[omniharness] Production interface is current.\n");
168	}
169	
170	main().catch((error) => {
171	  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
172	  process.exit(1);
173	});
174	

uuid: 5f66b158-72b0-4ebf-9a84-42569ff5a1a6
parent: 3483586a-5cb3-460d-816d-3355d166d7d7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:47.743Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:47.743Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/scripts/setup-tailscale.mjs"
}

uuid: 9766683e-5674-41dc-bd55-60236248e39b
parent: 5f66b158-72b0-4ebf-9a84-42569ff5a1a6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:47.756Z","phase":null} -->
## Claude tool result: toolu_01HLqd3oyPzH1SFc21NSZAdd · 2026-08-05T21:12:47.756Z

```text
1	#!/usr/bin/env node
2	
3	import fs from "node:fs";
4	import fsp from "node:fs/promises";
5	import path from "node:path";
6	import { spawnSync } from "node:child_process";
7	
8	const MANAGED_START = "# omniharness-tailscale-managed:start";
9	const MANAGED_END = "# omniharness-tailscale-managed:end";
10	const OWNED_KEYS = ["OMNIHARNESS_PUBLIC_ORIGIN", "OMNIHARNESS_RUNNER_HOST"];
11	
12	function readArgs(argv) {
13	  if (argv[0] === "--") argv = argv.slice(1);
14	  const options = {
15	    root: process.cwd(),
16	    port: Number(process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || "3050"),
17	    dryRun: false,
18	    force: false,
19	    reset: false,
20	  };
21	  for (let index = 0; index < argv.length; index += 1) {
22	    const arg = argv[index];
23	    if (arg === "--root" || arg === "--port") {
24	      const value = argv[index + 1];
25	      if (!value) throw new TypeError(`${arg} requires a value.`);
26	      if (arg === "--root") options.root = path.resolve(value);
27	      else options.port = Number(value);
28	      index += 1;
29	      continue;
30	    }
31	    if (arg === "--dry-run") options.dryRun = true;
32	    else if (arg === "--force") options.force = true;
33	    else if (arg === "--reset") options.reset = true;
34	    else throw new TypeError(`Unknown Tailscale setup option: ${arg}`);
35	  }
36	  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
37	    throw new TypeError("--port must be an integer from 1 to 65535.");
38	  }
39	  return options;
40	}
41	
42	function isExecutable(filePath) {
43	  try {
44	    fs.accessSync(filePath, fs.constants.X_OK);
45	    return true;
46	  } catch {
47	    return false;
48	  }
49	}
50	
51	function findTailscale() {
52	  const explicit = process.env.OMNIHARNESS_TAILSCALE_BIN?.trim();
53	  if (explicit) return isExecutable(explicit) ? explicit : null;
54	  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
55	    if (!directory) continue;
56	    const candidate = path.join(directory, "tailscale");
57	    if (isExecutable(candidate)) return candidate;
58	  }
59	  for (const candidate of [
60	    "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
61	    "/Applications/Tailscale.app/Contents/MacOS/tailscale",
62	  ]) {
63	    if (isExecutable(candidate)) return candidate;
64	  }
65	  return null;
66	}
67	
68	function invoke(tailscale, args, options = {}) {
69	  const result = spawnSync(tailscale, args, { encoding: "utf8" });
70	  if (result.error) throw result.error;
71	  if (result.status !== 0 && !options.allowFailure) {
72	    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
73	    throw new Error(`${detail}\nTailscale Serve may require an administrator, a configured operator, and HTTPS enabled for the tailnet.`);
74	  }
75	  return result;
76	}
77	
78	function readTailnetStatus(tailscale) {
79	  const result = invoke(tailscale, ["status", "--json"]);
80	  let status;
81	  try {
82	    status = JSON.parse(result.stdout);
83	  } catch {
84	    throw new Error("Tailscale returned invalid status JSON.");
85	  }
86	  if (status.BackendState !== "Running") {
87	    throw new Error(`Tailscale is not connected (state: ${status.BackendState || "unknown"}). Run \`tailscale up\`, then retry.`);
88	  }
89	  const dnsName = String(status.Self?.DNSName || "").replace(/\.$/, "");
90	  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.ts\.net$/.test(dnsName)) {
91	    throw new Error("Tailscale status did not provide a valid tailnet DNS name. Ensure MagicDNS and HTTPS are enabled for the tailnet.");
92	  }
93	  return { dnsName, origin: `https://${dnsName}` };
94	}
95	
96	function removeManagedBlock(text) {
97	  const start = text.indexOf(MANAGED_START);
98	  if (start === -1) return text;
99	  const end = text.indexOf(MANAGED_END, start);
100	  if (end === -1) throw new Error("The OmniHarness Tailscale block in .env is incomplete; repair it before continuing.");
101	  let removeStart = start;
102	  if (removeStart > 0 && text[removeStart - 1] === "\n") removeStart -= 1;
103	  let removeEnd = end + MANAGED_END.length;
104	  if (text[removeEnd] === "\r") removeEnd += 1;
105	  if (text[removeEnd] === "\n") removeEnd += 1;
106	  return `${text.slice(0, removeStart)}${text.slice(removeEnd)}`;
107	}
108	
109	function hasManagedBlock(text) {
110	  return text.includes(MANAGED_START) && text.includes(MANAGED_END);
111	}
112	
113	function activeOwnedSettings(text) {
114	  const values = new Map();
115	  for (const line of removeManagedBlock(text).split(/\r?\n/)) {
116	    if (/^\s*#/.test(line)) continue;
117	    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
118	    if (match) values.set(match[1], match[2]);
119	  }
120	  return values;
121	}
122	
123	function buildManagedEnv(text, settings, force) {
124	  const withoutManaged = removeManagedBlock(text);
125	  const existing = activeOwnedSettings(withoutManaged);
126	  const conflicts = OWNED_KEYS.filter((key) => {
127	    const current = existing.get(key);
128	    return current && current !== settings[key];
129	  });
130	  if (conflicts.length > 0 && !force) {
131	    const details = conflicts.map((key) => `${key}=${existing.get(key)}`).join(", ");
132	    throw new Error(`Existing remote-access settings would be replaced (${details}). Re-run with --force to preserve them as comments and continue.`);
133	  }
134	
135	  const keptLines = [];
136	  const previousLines = [];
137	  for (const line of withoutManaged.split(/\r?\n/)) {
138	    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
139	    if (!match) {
140	      keptLines.push(line);
141	      continue;
142	    }
143	    if (force && match[2] && match[2] !== settings[match[1]]) {
144	      previousLines.push(`# omniharness-tailscale-previous: ${match[1]}=${match[2]}`);
145	    }
146	  }
147	  while (keptLines.at(-1) === "") keptLines.pop();
148	  const base = [...keptLines, ...previousLines].join("\n");
149	  const block = [
150	    MANAGED_START,
151	    `OMNIHARNESS_PUBLIC_ORIGIN=${settings.OMNIHARNESS_PUBLIC_ORIGIN}`,
152	    `OMNIHARNESS_RUNNER_HOST=${settings.OMNIHARNESS_RUNNER_HOST}`,
153	    MANAGED_END,
154	  ].join("\n");
155	  return `${base ? `${base}\n\n` : ""}${block}\n`;
156	}
157	
158	function resetManagedEnv(text) {
159	  return removeManagedBlock(text).replace(/\n{2,}$/g, "\n");
160	}
161	
162	async function readEnv(envPath) {
163	  try {
164	    return await fsp.readFile(envPath, "utf8");
165	  } catch (error) {
166	    if (error?.code === "ENOENT") return "";
167	    throw error;
168	  }
169	}
170	
171	async function stageEnv(envPath, text) {
172	  await fsp.mkdir(path.dirname(envPath), { recursive: true });
173	  const temporaryPath = `${envPath}.omniharness-tailscale.tmp-${process.pid}`;
174	  await fsp.writeFile(temporaryPath, text, { encoding: "utf8", mode: 0o600 });
175	  await fsp.chmod(temporaryPath, 0o600);
176	  return temporaryPath;
177	}
178	
179	function collectProxyTargets(value, targets = []) {
180	  if (!value || typeof value !== "object") return targets;
181	  for (const [key, child] of Object.entries(value)) {
182	    if (key === "Proxy" && typeof child === "string") targets.push(child);
183	    else collectProxyTargets(child, targets);
184	  }
185	  return targets;
186	}
187	
188	function inspectServeState(tailscale, target) {
189	  const result = invoke(tailscale, ["serve", "status", "--json"], { allowFailure: true });
190	  if (result.status !== 0) {
191	    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
192	    throw new Error(`Could not inspect existing Tailscale Serve configuration; no settings were changed. ${detail}`);
193	  }
194	  if (!result.stdout.trim()) return { kind: "empty" };
195	  let status;
196	  try {
197	    status = JSON.parse(result.stdout);
198	  } catch {
199	    throw new Error("Tailscale returned invalid Serve status JSON; no Serve settings were changed.");
200	  }
201	  if (status === null || (typeof status === "object" && Object.keys(status).length === 0)) {
202	    return { kind: "empty" };
203	  }
204	  const targets = collectProxyTargets(status);
205	  if (targets.length === 1 && targets[0] === target) return { kind: "matching" };
206	  throw new Error("Tailscale already has Serve configuration on this device; OmniHarness will not replace it. Remove or relocate that Serve configuration, then retry.");
207	}
208	
209	async function setup(options, tailscale) {
210	  const { origin } = readTailnetStatus(tailscale);
211	  const target = `http://127.0.0.1:${options.port}`;
212	  const envPath = path.join(options.root, ".env");
213	  const currentEnv = await readEnv(envPath);
214	  const serveState = inspectServeState(tailscale, target);
215	  if (serveState.kind === "matching" && !hasManagedBlock(currentEnv)) {
216	    throw new Error("Tailscale already serves the OmniHarness target, but this repository does not own that listener. Remove it manually before running setup so reset cannot disable someone else's configuration.");
217	  }
218	  const nextEnv = buildManagedEnv(currentEnv, {
219	    OMNIHARNESS_PUBLIC_ORIGIN: origin,
220	    OMNIHARNESS_RUNNER_HOST: "127.0.0.1",
221	  }, options.force);
222	
223	  if (options.dryRun) {
224	    if (serveState.kind === "matching") {
225	      process.stdout.write(`[omniharness] Existing managed Serve listener already targets ${target}.\n`);
226	    } else {
227	      process.stdout.write(`[omniharness] Would run: tailscale serve --bg ${target}\n`);
228	    }
229	    process.stdout.write(`[omniharness] Would configure private origin: ${origin}\n`);
230	    return;
231	  }
232	
233	  const stagedPath = await stageEnv(envPath, nextEnv);
234	  let configuredServe = false;
235	  if (serveState.kind === "empty") {
236	    try {
237	      invoke(tailscale, ["serve", "--bg", target]);
238	      configuredServe = true;
239	    } catch (error) {
240	      await fsp.rm(stagedPath, { force: true });
241	      throw error;
242	    }
243	  }
244	  try {
245	    await fsp.rename(stagedPath, envPath);
246	  } catch (error) {
247	    const rollback = configuredServe
248	      ? invoke(tailscale, ["serve", "--https=443", "off"], { allowFailure: true })
249	      : { status: 0, stderr: "", stdout: "" };
250	    await fsp.rm(stagedPath, { force: true });
251	    const rollbackDetail = rollback.status === 0
252	      ? (configuredServe ? "The new Serve listener was disabled." : "The existing managed listener was left unchanged.")
253	      : `Serve rollback also failed: ${(rollback.stderr || rollback.stdout).trim()}`;
254	    throw new Error(`Tailscale Serve was configured, but .env could not be published. ${rollbackDetail}\n${error instanceof Error ? error.message : String(error)}`);
255	  }
256	  process.stdout.write(`[omniharness] Private OmniHarness URL: ${origin}\n`);
257	  process.stdout.write("[omniharness] Restart ./omniharness so the runner binds to loopback and uses this origin.\n");
258	}
259	
260	async function reset(options, tailscale) {
261	  const envPath = path.join(options.root, ".env");
262	  const currentEnv = await readEnv(envPath);
263	  if (!hasManagedBlock(currentEnv)) {
264	    process.stdout.write("[omniharness] No managed OmniHarness Tailscale setup was found; Serve was left unchanged.\n");
265	    return;
266	  }
267	  const target = `http://127.0.0.1:${options.port}`;
268	  const serveState = inspectServeState(tailscale, target);
269	  const nextEnv = resetManagedEnv(currentEnv);
270	  if (options.dryRun) {
271	    if (serveState.kind === "matching") {
272	      process.stdout.write("[omniharness] Would run: tailscale serve --https=443 off\n");
273	    } else {
274	      process.stdout.write("[omniharness] No active managed Serve listener needs to be disabled.\n");
275	    }
276	    process.stdout.write("[omniharness] Would remove the managed OmniHarness Tailscale settings from .env.\n");
277	    return;
278	  }
279	  const stagedPath = await stageEnv(envPath, nextEnv);
280	  let disabledServe = false;
281	  try {
282	    if (serveState.kind === "matching") {
283	      invoke(tailscale, ["serve", "--https=443", "off"]);
284	      disabledServe = true;
285	    }
286	    await fsp.rename(stagedPath, envPath);
287	  } catch (error) {
288	    await fsp.rm(stagedPath, { force: true });
289	    if (!disabledServe) throw error;
290	    const rollback = invoke(tailscale, ["serve", "--bg", target], { allowFailure: true });
291	    const detail = rollback.status === 0
292	      ? "The listener was restored."
293	      : `Listener restore also failed: ${(rollback.stderr || rollback.stdout).trim()}`;
294	    throw new Error(`The managed .env block could not be removed after disabling Serve. ${detail}\n${error instanceof Error ? error.message : String(error)}`);
295	  }
296	  process.stdout.write(`[omniharness] ${disabledServe ? "Disabled the OmniHarness HTTPS Serve listener and removed" : "Removed"} its managed .env settings.\n`);
297	}
298	
299	async function main() {
300	  const options = readArgs(process.argv.slice(2));
301	  const tailscale = findTailscale();
302	  if (!tailscale) {
303	    throw new Error("Tailscale is not installed or its CLI is unavailable. Install the recommended standalone Mac app: https://tailscale.com/download/mac");
304	  }
305	  if (options.reset) await reset(options, tailscale);
306	  else await setup(options, tailscale);
307	}
308	
309	main().catch((error) => {
310	  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
311	  process.exit(1);
312	});
313	

uuid: 97d8857a-e127-46a5-ace0-4048bea5b65c
parent: 9766683e-5674-41dc-bd55-60236248e39b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:48.209Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:48.209Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/.github/workflows/install-smoke.yml"
}

uuid: d5982fb7-0028-473e-9621-bf4ac3bf67b4
parent: 97d8857a-e127-46a5-ace0-4048bea5b65c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:48.212Z","phase":null} -->
## Claude tool result: toolu_011YTDuGPW6g9DpE6FpUJ6p1 · 2026-08-05T21:12:48.212Z

```text
1	name: Verify macOS installation
2	
3	on:
4	  push:
5	    branches: [master]
6	  pull_request:
7	  workflow_dispatch:
8	
9	permissions:
10	  contents: read
11	
12	concurrency:
13	  group: macos-install-${{ github.ref }}
14	  cancel-in-progress: true
15	
16	jobs:
17	  macos-install:
18	    name: Fresh Mac launcher
19	    runs-on: macos-15
20	    timeout-minutes: 20
21	    env:
22	      OMNIHARNESS_AUTH_PASSWORD: macos-release-smoke-password
23	      OMNIHARNESS_ROOT: ${{ runner.temp }}/omniharness-install-smoke
24	      OMNIHARNESS_RUNNER_HOST: 127.0.0.1
25	      OMNIHARNESS_RUNNER_PORT: 3059
26	      OMNIHARNESS_BRIDGE_URL: http://127.0.0.1:17809
27	      OMNIHARNESS_OPEN_BROWSER: 0
28	      OMNIHARNESS_SKIP_RECOMMENDED_TOOLS: 1
29	      OMNIHARNESS_CODEX_ACP_INSTALL: npm
30	      OMNIHARNESS_CODEX_ACP_NPM_ROOT: ${{ runner.temp }}/omniharness-codex-acp
31	      OMNIHARNESS_CODEX_ACP_INSTALL_DIR: ${{ runner.temp }}/omniharness-bin
32	
33	    steps:
34	      - name: Checkout
35	        uses: actions/checkout@v4
36	
37	      - name: Setup supported Node
38	        uses: actions/setup-node@v4
39	        with:
40	          node-version-file: .nvmrc
41	
42	      - name: Confirm this is a fresh interface install
43	        run: test ! -e dist/interface/.build-state.json
44	
45	      - name: Start through the real Mac launcher
46	        run: |
47	          ./omniharness > "$RUNNER_TEMP/omniharness-install.log" 2>&1 &
48	          echo "$!" > "$RUNNER_TEMP/omniharness-install.pid"
49	
50	      - name: Wait for API health
51	        run: |
52	          node --input-type=module <<'NODE'
53	          const deadline = Date.now() + 120_000;
54	          const url = "http://127.0.0.1:3059/api/healthz";
55	          while (Date.now() < deadline) {
56	            try {
57	              const response = await fetch(url);
58	              if (response.ok) process.exit(0);
59	            } catch {}
60	            await new Promise((resolve) => setTimeout(resolve, 750));
61	          }
62	          throw new Error(`Timed out waiting for ${url}`);
63	          NODE
64	
65	      - name: Verify production interface and build marker
66	        run: |
67	          node --input-type=module <<'NODE'
68	          import fs from "node:fs";
69	          const origin = "http://127.0.0.1:3059";
70	          const response = await fetch(origin);
71	          if (!response.ok) throw new Error(`Interface returned ${response.status}`);
72	          const html = await response.text();
73	          if (!html.includes("OmniHarness")) throw new Error("Response is not the OmniHarness interface");
74	          const assetPath = html.match(/(?:src|href)=["'](\/assets\/[^"'#?]+)["']/)?.[1];
75	          if (!assetPath) throw new Error("Interface HTML references no hashed asset");
76	          const assetResponse = await fetch(new URL(assetPath, origin));
77	          if (!assetResponse.ok) throw new Error(`Interface asset returned ${assetResponse.status}: ${assetPath}`);
78	          const marker = JSON.parse(fs.readFileSync("dist/interface/.build-state.json", "utf8"));
79	          if (marker.version !== 1 || !/^[a-f0-9]{64}$/.test(marker.fingerprint)) {
80	            throw new Error("Interface build marker is invalid");
81	          }
82	          NODE
83	
84	      - name: Verify the published Codex ACP installation
85	        run: |
86	          test -x "$OMNIHARNESS_CODEX_ACP_INSTALL_DIR/codex-acp"
87	          PATH="$OMNIHARNESS_CODEX_ACP_INSTALL_DIR:$PATH" codex-acp --version
88	          node -e 'process.stdout.write(require(process.argv[1]).version)' \
89	            "$OMNIHARNESS_CODEX_ACP_NPM_ROOT/node_modules/@agentclientprotocol/codex-acp/package.json"
90	          node -e 'process.stdout.write(require(process.argv[1]).version)' \
91	            "$OMNIHARNESS_CODEX_ACP_NPM_ROOT/node_modules/@openai/codex/package.json"
92	          if grep -E 'cargo install|building Docker image' "$RUNNER_TEMP/omniharness-install.log"; then
93	            echo "ACP setup compiled an adapter instead of using published packages." >&2
94	            exit 1
95	          fi
96	
97	      - name: Show launcher log on failure
98	        if: failure()
99	        run: test ! -f "$RUNNER_TEMP/omniharness-install.log" || tail -n 300 "$RUNNER_TEMP/omniharness-install.log"
100	
101	      - name: Upload launcher log on failure
102	        if: failure()
103	        uses: actions/upload-artifact@v4
104	        with:
105	          name: macos-install-log
106	          path: ${{ runner.temp }}/omniharness-install.log
107	
108	      - name: Stop isolated runner
109	        if: always()
110	        run: |
111	          if test -f "$RUNNER_TEMP/omniharness-install.pid"; then
112	            install_pid="$(cat "$RUNNER_TEMP/omniharness-install.pid")"
113	            if test -n "$install_pid" && kill -0 "$install_pid" 2>/dev/null; then
114	              kill "$install_pid"
115	              wait "$install_pid" 2>/dev/null || true
116	            fi
117	          fi
118	

uuid: bba3760d-adaf-47cf-9d78-914c3b9a59c3
parent: d5982fb7-0028-473e-9621-bf4ac3bf67b4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-08-05T21:12:48.422Z","phase":null} -->
## Claude tool call: Read · 2026-08-05T21:12:48.422Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/README.md"
}

uuid: de3afc9d-87bf-4a8e-ad70-b57c3c854c4c
parent: bba3760d-adaf-47cf-9d78-914c3b9a59c3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-08-05T21:12:48.428Z","phase":null} -->
## Claude tool result: toolu_01Bkw2f8ALg4XBQYKt6D4kK7 · 2026-08-05T21:12:48.428Z

````text
1	# OmniHarness
2	
3	OmniHarness is a local control plane for supervising ACP-backed coding agents.
4	One logical headless runner owns SQLite, auth, supervision, PTYs, and agent
5	processes; the shared Vite interface runs in the web/PWA, Electron, iOS,
6	Android, and VS Code and can stay connected to multiple runners.
7	
8	Use it when you want one durable place to start coding-agent runs, watch worker output, recover conversations, inspect execution events, and keep local agent processes behind a clear supervisory layer.
9	
10	## What You Get
11	
12	- **Multi-agent supervision:** start implementation, planning, and direct-control conversations with supported ACP workers.
13	- **Live run visibility:** stream messages, worker output, execution events, and status changes while a run is active.
14	- **Durable local history:** persist runs, messages, workers, settings, auth records, and execution events in SQLite.
15	- **CLI parity:** launch and watch the same conversation modes from the terminal.
16	- **ACP server mode:** expose OmniHarness itself as an ACP agent over stdio for compatible clients.
17	- **Managed agent environment:** spawn workers with a practical `PATH` even when the app starts from a GUI, editor, or service manager.
18	- **Phone-friendly local UI:** run the web app as a local PWA for supervising work away from the terminal.
19	- **Multi-runner clients:** save any number of authenticated runners, keep their
20	  event streams live, and switch the visible workspace without reconnecting.
21	
22	## Project Status
23	
24	OmniHarness is early open-source software under active development. Expect sharp edges, fast-moving internals, and occasional database or workflow changes. The core local loop is the priority: reliable worker launch, observable agent activity, durable recovery, and straightforward developer setup.
25	
26	## Install On macOS
27	
28	The supported release path is a Mac with `git`, `curl`, and Terminal. Clone the
29	repository and run the launcher:
30	
31	```bash
32	git clone https://github.com/danduma/omniharness.git
33	cd omniharness
34	./omniharness
35	```
36	
37	That one command installs and starts the server and production UI together. It:
38	
39	1. selects a supported Node version (`>=22.13 <26`);
40	2. installs the repository's pnpm version and dependencies;
41	3. installs the maintained Codex ACP adapter and Codex CLI from published npm
42	   packages, with no ACP source build;
43	4. builds the production Vite interface when its inputs change; and
44	5. starts OmniHarness and opens [http://localhost:3050](http://localhost:3050).
45	
46	On first start, choose a web login password or press Enter to generate one. A
47	generated password is printed once; save it before continuing. OmniHarness
48	stores only its Argon2 hash in `.env`.
49	
50	Set `OMNIHARNESS_OPEN_BROWSER=0` if you do not want the launcher to open a
51	browser automatically.
52	
53	The running deployment contains:
54	
55	- the API/SSE server and production web interface together on `http://localhost:3050`
56	- the co-located ACP bridge on `http://127.0.0.1:7800`
57	
58	There is no separate production UI server to install or expose. The separate
59	Vite process is only for development.
60	
61	To update an installation later:
62	
63	```bash
64	git pull --ff-only
65	./omniharness
66	```
67	
68	The launcher refreshes its managed published Codex ACP and Codex packages when
69	new versions are available and rebuilds the UI only when needed. Rolling release
70	automation separately checks new Codex/model metadata against OmniHarness.
71	
72	### Requirements and supported agents
73	
74	- macOS with `git`, `curl`, and a normal Terminal shell. Linux uses the same
75	  shell launcher but is not release-gated yet.
76	- `ripgrep` (`rg`) is recommended for fast repository search. The launcher
77	  installs it when a supported system package manager is available. Set
78	  `OMNIHARNESS_SKIP_RECOMMENDED_TOOLS=1` to skip that step.
79	- At least one coding agent for real worker runs:
80	  - Codex (published ACP adapter and Codex CLI installed by the launcher)
81	  - Claude CLI plus `claude-agent-acp`
82	  - Gemini CLI with native ACP mode
83	  - OpenCode with native ACP mode
84	
85	Start the runner directly with `pnpm runner`. Use `--no-static` for a supported
86	API-only deployment, or `--static-dir <path>` for an explicit interface
87	artifact.
88	
89	## Clients and deployment
90	
91	The browser/PWA is served by any runner with `dist/interface`. The other hosts
92	are remote clients and never embed or start a runner:
93	
94	```bash
95	pnpm electron:build
96	pnpm electron:package:local
97	pnpm vscode:build
98	pnpm vscode:package
99	pnpm mobile:sync
100	```
101	
102	Operational and security details:
103	
104	- [Runner deployment, data roots, proxies, backup, and smoke checks](docs/deployment/runner-operations.md)
105	- [Authentication, sessions, credential storage, identity, and TLS](docs/security/authentication-and-tls.md)
106	- [Desktop/editor migration, mobile/PWA limits, and v1 non-goals](docs/platforms/client-migration-and-limits.md)
107	
108	Run the separate restart control app if you want a small remote escape hatch
109	with its own password-gated interface:
110	
111	```bash
112	pnpm restart:control
113	```
114	
115	It listens on port `3099`. Open `http://localhost:3099` to see status, recent
116	logs, and buttons to start OmniHarness in dev or production mode. The web login
117	uses `OMNIHARNESS_AUTH_PASSWORD_HASH` or `OMNIHARNESS_AUTH_PASSWORD` when either
118	is configured, then falls back to `OMNIHARNESS_REMOTE_RESTART_PASSWORD`, then to
119	the generated token file.
120	
121	To keep the restart controller alive across reboots even when macOS does not
122	auto-login, install the boot-time daemon:
123	
124	```bash
125	./scripts/install-restarter.sh
126	```
127	
128	It installs as a `LaunchDaemon` by default. If you explicitly want the older
129	login-session `LaunchAgent` behavior, set
130	`OMNIHARNESS_RESTART_LAUNCHD_SCOPE=user` before running the installer.
131	
132	The script API creates `.omniharness/remote-restart-token` on first run and
133	accepts bearer auth:
134	
135	```bash
136	curl -X POST "http://HOST:3099/restart?mode=dev" \
137	  -H "Authorization: Bearer $(cat .omniharness/remote-restart-token)"
138	```
139	
140	Use `mode=prod` to launch `./omniharness` instead of `pnpm run dev`.
141	
142	For public access through Cloudflare Tunnel, expose the restart app as a second
143	hostname only if you intentionally want that public-tunnel deployment:
144	
145	```yaml
146	ingress:
147	  - hostname: horse-battery-staple.omniharness.dev
148	    service: http://localhost:3050
149	  - hostname: restart-horse-battery-staple.omniharness.dev
150	    service: http://localhost:3099
151	  - service: http_status:404
152	```
153	
154	## Optional Setup
155	
156	Create a local env file only if you want password auth, phone pairing, public-origin links, or API-key based agent/model access:
157	
158	```bash
159	cp .env.example .env
160	```
161	
162	Local agent CLIs that are already logged in usually work without API keys. If you want the supervisor model or runtime workers to use provider keys from the environment, fill in the relevant variables in `.env`.
163	
164	## Password Auth
165	
166	OmniHarness requires a password before the web UI can create an authenticated session or pair a phone.
167	
168	For the simplest local setup, run the launcher and follow the prompt:
169	
170	```bash
171	./omniharness
172	```
173	
174	If `.env` or the current shell already contains `OMNIHARNESS_AUTH_PASSWORD` or
175	`OMNIHARNESS_AUTH_PASSWORD_HASH`, the launcher keeps that existing configuration.
176	
177	Change or reset the password from the repo root:
178	
179	```bash
180	pnpm auth:password set
181	```
182	
183	Pass the password as an argument when you need a one-line command:
184	
185	```bash
186	pnpm auth:password set "new-password"
187	```
188	
189	The command removes active `OMNIHARNESS_AUTH_PASSWORD` and
190	`OMNIHARNESS_AUTH_PASSWORD_HASH` lines from `.env`, then writes one fresh
191	Argon2 hash. Restart OmniHarness after changing the password.
192	
193	Check or test the configured password:
194	
195	```bash
196	pnpm auth:password status
197	pnpm auth:password verify "new-password"
198	```
199	
200	Hash-only passwords cannot be printed back out. If `status` says the password is
201	hash-only and you do not know it, run `pnpm auth:password set` to replace it.
202	
203	## Private Access With Tailscale
204	
205	Tailscale Serve is the recommended way to reach OmniHarness from another Mac,
206	phone, or tablet. It keeps the service inside your tailnet, applies your
207	Tailscale access rules, and provides a private HTTPS URL. Install the recommended
208	standalone [Tailscale app for macOS](https://tailscale.com/download/mac), sign in,
209	and run:
210	
211	```bash
212	pnpm setup:tailscale
213	./omniharness
214	```
215	
216	The command verifies the tailnet connection, refuses to overwrite an existing
217	LAN or tunnel configuration, configures:
218	
219	```bash
220	tailscale serve --bg http://127.0.0.1:3050
221	```
222	
223	It writes the private `https://...ts.net` origin and loopback bind address to the
224	ignored local `.env`; the second command restarts OmniHarness with those values.
225	
226	Check the real private route with `tailscale serve status`, then open the printed
227	URL from another device on the tailnet. Password authentication remains required;
228	tailnet membership is an additional security boundary, not a replacement.
229	
230	Useful safe operations:
231	
232	```bash
233	pnpm setup:tailscale -- --dry-run  # inspect without changing Tailscale or .env
234	pnpm setup:tailscale -- --force    # preserve conflicting values as comments, then replace them
235	pnpm setup:tailscale -- --reset    # disable OmniHarness HTTPS Serve and remove managed settings
236	```
237	
238	`--force` applies only to conflicting OmniHarness values in `.env`. The command
239	never replaces an unrelated existing Tailscale Serve route; move or remove that
240	route explicitly first.
241	
242	If Serve reports an operator, administrator, MagicDNS, or HTTPS-certificate
243	problem, follow the exact Tailscale error and retry. The setup command leaves
244	`.env` unchanged when Serve fails.
245	
246	### Optional Public Access With Cloudflare
247	
248	Use a public tunnel only when tailnet-only access is not sufficient. Expose port
249	`3050`, never the ACP bridge on `7800`:
250	
251	```bash
252	cloudflared tunnel --url http://localhost:3050
253	```
254	
255	Set `OMNIHARNESS_PUBLIC_ORIGIN` in `.env` to the generated HTTPS URL and restart
256	OmniHarness. Keep OmniHarness password authentication enabled even when the
257	tunnel provider has separate access controls.
258	
259	The launcher does not require a global `omniharness` install. Run the app from
260	the checkout with `./omniharness`, and run CLI conversations from the checkout
261	with `./omni`.
262	
263	Preview the agent adapter setup only when you want to install or refresh
264	optional ACP adapters:
265	
266	```bash
267	scripts/install-agent-acp.sh --dry-run
268	```
269	
270	Then run the installer directly when you are ready:
271	
272	```bash
273	scripts/install-agent-acp.sh
274	```
275	
276	The setup script detects supported local coding agents and installs or refreshes
277	the ACP adapters they need. Codex uses the maintained
278	`@agentclientprotocol/codex-acp` package plus the current `@openai/codex`
279	package. The Codex package selects its published macOS binary for the current
280	CPU; the user does not compile an ACP adapter. Claude's adapter is installed from
281	npm, while Gemini and OpenCode expose native ACP commands and need no separate
282	adapter. The setup script also checks common agent tools.
283	
284	### Codex ACP Updates
285	
286	Normal `./omniharness` startup checks the managed Codex ACP and Codex CLI package
287	versions and rolls both forward when npm publishes an update. Force an immediate
288	refresh with:
289	
290	```bash
291	scripts/install-agent-acp.sh --codex-acp=npm
292	```
293	
294	Useful overrides:
295	
296	```bash
297	OMNIHARNESS_CODEX_ACP_INSTALL=npm
298	OMNIHARNESS_CODEX_ACP_NPM_ROOT=/custom/package/root
299	OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin
300	```
301	
302	Cargo mode remains an explicit adapter-development override and is never used by
303	normal installation:
304	
305	```bash
306	scripts/install-agent-acp.sh --codex-acp=cargo
307	```
308	
309	### Docker-backed Codex ACP
310	
311	If you deliberately want ACP isolation, install a Docker-backed wrapper instead:
312	
313	```bash
314	OMNIHARNESS_CODEX_ACP_INSTALL=docker ./omniharness
315	```
316	
317	Or run the adapter installer directly:
318	
319	```bash
320	scripts/install-agent-acp.sh --codex-acp=docker
321	```
322	
323	This builds the local image `omniharness/codex-acp:local`, installs a
324	`codex-acp` wrapper into `~/.local/bin`, and runs the ACP adapter inside Docker
325	while mounting the current project and Codex credential/config paths. The normal
326	OmniHarness worker `PATH` already includes `~/.local/bin`, so no extra PATH
327	setup is usually needed.
328	
329	Useful overrides:
330	
331	```bash
332	OMNIHARNESS_CODEX_ACP_DOCKER_IMAGE=ghcr.io/your-org/codex-acp:latest
333	OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin
334	OMNIHARNESS_DOCKER_BIN=podman
335	OMNIHARNESS_CODEX_ACP_DOCKER_AS_ROOT=1
336	```
337	
338	On Podman machines, start the VM first if needed:
339	
340	```bash
341	podman machine start
342	OMNIHARNESS_CODEX_ACP_INSTALL=docker OMNIHARNESS_DOCKER_BIN=podman ./omniharness
343	```
344	
345	If you build the image locally instead of using a prebuilt image, give the
346	Podman VM more than the default 2 GiB memory:
347	
348	```bash
349	podman machine stop
350	podman machine set --memory 8192
351	podman machine start
352	```
353	
354	The container includes Node.js, Codex CLI, `codex-acp`, `git`, `rg`, Python,
355	`jq`, `make`, and common shell tools. Project commands run inside the Linux
356	container, so host-only tools still need to be installed in the image or run via
357	a non-Docker adapter.
358	
359	## Development
360	
361	Run the runner and Vite interface together:
362	
363	```bash
364	pnpm dev
365	```
366	
367	Or run them independently:
368	
369	```bash
370	pnpm runner --host 127.0.0.1 --port 3050
371	pnpm dev:interface
372	```
373	
374	Run checks before opening a pull request:
375	
376	```bash
377	pnpm test
378	pnpm build
379	```
380	
381	## CLI
382	
383	Run the same ACP-backed conversation modes from the terminal:
384	
385	```bash
386	./omni -i -w codex "implement docs/superpowers/plans/example.md"
387	./omni -p -w gemini "write a plan for the CLI parity work"
388	./omni -w codex "inspect the current repo state"
389	```
390	
391	By default, the CLI starts direct-control conversations, watches the created run, and prints messages, execution events, and worker output updates. Use `-i` for implementation, `-p` for planning, `-w` to choose a worker, `--no-watch` for fire-and-return behavior, or `--json` to print the created conversation payload. The legacy implementation shorthand still works:
392	
393	```bash
394	./omni docs/superpowers/plans/example.md
395	```
396	
397	Run OmniHarness itself as an ACP agent over stdio:
398	
399	```bash
400	./omni acp
401	```
402	
403	In ACP mode, clients can create sessions, list persisted Omni runs, load or resume a run, fork a fresh ACP session from an existing run, switch between `implementation`, `planning`, and `direct`, prompt OmniHarness to start or continue conversations, and receive streamed run updates as ACP `session/update` notifications.
404	
405	## Runtime Data
406	
407	OmniHarness stores persisted conversation state in SQLite at `sqlite.db` under the app root. The app root is `OMNIHARNESS_ROOT` when set, otherwise the current working directory used to start the app.
408	
409	For normal local development, inspect runs, messages, workers, execution events, settings, and auth records with:
410	
411	```bash
412	sqlite3 sqlite.db
413	```
414	
415	`.omniharness/` is used for runtime side files such as the managed runtime lock, but it is not the default conversation database location.
416	
417	To delete all conversations and associated persisted artifacts:
418	
419	```bash
420	scripts/delete-conversations.sh
421	```
422	
423	## Agent Tool Environment
424	
425	ACP workers may be launched from a GUI app, service manager, editor integration, or another non-login process. Those environments often do not inherit the same `PATH` as your normal terminal.
426	
427	Before spawning agents, the OmniHarness runtime builds a managed worker `PATH` that includes:
428	
429	- project `node_modules/.bin`
430	- common user bins such as `~/.cargo/bin`, `~/.local/bin`, `~/.bun/bin`, `~/.opencode/bin`, and pyenv shims
431	- Homebrew, MacPorts, and system bins
432	- the inherited environment `PATH`
433	- login-shell `PATH` when available
434	
435	This keeps agents from losing essential tools just because the runtime was started from a thin environment. Installing tools globally is still recommended, but the runtime no longer depends only on the parent process `PATH`.
436	
437	Inspect runtime-side agent health with:
438	
439	```bash
440	curl http://127.0.0.1:7800/doctor
441	```
442	
443	The doctor response reports adapter availability, API key status, endpoint reachability, and tool diagnostics.
444	
445	## External Credential Profiles
446	
447	OmniHarness can apply a generic credential env overlay before spawning any ACP worker. Configure it in Settings -> Agents, set `OMNIHARNESS_CREDENTIAL_PROFILES_DIR` to a directory of profiles, or use the default `.omniharness/credential-profiles` under the OmniHarness root.
448	
449	Profiles are auto-discovered by worker type, so `.omniharness/credential-profiles/claude` applies to Claude workers. You can also set `OMNIHARNESS_CREDENTIAL_PROFILE_CLAUDE=runner` or pass `credentialProfile` to the runtime API.
450	
451	File-backed profile:
452	
453	```text
454	.omniharness/credential-profiles/claude/
455	  env/
456	    ANTHROPIC_BASE_URL
457	    ANTHROPIC_AUTH_TOKEN
458	  unset
459	  expires_at
460	```
461	
462	`unset` is one environment variable per line. `expires_at` is optional and only used for status metadata. Secret values are applied to the child process but only key names are exposed in runtime status.
463	
464	Command-backed profile:
465	
466	```json
467	{
468	  "command": "/Users/you/.local/bin/baton",
469	  "args": ["credential-profile"],
470	  "timeoutMs": 5000
471	}
472	```
473	
474	Settings can also point a worker directly at a provider command without a profile folder. For Claude and Baton, set:
475	
476	```text
477	OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE=/Users/you/.local/bin/baton
478	OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_CLAUDE=["credential-profile"]
479	```
480	
481	The command must print JSON:
482	
483	```json
484	{
485	  "env": { "ANTHROPIC_BASE_URL": "https://api.example", "ANTHROPIC_AUTH_TOKEN": "..." },
486	  "unset": ["ANTHROPIC_API_KEY"],
487	  "expiresAt": "2026-06-14T04:23:48.000Z"
488	}
489	```
490	
491	## Troubleshooting Setup
492	
493	- **`This repository is pnpm-only`:** run commands with `pnpm`, not `npm install` or `yarn`.
494	- **Unsupported pnpm version:** install pnpm 9 or newer, or run `./omniharness` from the repo root so the launcher can use Corepack's known-good default when available.
495	- **Unsupported Node version:** use Node.js 22.13 or newer, but below Node.js 26. If you already installed dependencies with a different Node version, run `pnpm rebuild better-sqlite3 @node-rs/argon2 sharp`.
496	- **Native SQLite binding errors:** run `pnpm rebuild better-sqlite3` under your current supported Node version.
497	- **`ERR_PNPM_IGNORED_BUILDS` mentions `node-pty`:** current checkouts allow the `node-pty` build in `pnpm-workspace.yaml`. If you are upgrading an older checkout, make sure `allowBuilds.node-pty` is `true`, then rerun `pnpm install`; use `pnpm approve-builds node-pty` only if pnpm still reports the build as pending approval.
498	- **No supported worker appears:** install or log into at least one supported agent CLI, then run `scripts/install-agent-acp.sh --dry-run` and inspect `curl http://127.0.0.1:7800/doctor`.
499	- **Port already in use:** stop the previous OmniHarness process, or set `PORT` and `OMNIHARNESS_AGENT_RUNTIME_PORT` before starting.
500	- **The private Tailscale URL times out:** run `tailscale status` and `tailscale serve status`, confirm the client device is in the same tailnet and permitted by its access rules, then restart `./omniharness` after setup.
501	- **Phone pairing asks for auth:** set `OMNIHARNESS_AUTH_PASSWORD` or `OMNIHARNESS_AUTH_PASSWORD_HASH` in `.env` and restart.
502	
503	## Repository Layout
504	
505	- `src/server` and `src/runtime` - runner, persistence, auth, lifecycle, and HTTP/SSE
506	- `src/interface`, `src/ui`, and `src/components` - shared React interface
507	- `src/runtime-api` - transport-neutral runner API and platform adapters
508	- `src/shared` - pure contracts shared across the runner/interface boundary
509	- `apps/interface`, `apps/electron`, `apps/mobile`, `apps/vscode` - platform hosts
510	- `scripts` - development, setup, runtime, and maintenance scripts
511	- `tests` - Vitest and Playwright coverage
512	- `docs/superpowers` - design notes, specs, and implementation plans used by the project
513	
514	## Contributing
515	
516	Issues and pull requests are welcome. This project is still settling its public contribution process, so keep changes focused and include the checks you ran.
517	
518	Good first contributions include:
519	
520	- setup and installation fixes
521	- clearer docs for supported agents and ACP adapters
522	- focused bug reports with logs from `/doctor`
523	- small UI and CLI ergonomics improvements
524	- tests around conversation recovery, event streaming, and worker lifecycle behavior
525	
526	Before sending a pull request, run:
527	
528	```bash
529	pnpm test
530	pnpm build
531	```
532	
533	## Security
534	
535	OmniHarness is designed around local-first supervision. The web UI and runtime can start local coding agents that may read and modify files in the projects you point them at. Only run OmniHarness on machines and networks you trust, review agent permissions carefully, and avoid exposing the local runtime directly to the public internet.
536	
537	## License
538	
539	OmniHarness is licensed under the GNU Affero General Public License v3.0. See `LICENSE` for the full terms.
540	

uuid: 2b18366c-188a-45eb-8a89-9c2be72c100d
parent: de3afc9d-87bf-4a8e-ad70-b57c3c854c4c
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-05T21:13:34.971Z","phase":null} -->
## Claude thinking · 2026-08-05T21:13:34.971Z



uuid: 439ae764-efe4-4d20-b126-12b84fd30037
parent: 2b18366c-188a-45eb-8a89-9c2be72c100d

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-05T21:13:49.835Z","phase":null} -->
## Claude · 2026-08-05T21:13:49.835Z

## Review

Scope: launcher, package manifest, runner entry, build-state marker, Tailscale setup, install smoke workflow, README.

### Release-blocking

**1. Native modules aren't rebuilt after the launcher switches Node (`omniharness:52-80` + `163-183`)**
The install-skip marker keys only on the `pnpm-lock.yaml` hash. `better-sqlite3`, `@node-rs/argon2`, and `node-pty` are ABI-bound to the Node major that built them, and the launcher will happily switch Node via nvm (or the user upgrades system Node from 22 → 24) with the lockfile unchanged. Result: install is skipped and startup dies at `ERR_DLOPEN_FAILED` on the very path (`./omniharness` after `git pull`) the README advertises. The README's answer is a manual `pnpm rebuild`, which is not a launcher-quality outcome. Mix `process.versions.modules` (and arch) into the marker in `node_modules/.omniharness-pnpm-lock.sha256` so an ABI change forces a reinstall.

**2. Stale port guidance in `README.md:499`**
"set `PORT` and `OMNIHARNESS_AGENT_RUNTIME_PORT`" — that second variable doesn't exist in this code path. The launcher reads `OMNIHARNESS_RUNNER_PORT`/`PORT` (`omniharness:195-202`) and the bridge is `OMNIHARNESS_BRIDGE_URL` (`scripts/runner.ts:39`, CI env at `install-smoke.yml:26`). Following the README leaves the port conflict unresolved.

### Worth fixing, not blocking

- **Password-notice temp file race (`omniharness:187-189`)**: `mktemp` immediately followed by `rm -f`, then the (now-unowned) path is handed to `setup-auth.mjs` and later `cat`ed. In a shared `/tmp` that's a symlink-plant window for a freshly generated password. Keep the `mktemp` file and let the script truncate it in place.
- **`.env` isn't in the interface fingerprint (`interface-build-state.mjs:9-23`)**: Vite `--mode web` can inline env-derived values, so editing `.env` won't trigger a rebuild and the stale bundle is silently reused.
- **Occupied-port misdiagnosis (`omniharness:205-232`)**: any non-OmniHarness listener on 3050 maps to `not_running`, so the launcher does a full build and then fails on bind with an unrelated error.
- **`@types/node: ^20` vs `engines: >=22.13`** (`package.json:12-13, 94`) — typecheck is validating against APIs older than every supported runtime.
- **Smoke coverage gap (`install-smoke.yml`)**: it verifies the first, cold install only. The documented update path (`git pull` → relaunch, i.e. the marker/skip logic in issue 1) is never exercised. A second `./omniharness` run asserting "no rebuild, still healthy" would have caught it.

Tailscale setup reads correctly: it refuses to clobber unowned Serve config, stages `.env` at `0600` before mutating Serve, and rolls the listener back on rename failure. Runner shutdown and `--help` handling are fine.

VERDICT: FIX

uuid: a8155639-5355-4528-9959-85107bff1efd
parent: 439ae764-efe4-4d20-b126-12b84fd30037

<!-- /codex-event -->
