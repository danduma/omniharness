# Authentication, sessions, and TLS

## One password, separate sessions

Each runner has one shared login password. The password is verified only during
login and is never persisted by a client. A successful login creates a
separate, listable, revocable session:

- same-origin browser sessions use an HttpOnly cookie;
- browser/PWA connections to another runner use a same-runner approval window,
  S256 PKCE, and a bearer session;
- Electron, Capacitor, VS Code, and CLI hosts submit the password through their
  trusted host process and keep the returned bearer token outside the
  renderer/WebView.

Browser sessions have a 30-day idle and 90-day absolute limit. Native bearer
sessions have a 90-day idle and 365-day absolute limit. Logout, per-session
revoke, revoke-all, expiry, and password rotation stop further API calls and
close affected streams with the typed `auth.session_revoked` control event.

The runner switcher can list sessions, identify the current session, revoke one,
or revoke all. A revoked client moves to `needs-reauth` without deleting its
profile, drafts, or preferences.

## Password setup and rotation

Prefer an Argon2 hash in `.env`:

```bash
pnpm auth:password set
pnpm auth:password status
pnpm auth:password verify
```

These forms prompt without echoing the password. `set` revokes active sessions
by default, records `auth.password_rotated`, and requires a runner restart.
`--keep-sessions` is an explicit audited exception.

For automation, create a mode-0600 password file outside the repository and
use `pnpm auth:password set --password-file /protected/path`. Do not put a
password in an argument, URL, log, shell history, checked-in file, or process
title.

## Credential storage boundary

| Client | Profile metadata | Bearer session |
| --- | --- | --- |
| Browser/PWA | browser local storage | browser credential store |
| Electron | main-process profile document | Electron `safeStorage` |
| VS Code | extension `globalState` | `ExtensionContext.secrets` |
| iOS | app preferences | Keychain Services, this-device-only |
| Android | app preferences | AES-GCM ciphertext with key in Android Keystore |

Electron renderers, VS Code webviews, and Capacitor WebViews receive opaque
credential handles only. They cannot set `Authorization`, `Cookie`, `Origin`,
or `Host` on host-proxied requests. Native host errors are redacted before
crossing the bridge.

## Runner identity and URL changes

The first authenticated bootstrap learns a durable `runnerInstanceId`. A
profile URL can be edited, but its credential binding is checked against the
profile, origin, and learned identity. If the origin changes, the client
requires a fresh login. If the same profile returns a different runner
identity, the client stops applying events and asks for explicit confirmation;
it never silently merges caches from the two runners.

Runner rename changes display metadata, not identity. Runner re-key deliberately
changes identity and therefore triggers the same confirmation path on every
client.

## Certificate trust and pinning

Production remote connections require HTTPS. System trust is used first.
Electron, iOS, and Android can display the presented SPKI SHA-256 fingerprint
when system trust fails. Trust is stored per profile and origin only after the
user confirms the exact pending fingerprint.

A changed certificate fails closed and requires a new confirmation. Re-pinning
does not carry a bearer token to the renderer. Android release networking has
cleartext disabled; iOS ATS disallows arbitrary loads. Only debug builds permit
cleartext loopback.

Browser/PWA clients rely on browser/OS certificate trust and cannot override a
certificate warning from JavaScript. VS Code relies on the extension host's
standard TLS trust.

## Tailscale trust boundary

Tailscale Serve is the preferred private HTTPS path for a Mac runner. Tailscale
owns device identity, tailnet membership, access rules, MagicDNS, certificates,
and Serve configuration. OmniHarness owns its password, sessions, public-origin
setting, and loopback runner bind address.

Tailnet access is defense in depth, not authentication for OmniHarness. Keep the
OmniHarness password enabled, grant tailnet access narrowly, and never expose the
ACP bridge on port `7800`. `pnpm setup:tailscale` uses Serve only; it never enables
the public Tailscale Funnel feature.

## Trusted proxies and CORS

Forwarded client/protocol headers are accepted only from
`OMNIHARNESS_TRUSTED_PROXIES`; see
[runner operations](../deployment/runner-operations.md). Bearer CORS is
route-aware, never enables credentialed wildcard requests, and never turns the
password endpoint into an open cross-origin login API. Browser-to-browser login
must use the approval/PKCE flow.

## Filesystem roots

`/api/fs`, `/api/fs/directories`, and `/api/fs/files` browse, create in, and read
from an allowlist of directory trees. The default is the parent of the runner's
working directory. `OMNIHARNESS_FS_ROOTS` replaces that default with a
`path.delimiter`-separated list, which is how a project on a second drive becomes
reachable:

```
OMNIHARNESS_FS_ROOTS=/Users/you/code:/Volumes/External/code
```

Every root is a full read surface for anyone holding a session — the project file
walker descends into `.env` on purpose — so list the trees you keep code in
rather than `/`. Paths outside every root are clamped back to the first readable
root instead of being served. Directory creation resolves symlinks and rechecks
containment against the canonical path, so a pre-existing link inside a root
cannot redirect a `mkdir` outside it. A root that is not mounted stays in the
allowlist and is reported to the folder picker as unavailable; it does not
silently drop out and reroute the caller.
