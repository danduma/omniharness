# Managed Binary Trust Must Be Rechecked at Launch

**Date:** 2026-07-13
**Context:** OmniHarness managed CLIProxyAPI integration
**Symptom:** The installer verified the downloaded archive, but later service startup could trust a pre-existing binary and `current.json` without re-hashing the executable. Archive links were also initially checked only after extraction.
**Root Cause:** Verification was treated as an installation-time concern instead of a continuing execution boundary. Metadata ownership, binary integrity, archive entry type, and process identity were checked by separate paths with inconsistent strength.
**Fix:** Tar link and special-file entries are rejected before extraction. Managed versions are assembled in a temporary directory and atomically renamed with an owned SHA-256 record. Both installation reuse and every service inspection/start re-hash the binary. Process ownership now requires exact argv and OS start-time matching, and child cleanup covers every post-spawn failure.
**Verification:** Installer tests reject link entries and unowned pre-existing binaries, detect a tampered installed executable, and preserve atomic version ownership. Process tests reject reused PIDs and lookalike config arguments and clean up when ownership recording fails.
**Prevention:** Treat every execution of a downloaded binary as a fresh trust decision. Authenticate archives before extraction, install atomically, re-check owned metadata and content hashes at launch, and never signal a PID without exact command and start-time evidence.
