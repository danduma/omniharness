# OmniHarness mobile

The iOS and Android apps load the shared `dist/interface` build. Runner
requests, streams, credentials, TLS pins, links, lifecycle recovery, and local
notifications are owned by the native `OmniNativeRuntime` plugin; the WebView
does not connect to runners directly.

## Prerequisites

- Node.js 22+ and the repository pnpm version.
- iOS: macOS, full Xcode with an iOS simulator runtime, and an Apple signing
  identity for device/archive builds. Capacitor 8 uses Swift Package Manager.
- Android: a JDK supported by the checked-in Android Gradle plugin, Android
  Studio/SDK, and `ANDROID_HOME` or `local.properties`.

## Build

```bash
pnpm build:interface:web
pnpm mobile:sync
pnpm mobile:build:ios
pnpm mobile:build:android
```

The iOS command is a simulator no-sign build. Device/App Store and Android
release builds require the normal signing setup; keys, provisioning profiles,
SDK caches, and generated archives must remain outside version control.

Release builds accept HTTPS runner origins only. Debug builds additionally
permit cleartext loopback (`localhost`, `127.0.0.1`, `::1`) and do not add a
general cleartext/certificate bypass.

iOS stores sessions with Keychain Services. Android encrypts them with
AES-GCM keys held in Android Keystore. A certificate outside system trust
requires explicit per-profile SPKI confirmation, and a changed certificate
requires confirmation again.

The apps keep every authenticated runner stream connected while foregrounded.
On suspension, native code persists each SSE cursor and closes sockets; on
resume it reconnects and requests replay or a full resync. Version 1 does not
promise background execution or remote push delivery.
