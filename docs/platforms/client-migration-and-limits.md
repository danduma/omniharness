# Client migration and platform limits

## Shared behavior

Every client saves multiple runner profiles and keeps one main event connection
for every authenticated profile while its process is active. One workspace is
visible at a time. Inactive runner streams still update bounded previews and
can produce runner-labelled notifications.

Profiles retain runner-scoped cursors, drafts, preferences, and bounded caches.
After restart, clients bootstrap an authoritative snapshot, replay from the
stored epoch-aware cursor when possible, and request a full resync when the
runner reports epoch mismatch, cursor eviction, or subscriber overflow.

## Electron migration

The desktop app no longer owns or starts a runner. On upgrade it imports the
versioned legacy preferences/drafts export transactionally and creates an
explicit former-local profile at `http://127.0.0.1:3050`. The user must start
that runner separately and log in with its shared password.

Profile import writes a new version only after validation. A parse/write
failure restores the previous profile document and keeps the export for retry.
Old runner data is not deleted automatically.

Electron keeps profiles and pins in main-process files and sessions in
`safeStorage`. If OS encryption is unavailable, new sessions are memory-only
and the app explains that login will be required after restart.

## VS Code migration

The extension migrates the old plain `omniHarness.sessionCookie` setting into
`SecretStorage`, clears the plain setting, and marks the profile for
re-authentication. A cookie is never reinterpreted as a bearer token. Profiles
remain in `globalState`; the webview never receives session material.

## Mobile build and runtime limits

See [the mobile README](../../apps/mobile/README.md) for toolchains and build
commands. Native source projects are committed; SDK caches, local signing
state, build products, provisioning profiles, keystores, and archives are not.

iOS and Android keep all runner sockets open only while the app is active.
When the OS suspends the app, native code persists each cursor and closes the
streams. Foreground resume reconnects and replays/resyncs. Version 1 does not
promise background sockets, background agent execution, or remote push after
the app has been suspended or terminated. Local notifications are best effort
while the host is active and permission is granted.

## PWA offline behavior

The PWA caches the static shell and hashed assets only. It does not cache API
responses as authoritative runner state, queue mutations for later delivery,
or claim that a conversation is current while offline. Offline startup can
show the shell and saved profile state; using a runner requires reconnect,
bootstrap, and snapshot authority.

Browser storage is less isolated than an OS secret store. Use the PWA only on a
trusted browser profile and treat script/browser-extension compromise as access
to its bearer sessions.

## Version 1 non-goals

- merged dashboards or search across runner data;
- runner-to-runner handoff;
- background mobile push delivery;
- silent identity replacement or automatic certificate trust;
- a runner embedded in Electron, iOS, Android, or VS Code;
- extracting the repository into separate packages;
- offline mutation queues or preview caches that substitute for a snapshot.

The runner still manages a co-located API process and ACP bridge process as one
logical deployment. Platform clients speak only to the API server.
