# Hosted Remote Access Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the optional hosted OmniHarness control plane that owns registered accounts, paid remote-installation entitlements, memorable hostnames, Cloudflare Tunnel provisioning, DNS records, tunnel-token lifecycle, health, audit, and revocation for Omni-provided managed remote access.

**Architecture:** Keep the existing Vercel landing page on `omniharness.dev` / `www.omniharness.dev`, and deploy a separate hosted API service at `panel.omniharness.dev`. Use Supabase for Auth, Postgres persistence, RLS-aware account data, and audit/event storage; use a dedicated Node/TypeScript service for Cloudflare API orchestration, provisioning workflows, retries, diagnostics, and local-app handshakes. Local OmniHarness installations never receive Cloudflare account API credentials; they receive only an installation id, public origin, and scoped tunnel token.

**Tech Stack:** Node 22, TypeScript, Fastify, Zod, Supabase Auth, Supabase Postgres, Cloudflare Tunnel API, Cloudflare DNS API, Docker, Fly.io or another always-on container host, Vitest, Playwright or API-level journey tests, existing OmniHarness local app, `cloudflared`.

**North Star Product:** OmniHarness is fully useful as an offline local app with no registration, while registered users can opt into paid hosted services. A builder who wants the managed tunnel clicks "Enable hosted remote access", registers or signs in, receives a permanent friendly hostname under `omniharness.dev`, scans a phone QR, and can supervise local agents from anywhere without configuring Cloudflare, DNS, or tunnels by hand.

**Current Milestone:** Ship a real hosted control-plane service and local-app integration path for one-account/one-installation paid managed Cloudflare Tunnel provisioning under `omniharness.dev`, including Supabase-backed registration/login, account records, managed-tunnel entitlement checks, installation records, slug reservation, Cloudflare resource creation, token issuance, local connector handshake, health checks, diagnostics, and revocation.

**Future Product Direction:** Add billing enforcement, organization/team accounts, custom domains, user-editable slugs, fleet management, read-only sharing, native mobile apps, and an Omni Relay based on Cloudflare Workers/Durable Objects after the named-tunnel control plane is working end-to-end.

**Final Functionality Standard:** The local app remains fully usable offline with no registration. A real signed-in account with an active managed-tunnel entitlement can claim an installation; the control plane provisions real Cloudflare resources and persists them in Supabase; a local OmniHarness app can start `cloudflared` with the returned scoped token; the public hostname reaches the local web app; status, errors, and audit events are inspectable; revocation disables access. Mock Cloudflare responses, canned DNS records, unscoped local Cloudflare credentials, registration requirements for offline/local use, and placeholder success states do not count as delivery.

---

## Product Commitments

### User Stories

As a builder, I want OmniHarness to create and remember my remote hostname, so I can open the same address from my phone every time.

As a builder, I want to use OmniHarness fully offline without registration, so the core local agent supervisor is not dependent on OmniHarness cloud services.

As a builder, I want to bring my own tunnel or LAN URL without creating an OmniHarness account, so I can use ngrok, Cloudflare Tunnel, Tailscale, a reverse proxy, or my own domain on my own terms.

As a builder, I want to register and log into an OmniHarness account when I want paid hosted features, so the account boundary is useful but not forced.

As a builder, I want to sign into an OmniHarness account instead of managing Cloudflare credentials, so remote access feels like product setup rather than infrastructure work.

As a builder, I want setup failures to say whether account auth, slug reservation, DNS, Cloudflare Tunnel, local connector, or app reachability failed.

As a builder, I want to revoke a lost machine's tunnel token, so an old laptop cannot keep exposing my OmniHarness instance.

As the service operator, I want every provisioning and revocation step audited, so support, abuse response, and billing reconciliation are possible.

### Product Mode Boundary

OmniHarness has three product modes:

1. **Local/offline mode:** no registration, no Supabase, no hosted control plane, no internet requirement beyond whatever model/agent providers the user chooses. Existing local conversations, workers, settings, auth, and runtime supervision continue to work.
2. **Bring-your-own tunnel mode:** no OmniHarness registration required. The user provides a LAN URL or public HTTPS origin from ngrok, Cloudflare Tunnel, Tailscale/Funnel, a reverse proxy, or their own domain. OmniHarness validates the URL, uses it for phone pairing/public-origin links, and surfaces health/errors, but does not provision DNS, tunnels, slugs, hosted accounts, or billing records.
3. **Omni managed tunnel mode:** registration/login required and gated by an active paid managed-tunnel entitlement. The hosted control plane provisions and owns the `omniharness.dev` hostname, Cloudflare Tunnel, DNS record, scoped tunnel token, health, audit, and revocation.

The hosted control plane must never become a startup dependency for local/offline mode or bring-your-own tunnel mode.

### Domain And Deployment Model

Cloudflare remains the authoritative DNS provider for `omniharness.dev`.

```text
omniharness.dev              -> Vercel landing page
www.omniharness.dev          -> Vercel landing page
panel.omniharness.dev        -> hosted control-plane API service
<slug>.omniharness.dev      -> per-installation Cloudflare Tunnel DNS record
```

For v1, create one DNS CNAME per active installation:

```text
<slug>.omniharness.dev CNAME <tunnel-id>.cfargotunnel.com
```

Do not route all `*.omniharness.dev` wildcard traffic to the local app in v1. The control plane must know exactly which hostname maps to which remote installation.

### Trust Boundary

The hosted control plane may hold Cloudflare account credentials and Supabase service-role credentials. The local OmniHarness app must not.

The local app receives:

- Supabase user/session token or an installation-scoped exchange token,
- remote installation id,
- public origin,
- scoped Cloudflare tunnel token,
- token version and status metadata.

The local app exposes only its Next.js web server through the tunnel. The ACP/runtime bridge remains loopback-only.

## PM Pass

Primary user: the individual builder running OmniHarness locally and connecting from a phone.

Secondary user: the OmniHarness service operator debugging provisioning, revocation, abuse, billing, and Cloudflare account state.

Supporting jobs:

- account sign-in and session validation,
- installation claim and recovery after reinstall,
- slug reservation and collision handling,
- Cloudflare named-tunnel creation,
- DNS record creation and cleanup,
- scoped tunnel-token issue/rotate/revoke,
- local connector heartbeat,
- external public reachability checks,
- support-readable audit trail,
- scriptable admin/status inspection,
- secure secret storage and redaction.

State model:

- Supabase is the system of record for accounts, installations, slugs, Cloudflare ids, token versions, health snapshots, and audit events.
- Cloudflare is the system of record for tunnel and DNS resources.
- Local OmniHarness stores only the minimal assigned remote-access state needed to reconnect.

Operational readiness:

- every provisioning step must be idempotent,
- failed partial provisioning must be resumable,
- Cloudflare and Supabase errors must map to stable product error codes,
- all sensitive tokens must be redacted in logs, diagnostics, tests, and UI payloads,
- service health and installation health must be separately inspectable.

Repository isolation:

- Work in the current repository.
- Do not create branches.
- Do not create worktrees.

## Product Completeness Pass

## Current Repository Audit

This plan was re-checked against the repo on 2026-05-29.

Current repo facts that affect implementation:

- `pnpm-workspace.yaml` already exists, but currently only carries pnpm config such as overrides and `allowBuilds`; it does not yet define package globs. The plan must extend this file instead of creating it from scratch.
- The local app uses Next.js App Router route files as thin adapters over the explicit runtime route registry in `src/runtime/http/routes/index.ts`. New local API behavior should follow that pattern when local integration is needed.
- The hosted service should still be a separate Fastify service under `services/remote-control-plane`; it should not be implemented as local Next file-based routes.
- Local auth/public-origin resolution currently lives in `src/server/auth/config.ts` and only checks `OMNIHARNESS_PUBLIC_ORIGIN`, forwarded headers, and request origin. The hosted remote-access origin precedence remains a real required change.
- Local encrypted settings already exist in `src/server/settings/crypto.ts`, but `shouldEncryptSetting` currently encrypts generic secret-looking suffixes only. Remote tunnel token keys must be explicitly covered if their names do not match those patterns.
- There is no dedicated local `/api/healthz` route today. The plan must add a tiny unauthenticated local health endpoint for Cloudflare reachability checks that proves "this is OmniHarness" without leaking conversations, prompts, auth state, or secrets.

Baseline v1 surfaces:

- hosted control-plane API,
- Supabase registration/login configuration for hosted features,
- Supabase schema and migrations,
- paid managed-tunnel entitlement model,
- service configuration and deployment docs,
- local-app API client and encrypted local state handoff,
- local-app mode selection that keeps offline and bring-your-own tunnel paths accountless,
- CLI/scriptable admin status tools,
- deterministic tests for provisioning logic and error mapping,
- environment-gated integration tests against real Cloudflare and Supabase.

Baseline v1 states:

- unauthenticated,
- offline/local with no account,
- bring-your-own tunnel configured,
- account registration/login available,
- account authenticated,
- no paid managed-tunnel entitlement,
- paid managed-tunnel entitlement active,
- installation unclaimed,
- slug reserved,
- provisioning tunnel,
- provisioning DNS,
- token issued,
- connector waiting,
- connector connected,
- public reachability healthy,
- degraded,
- revoked,
- provisioning failed with resumable cause.

## File Map

### Create

- `services/remote-control-plane/package.json`: package scripts, dependencies, and test entry points for the hosted service.
- `services/remote-control-plane/tsconfig.json`: TypeScript config for the service.
- `services/remote-control-plane/Dockerfile`: container image for an always-on deployment target such as Fly.io.
- `services/remote-control-plane/fly.toml.example`: deployment template for `panel.omniharness.dev`.
- `services/remote-control-plane/src/server.ts`: Fastify server bootstrap and plugin registration.
- `services/remote-control-plane/src/config.ts`: typed environment parsing and secret redaction helpers.
- `services/remote-control-plane/src/auth/supabase-auth.ts`: Supabase JWT validation and account context derivation.
- `services/remote-control-plane/src/billing/entitlements.ts`: paid managed-tunnel entitlement checks sourced from Supabase account state.
- `services/remote-control-plane/src/db/supabase.ts`: Supabase client factories for user-scoped and service-role operations.
- `services/remote-control-plane/src/db/schema.sql`: Supabase SQL migrations for accounts, installations, slugs, events, and health snapshots.
- `services/remote-control-plane/src/cloudflare/client.ts`: Cloudflare Tunnel/DNS API client.
- `services/remote-control-plane/src/cloudflare/errors.ts`: Cloudflare error normalization.
- `services/remote-control-plane/src/installations/provision.ts`: idempotent installation claim and Cloudflare provisioning workflow.
- `services/remote-control-plane/src/installations/revoke.ts`: revoke token, disable DNS/tunnel routing, and record audit events.
- `services/remote-control-plane/src/installations/health.ts`: connector heartbeat, public reachability checks, and health status shaping.
- `services/remote-control-plane/src/installations/routes.ts`: explicit Fastify routes for claim, status, heartbeat, rotate-token, revoke, and diagnostics.
- `services/remote-control-plane/src/slugs/word-lists.ts`: hosted slug word lists and banned/reserved terms.
- `services/remote-control-plane/src/slugs/generator.ts`: collision-aware slug generation.
- `services/remote-control-plane/src/audit/events.ts`: append-only audit event writer and redaction utilities.
- `services/remote-control-plane/src/admin/routes.ts`: service-operator status endpoints protected by admin auth.
- `services/remote-control-plane/scripts/check-installation.ts`: scriptable lookup for installation, DNS, tunnel, health, and audit state.
- `services/remote-control-plane/tests/*.test.ts`: deterministic unit and integration tests for config, auth, slugs, provisioning, health, revocation, and error mapping.
- `tests/remote-access/control-plane-client.test.ts`: local OmniHarness client tests for control-plane API contracts.
- `src/runtime/http/routes/healthz.ts`: unauthenticated local app health proof used by the hosted control plane through the managed tunnel.
- `src/app/api/healthz/route.ts`: thin Next adapter for the local health route, matching the existing runtime-route pattern.
- `tests/api/healthz-route.test.ts` and `tests/runtime/http-routes.test.ts` coverage for the local health route.
- `docs/remote-access-control-plane.md`: deployment, DNS, Supabase, Cloudflare, operations, and troubleshooting guide.

### Modify

- `pnpm-workspace.yaml`: add workspace package globs for the root app and `services/remote-control-plane/**` while preserving the existing overrides and `allowBuilds`.
- `package.json`: add workspace-aware scripts for testing and typechecking the hosted service without breaking existing local app scripts.
- `pnpm-lock.yaml`: update dependencies.
- `.gitignore`: ignore hosted service `.env*`, local Cloudflare credentials, generated diagnostics, logs, build output, and deployment artifacts.
- `src/server/remote-access/local-state.ts`: if created by the Cloudflared plan, persist the hosted installation id, public origin, status, and encrypted tunnel token.
- `src/server/remote-access/control-plane-client.ts`: local app API client for optional hosted claim/status/heartbeat/token-rotation calls.
- `src/server/auth/config.ts`: prefer healthy remote-access public origin before `OMNIHARNESS_PUBLIC_ORIGIN`, forwarded headers, and request origin.
- `src/runtime/http/routes/index.ts`: register the local `/api/healthz` handler if the runtime registry is the active API source for that route.
- `src/components/PairDeviceDialog.tsx`: show hosted remote-access origin and degraded-state warnings when the control plane reports stale or unhealthy access.
- `src/components/home/SettingsDialog.tsx` or the eventual remote-access panel: expose three modes without forcing account registration: offline/local, bring-your-own tunnel, and paid Omni managed tunnel.
- `docs/superpowers/plans/2026-05-07-memorable-cloudflared-subdomains.md`: link this hosted control-plane plan as the prerequisite for managed named-tunnel delivery.

### Tests

- `services/remote-control-plane/tests/config.test.ts`
- `services/remote-control-plane/tests/auth.test.ts`
- `services/remote-control-plane/tests/entitlements.test.ts`
- `services/remote-control-plane/tests/slug-generator.test.ts`
- `services/remote-control-plane/tests/cloudflare-client.test.ts`
- `services/remote-control-plane/tests/provision.test.ts`
- `services/remote-control-plane/tests/revoke.test.ts`
- `services/remote-control-plane/tests/health.test.ts`
- `services/remote-control-plane/tests/routes.test.ts`
- `tests/api/healthz-route.test.ts`
- `tests/remote-access/control-plane-client.test.ts`
- `tests/e2e/remote-access-control-plane.spec.ts` gated behind real Supabase, Cloudflare, and `cloudflared` credentials.

### Candidate Agentic Journey Tests

These require explicit user approval before running:

- **Managed setup journey:** start local OmniHarness, sign in, claim remote access through `panel.omniharness.dev`, start `cloudflared`, open the public hostname in a separate browser context, log in, and redeem a phone pairing link.
- **Revocation journey:** revoke an installation from the control plane, verify the local connector can no longer expose the app, and verify the public hostname no longer reaches OmniHarness.
- **Degraded tunnel journey:** kill `cloudflared`, verify heartbeat/reachability degradation in the control plane and local UI, then reconnect and verify recovery.

## API Contract

All hosted routes live in the Fastify service, not in Next file-based routes.

```text
POST   /v1/auth/session
POST   /v1/installations/claim
GET    /v1/installations/:id
POST   /v1/installations/:id/heartbeat
POST   /v1/installations/:id/rotate-token
POST   /v1/installations/:id/revoke
GET    /v1/installations/:id/diagnostics
GET    /v1/admin/installations/:id
```

Route guarantees:

- require Supabase auth for user routes,
- allow Supabase registration/login for hosted features without changing local offline startup,
- reject managed-tunnel provisioning unless the account has an active paid managed-tunnel entitlement,
- require separate admin auth for operator routes,
- return stable product error codes,
- include request ids,
- redact secrets from all responses,
- reject cross-account installation access,
- make provisioning retries idempotent.

## Supabase Persistence Model

Create migrations for:

```text
accounts
account_members
account_entitlements
remote_installations
remote_installation_tokens
remote_slugs
remote_access_events
remote_health_snapshots
```

Minimum `remote_installations` fields:

```ts
id: string;
account_id: string;
slug: string;
hostname: string;
status: "reserved" | "provisioning" | "active" | "degraded" | "revoked" | "failed";
cloudflare_account_id: string;
cloudflare_zone_id: string;
cloudflare_tunnel_id: string | null;
cloudflare_tunnel_name: string | null;
dns_record_id: string | null;
token_version: number;
last_connector_seen_at: string | null;
last_health_check_at: string | null;
last_health_check_status: string | null;
last_error_code: string | null;
last_error_detail: string | null;
created_at: string;
updated_at: string;
revoked_at: string | null;
```

RLS expectations:

- users can read installations for their accounts,
- users can read their managed-tunnel entitlement state,
- users can mutate only allowed installation actions through RPCs or the service API,
- service-role operations are isolated to the hosted control-plane service,
- audit events are append-only for service-role writers and read-limited for account users.

## Cloudflare Resource Model

Required environment:

```text
CONTROL_PLANE_PUBLIC_ORIGIN=https://panel.omniharness.dev
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
MANAGED_TUNNEL_ENTITLEMENT_MODE=supabase
REMOTE_HOSTNAME_SUFFIX=.omniharness.dev
```

Cloudflare API token permissions:

- Cloudflare One Connector: `cloudflared` Write, Cloudflare One Connectors Write, or Cloudflare Tunnel Write for the OmniHarness account,
- DNS edit for `omniharness.dev`,
- no broader account permissions than required.

Cloudflare workflow:

1. Reserve slug in Supabase transaction.
2. Create or reuse a remotely-managed named tunnel `omni-<installation-id>`.
3. Configure tunnel ingress for `https://<slug>.omniharness.dev` to the reported local web service, defaulting to `http://127.0.0.1:3050` for `./omniharness`, using Cloudflare-managed tunnel configuration.
4. Create DNS CNAME to `<tunnel-id>.cfargotunnel.com`.
5. Issue/read the tunnel token and give only that token to the local app, which runs `cloudflared tunnel --no-autoupdate run --token <token>`.
6. Persist resource ids and token version.
7. Mark active only after connector heartbeat and public reachability succeed.

Current Cloudflare account limits to design around:

- Default `cloudflared` tunnels per account: 1,000.
- Default Cloudflare Tunnel hostname/CIDR routes per account: 1,000.
- Active `cloudflared` replicas per tunnel: 25.

For v1, assume one tunnel and one hostname route per remote installation. Treat the 1,000-installation account ceiling as an operational limit: add admin visibility, graceful provisioning refusal when approaching quota, and a note that a public-scale service needs a Cloudflare limit increase or account/zone sharding before broad rollout.

## Implementation Checklist

### Phase 0: Confirm Infrastructure Decisions

- [ ] **Step 0.1: Confirm DNS ownership and records**

  Verify Cloudflare manages `omniharness.dev` DNS while the landing page remains on Vercel.

  Required records:

  ```text
  omniharness.dev         -> Vercel
  www.omniharness.dev     -> Vercel
  panel.omniharness.dev   -> hosted control-plane service
  ```

  Verification:

  ```bash
  dig omniharness.dev
  dig www.omniharness.dev
  dig panel.omniharness.dev
  ```

- [ ] **Step 0.2: Confirm deployment target**

  Use an always-on container deployment target for v1. Prefer Fly.io because it supports a plain Docker service, private secrets, stable custom domains, health checks, and long-running background-safe API behavior.

  Do not implement the control-plane provisioning workflow as local Next routes. Do not add file-based routes for this service.

- [ ] **Step 0.3: Confirm Supabase project**

  Create or select the Supabase project that will own control-plane auth and persistence. Record project URL, anon key, and service-role key in the hosted service secret store only.

  Verification:

  ```bash
  supabase projects list
  ```

  or document the manual console verification if the Supabase CLI is not installed.

- [ ] **Step 0.4: Confirm paid entitlement source**

  Confirm where paid managed-tunnel entitlement state comes from for v1. The implementation must support a real account entitlement in Supabase before provisioning; if Stripe or another billing provider is not wired in this milestone, operator-granted paid entitlements are acceptable for a private beta only when the API still enforces the entitlement gate.

  Required product rule:

  - no entitlement needed for local/offline mode,
  - no entitlement needed for bring-your-own tunnel mode,
  - active managed-tunnel entitlement required for Omni-provided `omniharness.dev` tunnel provisioning.

### Phase 1: Workspace And Service Skeleton

- [ ] **Step 1.1: Add workspace package structure**

  Extend the existing `pnpm-workspace.yaml` with workspace package globs and create `services/remote-control-plane/**`.

  Preserve the current `pnpm-workspace.yaml` overrides and `allowBuilds` entries. Add package globs without changing dependency override behavior:

  ```yaml
  packages:
    - "."
    - "services/*"
  ```

  Keep existing root scripts working exactly as before:

  ```bash
  pnpm test
  pnpm build
  ```

  Add explicit service scripts:

  ```bash
  pnpm --filter remote-control-plane test
  pnpm --filter remote-control-plane typecheck
  ```

- [ ] **Step 1.2: Implement typed configuration**

  Create `services/remote-control-plane/src/config.ts` with Zod parsing for all required environment variables, secret redaction helpers, and deployment-mode validation.

  Tests:

  ```bash
  pnpm --filter remote-control-plane test -- tests/config.test.ts
  ```

- [ ] **Step 1.3: Bootstrap Fastify service**

  Create `src/server.ts` with health endpoints:

  ```text
  GET /healthz
  GET /readyz
  ```

  `readyz` must validate Supabase and Cloudflare configuration shape without exposing secrets.

  Verification:

  ```bash
  pnpm --filter remote-control-plane typecheck
  pnpm --filter remote-control-plane test
  ```

### Phase 2: Supabase Schema And Auth

- [ ] **Step 2.1: Write Supabase schema migration**

  Create `services/remote-control-plane/src/db/schema.sql` with accounts, members, account entitlements, remote installations, slugs, token metadata, health snapshots, and audit events.

  Include indexes for:

  - `remote_installations.account_id`,
  - `remote_installations.hostname`,
  - `remote_installations.status`,
  - `remote_access_events.installation_id`,
  - `remote_health_snapshots.installation_id`.

- [ ] **Step 2.2: Add RLS policies**

  Enable RLS on account-owned tables. Permit users to read their account installations and audit summaries. Keep writes that affect Cloudflare resources behind service-role APIs.

  Verification:

  ```bash
  pnpm --filter remote-control-plane test -- tests/auth.test.ts
  ```

- [ ] **Step 2.3: Implement Supabase auth context**

  Validate Supabase JWTs on user routes and derive:

  ```ts
  accountId
  userId
  role
  ```

  Reject missing, expired, invalid, or cross-account tokens with stable error codes.

- [ ] **Step 2.4: Configure hosted registration and login**

  Configure Supabase Auth for hosted control-plane accounts. The local OmniHarness app must be able to open a register/login flow for hosted features, but the app must still start and operate normally when the user skips registration or has no network.

  Verification:

  ```bash
  pnpm --filter remote-control-plane test -- tests/auth.test.ts
  ```

- [ ] **Step 2.5: Implement paid managed-tunnel entitlement checks**

  Create `services/remote-control-plane/src/billing/entitlements.ts`.

  `POST /v1/installations/claim`, token rotation, and managed-hostname recovery must require an active `managed_tunnel` entitlement. Return a stable `managed_tunnel_entitlement_required` error when the account is signed in but unpaid.

  Verification:

  ```bash
  pnpm --filter remote-control-plane test -- tests/entitlements.test.ts
  ```

### Phase 3: Slug And Installation Reservation

- [ ] **Step 3.1: Implement slug generation**

  Port or share the curated three-word slug rules from the Cloudflared plan:

  - lowercase ASCII,
  - DNS-safe,
  - three words,
  - banned/reserved word filtering,
  - collision retry,
  - maximum full hostname length checks.

  Tests:

  ```bash
  pnpm --filter remote-control-plane test -- tests/slug-generator.test.ts
  ```

- [ ] **Step 3.2: Implement installation claim transaction**

  `POST /v1/installations/claim` must create or resume one active installation claim for the authenticated account only after the account has an active managed-tunnel entitlement.

  Idempotency rules:

  - if the client retries with the same idempotency key, return the same installation,
  - if slug is reserved but tunnel is missing, resume tunnel provisioning,
  - if tunnel exists but DNS is missing, resume DNS creation,
  - if token issue fails, preserve created Cloudflare resource ids for retry.

  Entitlement rules:

  - unauthenticated users receive `auth_required`,
  - signed-in users without a paid entitlement receive `managed_tunnel_entitlement_required`,
  - local/offline and bring-your-own tunnel modes never call this endpoint.

### Phase 4: Cloudflare Client And Provisioning

- [ ] **Step 4.1: Implement Cloudflare API client**

  Create typed methods for:

  - create named tunnel,
  - get named tunnel,
  - delete or disable named tunnel,
  - configure remotely-managed tunnel ingress,
  - create DNS CNAME,
  - get DNS record,
  - delete DNS record,
  - issue/read tunnel token using the current Cloudflare API flow.

  Tests use transport-level test doubles only. Do not mock product success in the implementation.

- [ ] **Step 4.2: Normalize Cloudflare errors**

  Map Cloudflare failures into stable product codes:

  ```text
  cloudflare_auth_failed
  cloudflare_rate_limited
  cloudflare_tunnel_create_failed
  cloudflare_dns_create_failed
  cloudflare_token_issue_failed
  cloudflare_resource_not_found
  cloudflare_unknown_error
  ```

- [ ] **Step 4.3: Implement provisioning workflow**

  Provisioning must persist progress after every external side effect and write audit events for:

  - slug reserved,
  - tunnel created,
  - tunnel config written,
  - DNS record created,
  - token issued,
  - provisioning failed,
  - provisioning resumed.

  Verification:

  ```bash
  pnpm --filter remote-control-plane test -- tests/cloudflare-client.test.ts tests/provision.test.ts
  ```

### Phase 5: Local Connector Handshake And Health

- [ ] **Step 5.0: Add local OmniHarness health proof**

  Add unauthenticated `GET /api/healthz` to the local app via `src/runtime/http/routes/healthz.ts`, the runtime route registry, and a thin Next adapter at `src/app/api/healthz/route.ts`.

  The response must be small, cache-resistant, and safe to expose publicly:

  ```json
  {
    "ok": true,
    "app": "omniharness",
    "version": "0.1.0"
  }
  ```

  It must not expose auth status, project paths, conversation ids, worker output, environment variables, machine usernames, or token material.

  Verification:

  ```bash
  pnpm test -- tests/api/healthz-route.test.ts tests/runtime/http-routes.test.ts
  ```

- [ ] **Step 5.1: Implement installation status endpoint**

  `GET /v1/installations/:id` returns:

  - installation id,
  - hostname,
  - public origin,
  - status,
  - token version,
  - last connector heartbeat,
  - last public health check,
  - redacted last error,
  - next suggested local action.

- [ ] **Step 5.2: Implement heartbeat endpoint**

  `POST /v1/installations/:id/heartbeat` accepts connector version, local app version, token version, local web port, and connector-observed status.

  It must reject revoked installations and stale token versions. If the reported local web port differs from the persisted tunnel service target, the service must update the remotely-managed tunnel ingress config before marking the installation healthy.

- [ ] **Step 5.3: Implement public reachability checks**

  The control plane marks an installation healthy only when `https://<slug>.omniharness.dev/api/healthz` reaches the expected OmniHarness app health proof through Cloudflare.

  Distinguish:

  - connector missing,
  - DNS pending,
  - Cloudflare tunnel unavailable,
  - local app unreachable,
  - app auth/config mismatch,
  - unexpected response.

### Phase 6: Token Rotation And Revocation

- [ ] **Step 6.1: Implement token rotation**

  `POST /v1/installations/:id/rotate-token` issues a new tunnel token, increments token version, stores metadata, and returns the new scoped token only once.

  Never store or return plaintext token after initial issue except for a new rotation response.

- [ ] **Step 6.2: Implement revocation**

  `POST /v1/installations/:id/revoke` must:

  - mark installation revocation requested,
  - delete or disable DNS routing,
  - revoke/disable tunnel access where supported,
  - mark local token version invalid,
  - write audit events,
  - make future heartbeat/status calls report revoked.

  Verification:

  ```bash
  pnpm --filter remote-control-plane test -- tests/revoke.test.ts
  ```

### Phase 7: Local OmniHarness Integration

- [ ] **Step 7.1: Implement local control-plane client**

  Create `src/server/remote-access/control-plane-client.ts` with typed calls matching the hosted API contract.

  The local app must never log hosted auth tokens, Cloudflare tunnel tokens, session cookies, or pairing tokens.

  The client is optional. The local app must not require this client, Supabase, or the hosted control plane to start or run local/offline workflows.

- [ ] **Step 7.2: Persist local assigned remote state**

  Store installation id, hostname, public origin, provider id, status snapshot, last healthy timestamp, token version, and encrypted tunnel token.

  If the settings table is sufficient, use encrypted settings. If it becomes awkward, add a dedicated local remote-access table.

- [ ] **Step 7.3: Connect pairing origin resolution**

  Update public-origin resolution so a healthy hosted remote-access origin takes precedence over `OMNIHARNESS_PUBLIC_ORIGIN`, forwarded headers, and request origin.

  Pairing QR generation must refuse silent stale-origin fallback when hosted remote access is configured but unhealthy.

- [ ] **Step 7.4: Preserve accountless bring-your-own tunnel mode**

  Expose or document an accountless path where the user supplies `OMNIHARNESS_PUBLIC_ORIGIN` or a validated manual public/LAN URL. This mode must:

  - work without registration/login,
  - not call the hosted control plane,
  - not check managed-tunnel entitlement,
  - validate reachability before treating the URL as healthy,
  - still require OmniHarness app-layer auth for remote browser sessions.

### Phase 8: Admin And Scriptable Operations

- [ ] **Step 8.1: Add admin status endpoint**

  `GET /v1/admin/installations/:id` must show installation state, Cloudflare ids, DNS record id, status, last health, and audit summaries without exposing secrets.

- [ ] **Step 8.2: Add CLI inspection script**

  `services/remote-control-plane/scripts/check-installation.ts` prints:

  - Supabase installation row,
  - slug/hostname,
  - Cloudflare tunnel existence,
  - DNS record existence,
  - last heartbeat,
  - last health check,
  - recent audit events,
  - recommended next action.

  Verification:

  ```bash
  pnpm --filter remote-control-plane exec tsx scripts/check-installation.ts <installation-id>
  ```

### Phase 9: Deployment And Documentation

- [ ] **Step 9.1: Add container deployment config**

  Add Dockerfile and `fly.toml.example`. Document required secrets and custom domain setup.

- [ ] **Step 9.2: Document DNS setup**

  In `docs/remote-access-control-plane.md`, document:

  - keeping Vercel on apex/www,
  - adding `panel.omniharness.dev`,
  - creating per-installation CNAME records,
  - Cloudflare token permissions,
  - default Cloudflare account limits and what happens near the 1,000 tunnel/route ceiling,
  - why local apps never receive Cloudflare account API tokens.

- [ ] **Step 9.3: Document operational runbooks**

  Include:

  - provisioning retry,
  - DNS propagation diagnosis,
  - connector heartbeat missing,
  - tunnel unavailable,
  - token rotation,
  - machine lost/revocation,
  - Supabase outage,
  - Cloudflare outage,
  - support-safe diagnostics collection.

### Phase 10: End-To-End Verification

- [ ] **Step 10.1: Run deterministic tests**

  ```bash
  pnpm test
  pnpm --filter remote-control-plane test
  pnpm --filter remote-control-plane typecheck
  ```

- [ ] **Step 10.2: Run real integration test in gated environment**

  With real Supabase, Cloudflare, `cloudflared`, and a disposable test hostname:

  ```bash
  pnpm test:e2e -- tests/e2e/remote-access-control-plane.spec.ts
  ```

  The test must clean up Cloudflare DNS and tunnel resources it creates.

- [ ] **Step 10.3: Verify final acceptance criteria**

  Acceptance criteria:

  - local/offline OmniHarness starts and works without registration, Supabase, or hosted control-plane availability,
  - bring-your-own tunnel mode works without registration and uses only a validated user-provided public/LAN origin,
  - hosted registration and login work for users who opt into account-backed features,
  - signed-in users without paid managed-tunnel entitlement cannot provision an Omni-hosted tunnel and receive an actionable error,
  - `panel.omniharness.dev` health and readiness endpoints pass,
  - signed-in account with paid managed-tunnel entitlement can claim a remote installation,
  - Supabase stores installation, slug, token metadata, health, and audit events,
  - Cloudflare named tunnel and DNS record are real,
  - local app starts `cloudflared` using only the scoped token,
  - public hostname reaches local OmniHarness,
  - pairing QR uses the managed public origin only when healthy,
  - token rotation reconnects successfully,
  - revocation disables public access,
  - admin/status tools can explain failures without secrets.

## Self-Review Checklist

- [ ] No branch or worktree is required or assumed.
- [ ] The plan keeps the hosted control plane out of local Next file-based routing.
- [ ] Offline/local mode remains fully usable without registration.
- [ ] Bring-your-own tunnel mode remains accountless.
- [ ] Registration/login is available for hosted features.
- [ ] Omni managed tunnel provisioning is gated by paid entitlement.
- [ ] Supabase owns account and installation persistence.
- [ ] Cloudflare account credentials stay only in hosted service secrets.
- [ ] Local app receives only scoped installation/tunnel credentials.
- [ ] Cloudflare provisioning is idempotent and resumable.
- [ ] Health and status distinguish service health from installation health.
- [ ] Revocation is real and testable.
- [ ] Logs, diagnostics, and admin responses redact secrets.
- [ ] Deterministic tests and real gated integration tests are both specified.
