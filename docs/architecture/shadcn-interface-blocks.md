# Shadcn interface block generation

On 2026-07-31, before adapting the runner switcher and connection screen, the
official generator was run from the repository root:

```text
pnpm dlx shadcn@latest add sidebar-07
pnpm dlx shadcn@latest add login-03
```

Existing OmniHarness primitives were not overwritten.

The `sidebar-07` command created:

- `src/components/ui/skeleton.tsx`
- `src/hooks/use-mobile.ts`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/sidebar.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/nav-main.tsx`
- `src/components/nav-projects.tsx`
- `src/components/nav-user.tsx`
- `src/components/team-switcher.tsx`

It skipped the existing button, input, separator, tooltip, collapsible,
dropdown-menu, and sheet primitives.

The `login-03` command created:

- `src/components/ui/label.tsx`
- `src/components/ui/field.tsx`
- `src/app/login/page.tsx`
- `src/components/login-form.tsx`

It skipped the existing button, card, input, and separator primitives.

Before adaptation, both `pnpm build:interface:web` and
`pnpm build:interface:packaged` passed. The interface TypeScript project
passed. The full TypeScript project exposed a Vite 8/Vitest 3 type mismatch;
Vite was aligned to 7.3.2 and the React plugin to 5.2.0, after which the full
check passed.

The two generated `src/app/**/page.tsx` demo routes and the six Acme/dashboard
sample composition components were then removed as block-only demo wiring.
They used sample copy and local component state that violate OmniHarness's
i18n and Manager rules. The generated primitives, tokens, hooks, and
dependency additions remain available for the real Manager-backed runner
switcher and connection flow.
