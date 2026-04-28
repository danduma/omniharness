# Loading Screen Redesign: Skills I Would Use

If you told me to fully redesign the OmniHarness loading screen, I would use two primary skills: `impeccable` first, then `frontend-design`.

## Project Frontend Stack

This repo has a real frontend surface, not just backend code.

- **Framework:** Next.js `15.5.15` with React `19.1.0` and TypeScript, based on `package.json:30`, `package.json:32`, and `package.json:60`.
- **Routing model:** The app uses the Next App Router under `src/app`, with the home page rendering `HomeApp` from `src/app/page.tsx:1`. I would not introduce file-based routing for this task. I would keep the redesign in the existing component path.
- **Loading screen component:** The current loading screen lives in `src/components/BootShell.tsx:5`. It is a small client component with a centered card, radial background, Lucide spinner, and static “Loading your workspace...” copy.
- **When it appears:** `HomeApp` renders `BootShell` while route readiness, auth session loading, or pair-token redemption is pending, as shown in `src/app/home/HomeApp.tsx:1121`.
- **Styling system:** Tailwind CSS v4 is imported in `src/app/globals.css:1`, `tw-animate-css` is available at `src/app/globals.css:2`, and shadcn styles are imported at `src/app/globals.css:3`.
- **Design tokens:** Theme colors, radii, font variables, dark mode tokens, and shadcn-compatible CSS variables are centralized in `src/app/globals.css:7` and `src/app/globals.css:51`.
- **Component system:** shadcn is configured with `base-nova`, TypeScript, CSS variables, neutral base color, Lucide icons, and aliases in `components.json:3` and `components.json:13`.
- **Theme bootstrapping:** Dark mode is applied before hydration through a localStorage bootstrap script in `src/app/layout.tsx:18`, so the loading screen must look correct before and after React hydration.
- **Fonts and app shell:** The root layout currently uses Geist and Geist Mono through `next/font/google` in `src/app/layout.tsx:8` and `src/app/layout.tsx:13`.
- **Validation path:** The repo has `pnpm lint`, `pnpm build`, unit tests, and Playwright e2e scripts in `package.json:11`, `package.json:13`, `package.json:14`, and `package.json:16`.

## Primary Skill: `impeccable`

I would use `impeccable` as the lead skill because this is explicitly a redesign task, not just a component rewrite. The loading screen is a short-lived but important first impression, and `impeccable` is the right skill for shaping the UX, visual hierarchy, motion, accessibility, responsiveness, edge states, and production polish.

How I would apply it:

- **Shape the loading experience:** Decide what the loading screen should communicate: app booting, workspace hydration, auth check, or phone-pair handoff. Right now all states collapse into one generic message.
- **Improve information architecture:** Consider whether the screen needs distinct microcopy for “checking session,” “opening workspace,” and “pairing device,” or whether it should stay intentionally minimal.
- **Audit UX constraints:** Keep the screen fast, accessible, non-distracting, responsive, and compatible with both light and dark themes.
- **Design motion intentionally:** Replace the generic spinner with purposeful loading motion tied to OmniHarness’ multi-agent orchestration identity, while respecting `prefers-reduced-motion`.
- **Harden edge cases:** Ensure the design works during slow auth checks, mobile PWA launch, dark-mode bootstrap, tiny viewports, and high contrast needs.
- **Polish the final UI:** Check spacing rhythm, typography, color balance, contrast, focus semantics, and whether the screen feels native to the rest of OmniHarness.

Relevant `impeccable` modes I would likely use:

- `shape BootShell` to define the UX concept before coding.
- `animate BootShell` to plan restrained, meaningful motion.
- `adapt BootShell` to make the screen responsive across desktop, tablet, and mobile PWA contexts.
- `harden BootShell` to cover accessibility, reduced motion, hydration, and slow-state behavior.
- `polish BootShell` as the final quality pass.

## Secondary Skill: `frontend-design`

I would use `frontend-design` after the UX direction is clear. Its role would be to turn the loading screen into a distinctive, production-grade interface rather than another generic centered spinner card.

How I would apply it:

- **Create a strong visual concept:** For OmniHarness, I would likely explore a “multi-agent command center coming online” direction, with layered signals, worker nodes, terminal-inspired rhythm, and calm supervision rather than flashy SaaS gradients.
- **Avoid generic AI UI:** The current component is clean, but it is also conventional. `frontend-design` would push it toward a more memorable scene with a specific point of view.
- **Use the existing stack:** Build with React, Tailwind v4 utilities, CSS variables, Lucide only where useful, and CSS animations from local styles or `tw-animate-css` rather than adding a heavy motion dependency.
- **Respect theme tokens:** Use `background`, `foreground`, `muted`, `border`, `ring`, and dark-mode variables from `globals.css` so the redesign feels integrated.
- **Keep implementation focused:** Most work should stay in `src/components/BootShell.tsx`. If custom keyframes or reusable loading tokens are needed, add them to `src/app/globals.css`.
- **Make it feel alive:** Use atmospheric depth, timed reveals, subtle status text, progress illusion, node pulses, or terminal-like scanlines, but keep it calm enough for repeated app launches.

## Conditional Skills

I would only use these if the prompt included extra input:

- **`screenshot-to-component`:** Use this if you gave me a screenshot, mockup, or visual reference for a single loading-screen component and wanted close visual parity inside `BootShell`.
- **`screenshot-to-code`:** Use this if you gave me a full-page loading-screen screenshot and wanted an end-to-end reproduction with iterative browser screenshots.
- **`impeccable live`:** Use this if the app were running and you wanted browser-guided iteration on exact visual variants.

I would not use the spreadsheet, slides, QR, startup naming, skill creator, or skill installer skills for this task.

## Implementation Plan I Would Follow

If asked to actually do the redesign, I would proceed in this order:

1. Inspect `BootShell`, global tokens, dark mode bootstrapping, and app loading states.
2. Use `impeccable` to choose the UX direction and motion rules.
3. Use `frontend-design` to create a distinctive visual treatment that fits OmniHarness.
4. Update `src/components/BootShell.tsx` with the redesigned markup and Tailwind classes.
5. Add only minimal custom CSS to `src/app/globals.css` if Tailwind utilities are not enough.
6. Avoid creating new routes such as `loading.tsx`, because the existing app already renders `BootShell` through `HomeApp`.
7. Validate with `pnpm lint` and preferably `pnpm build`; use Playwright or a browser screenshot if visual fidelity matters.

## Short Answer

I would use `impeccable` for UX direction, accessibility, motion strategy, responsiveness, and polish, then use `frontend-design` for the actual high-quality visual redesign. If you supplied a screenshot or visual target, I would add `screenshot-to-component` or `screenshot-to-code` depending on the scope.
