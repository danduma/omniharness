# Trusted Types rollout

The Vite interface sends `require-trusted-types-for 'script'` in
`Content-Security-Policy-Report-Only` and declares the `omni` policy name.
The rest of the interface CSP is enforced.

Enforcement is intentionally deferred while these existing rendering paths are
validated and converted:

- React 19 DOM rendering and lazy chunk loading;
- xterm terminal rendering;
- Markdown and syntax-highlight HTML rendering;
- Base UI portals and dialogs.

Packaged-interface browser tests are the release gate for violations. Trusted
Types must remain report-only until all four paths run without a violation, or
until each required sink is routed through the narrow `omni` policy with a
focused test. This exception does not relax `script-src`: only self-hosted
scripts and the checked build-time theme-script hash are allowed.
