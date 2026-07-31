# Runner deployment and operations

## Process model

One OmniHarness runner is one logical deployment with two co-located
processes:

- the API server owns SQLite, auth, supervision, PTYs, settings, files, and the
  HTTP/SSE contract;
- the ACP bridge owns agent processes and listens on loopback by default.

Clients connect only to the API server. Electron, iOS, Android, VS Code, and
browser/PWA clients never connect directly to the bridge.

`pnpm runner` starts the API server and starts or adopts a loopback bridge. The
API remains available in a degraded state while a failed bridge retries. All
start, adopt, retry, refusal, failure, and shutdown choices emit named events.

## Build and start

Build the shared static interface and start a normal runner:

```bash
pnpm install
pnpm build
pnpm runner
```

The default API/UI address is `http://0.0.0.0:3050`; the managed bridge defaults
to `http://127.0.0.1:7800`.

Supported runner options:

```text
--host <address>
--port <0-65535>
--bridge-url <url>
--static-dir <directory>
--no-static
```

The equivalent environment settings are:

```text
OMNIHARNESS_RUNNER_HOST
OMNIHARNESS_RUNNER_PORT (PORT is a compatibility fallback)
OMNIHARNESS_BRIDGE_URL
OMNIHARNESS_STATIC_DIR
OMNIHARNESS_NO_STATIC=1
OMNIHARNESS_MANAGE_BRIDGE=0
```

With the default build, the runner serves `dist/interface`. `--no-static` is a
supported API-only mode. If the default artifact is absent, startup continues
and emits `runner.static_ui_missing`; if an explicitly supplied `--static-dir`
is missing or invalid, startup fails. Never combine `--no-static` and
`--static-dir`.

## Instances, data, and locks

`OMNIHARNESS_ROOT` selects the base data root. `OMNIHARNESS_INSTANCE=name`
places one isolated deployment under
`$OMNIHARNESS_ROOT/instances/name`. Each instance owns:

```text
sqlite.db
.omniharness-auth.key
runner.lock.json
bridge.lock.json
app-data/run-data/
```

The SQLite database and worker JSONL files are one consistency domain. Do not
point two live runners at the same instance root. A second process refuses an
owned runner lock. Separate instances need separate API ports and bridge URLs.

## TLS and reverse proxies

The Node runner currently terminates HTTP. For any non-loopback deployment,
terminate HTTPS at a reverse proxy or private tunnel and expose only the API/UI
port. Keep the ACP bridge on loopback.

Forwarding headers are ignored unless the socket peer matches an explicit
comma-separated `OMNIHARNESS_TRUSTED_PROXIES` rule. Rules may be exact IPs or
IPv4 CIDRs:

```text
OMNIHARNESS_TRUSTED_PROXIES=127.0.0.1,10.20.0.0/16
OMNIHARNESS_PUBLIC_ORIGIN=https://runner.example.net
```

Configure the proxy to replace, not append untrusted client values for,
`Forwarded`/`X-Forwarded-*`. Never use a catch-all trusted-proxy range.

## Backup and restore

Stop the runner before a filesystem backup. Copy the entire instance directory,
including the database, auth key, worker streams, locks, settings, and managed
metadata. Exclude only transient build caches. Also back up the deployment's
password-hash configuration separately.

Restore into an empty instance path while the runner is stopped, preserve file
permissions, then start it with the same `OMNIHARNESS_ROOT` and
`OMNIHARNESS_INSTANCE`. The auth key is required to read encrypted settings and
validate existing sessions. If it is intentionally omitted, rotate the
password and expect every client to authenticate again.

Client profile lists and platform-secure bearer sessions are client state, not
part of a runner backup.

## Disposable smoke check

This uses an isolated root and a hidden prompt. The password is not passed as a
command-line argument or printed:

```bash
smoke_root="$(mktemp -d "${TMPDIR:-/tmp}/omniharness-smoke.XXXXXX")"
trap 'test -n "$smoke_root" && rm -rf -- "$smoke_root"' EXIT
read -r -s -p "Temporary runner password: " smoke_password
printf '\n'
export OMNIHARNESS_AUTH_PASSWORD="$smoke_password"
unset smoke_password
OMNIHARNESS_ROOT="$smoke_root" \
OMNIHARNESS_INSTANCE=smoke \
pnpm runner --host 127.0.0.1 --port 3059 --no-static
```

In another terminal, check liveness with:

```bash
curl --fail --silent --show-error http://127.0.0.1:3059/api/healthz
```

Press Ctrl-C in the runner terminal. The trap removes only the temporary root
created by this command.
