---
tags: [frontend, stable]
updated: 2026-08-01
---

# Catalog — Common Components

Files in `src/components/common/` — shared infrastructure that may depend on
providers. Conventions: [[component-conventions]].

## Site chrome — `chrome/`

The persistent shell mounted once by `app/layout.tsx` (ADR-0019) so it survives
route changes. All are client leaves; copy comes from `src/data/mocks/site.ts`
passed down by the layout.

| File | Role |
|------|------|
| `header.tsx` | `<Header>` — logo (`next/link` to `/`) + the "Menu" trigger. Reveal is gated on the `ready` flag. |
| `nav-menu.tsx` | `<NavMenu>` — half-page drawer. Clicking a group opens `<NavPage>`; only Home navigates directly. Spring panel + CSS cascade stagger. |
| `nav-page.tsx` | `<NavPage>` — full-screen page panel that slides down over the menu (`useTransition` translateY). Renders the active group's REAL page sections from `src/data/mocks/nav-pages.ts` (same data as the routed views; `m-`-prefixed ids), with Menu-back / Open-full-page / Close header and a natively scrolling body. |
| `site-footer.tsx` | `<SiteFooter>` — five route-linked columns, risk warning + withdrawal-rules line, legal bar, `AnimatedGradient` band. |
| `request-modal.tsx` | `<RequestModal>` — "Open account" dialog (submit still stubbed — does not call `/api/contact` yet). |

## Sections — `sections/`

Generic, data-driven section components the sub-pages (and two home sections)
compose — a view passes serialisable props from its `src/data/mocks/<route>.ts`
file, so views stay Server Components. All render `<section id aria-label>` +
`shell` + [[components/common|SectionHeading]] and animate with `<Inview>`.

| File | Renders |
|------|---------|
| `section-text.tsx` | `<SectionText>` — paragraphs + pill points + note + optional modal CTA + quote |
| `section-cards.tsx` | `<SectionCards>` — 2/3/4-column card grid; cards take `kicker/title/body/points/footnote`, optional `ordered` step lists, per-card anchor `id`, optional `background {src, side}` side-backdrop |
| `section-table.tsx` | `<SectionTable>` — spec table (tiers, ladders) with column headers + row headers |
| `section-faq.tsx` | `<SectionFaq>` — open question/answer cards |
| `section-steps.tsx` | `<SectionSteps>` — numbered `<ol>` sequence, 3/4/5 columns |

## MarkReady — `mark-ready.tsx`

Renders `null`; sets the `useUi` `ready` flag on mount. **Every view that
renders without `IntroVideo` must mount it** — the flag gates all
above-the-fold reveals and only the home intro film flips it otherwise
(ADR-0019). `IntroVideo` self-skips when the flag is already `true`.

## OpenAccountButton — `open-account-button.tsx`

`PillButton` linking to the trader platform's register page
(`tradeConfig.register` — ADR-0022). The request modal is now reserved for
the contact CTA (`SectionText ctaTarget="modal"`).

## Cookie — `Cookie/`

Self-contained cookie consent system — a bottom-right **banner** plus a full
category **preferences modal**. No third-party library (the old
`react-cookie-consent` dependency was removed). Lives in `src/components/common/Cookie/`.

| File | Role |
|------|------|
| `Cookie.tsx` | Mount component — hydrates the store, renders banner + modal |
| `LazyCookie.tsx` | `next/dynamic` `ssr:false` wrapper — keeps cookie JS out of first-load |
| `CookieBanner.tsx` | Bottom-right consent banner |
| `CookiePreferencesModal.tsx` | Category preferences dialog with per-category toggles |
| `CookieButton.tsx` | Local button primitive — `primary` / `secondary` variants |
| `cookieStore.ts` | Zustand store + `localStorage` persistence |
| `index.ts` | Barrel exports — `Cookie`, `LazyCookie`, `useCookieStore`, `CookieConsent` |

**Mounting** — the root layout renders `<LazyCookie />` inside `ScrollLayout`:
```tsx
import { LazyCookie } from "@/components/common/Cookie";
```

**State** — `useCookieStore` (Zustand). `consent` is `null` until the user decides;
the banner shows only after hydration confirms `consent === null`. Persisted to
`localStorage` under key `cookie-consent-v1`. Three categories: `necessary`
(always on), `analytics`, `marketing`.

**Styling & motion** — ported to the project stack: Tailwind v4 with the
`background` / `foreground` design tokens (dark-mode adaptive, no hardcoded hex),
and `@react-spring/web` for all motion — `useTransition` drives the banner and
modal mount/unmount, `useSpring` drives the toggle knob. No CSS transitions.
The modal locks scroll through the Lenis [[smooth-scroll|scroll store]]
(`useScroll.stop()`), not `body` overflow.

> [!note] `#todo`
> The privacy-policy link points to `/privacy-policy` — that route does not exist
> yet. Placeholder consent copy should be reviewed before launch.

## Grid — adaptive scaling (`grid/`)

The **adaptive scaling grid** keeps a rem-based layout proportional across every
viewport by scaling the root (`<html>`) font-size. Design in `rem` once, and the
whole UI scales as one unit. Lives in `src/components/common/grid/`.

| File | Role |
|------|------|
| `grid.config.ts` | Breakpoints + `FONT_BASE` — the single source of truth for the grid |
| `adaptive-grid.tsx` | `<AdaptiveGrid>` client component — drives the scale-up, renders `null` |
| `index.ts` | Barrel exports — `AdaptiveGrid`, `GRID_BREAKPOINTS`, … |

**How it works** — two halves cover the whole viewport range:

- **Scale down** (viewport ≤ 1920px) — `vw`-based `html { font-size }` media
  queries in `globals.css`. At each breakpoint's design base width the root
  font-size resolves to 16px; between breakpoints it tracks the viewport.
- **Scale up** (viewport > 1920px) — the `<AdaptiveGrid>` component sets an
  inline `html` font-size at runtime via [[hooks|`useAdaptiveGrid`]], so the
  design keeps growing (damped by `coef`) on large displays.

The `globals.css` media queries and `grid.config.ts` describe the same
breakpoints — **keep them in sync** (formula: `font-size = 16 * 100 / baseWidth vw`).

**Mounting** — the root layout renders `<AdaptiveGrid />` inside `ScrollLayout`:
```tsx
import { AdaptiveGrid } from "@/components/common/grid";
```
Mount it once. Props: `baseWidth` (defaults to the largest breakpoint) and
`coef` (0–1 scale-up damping, default `0.6666`).

> [!note]
> This replaced a `styled-components`-based scaling system that was dropped into
> `common/` — see [[decisions-log]] ADR-0008. `styled-components` is **not** a
> project dependency; the scale-down CSS lives in `globals.css` per [[design-system]].

## ReducedMotion — `reduced-motion.tsx`

`<ReducedMotion>` — a client leaf that calls react-spring's `useReducedMotion()`.
It watches the `prefers-reduced-motion` media query and toggles react-spring's
global `skipAnimation`, so every spring — and `spring-text-engine` — jumps to its
end state instead of animating. Renders `null`; mounted once in the root layout.
See [[animation-system]] and [[seo-metadata]].

## Skeleton loaders

Three skeleton components for `loading` states of async-data components — every
async component must mirror its final layout with one of these
(see [[component-conventions]]).

| Component | File | For |
|-----------|------|-----|
| `<SkeletonImage>` | `skeleton-image.tsx` | image placeholders |
| `<SkeletonLoader>` | `skeleton-loader.tsx` | generic block placeholders |
| `<SkeletonVideo>` | `skeleton-video.tsx` | video placeholders |

## `<LiquidReveal>` — `liquid-reveal.tsx`

Used by the home hero (restored 2026-08-01 after briefly being replaced by a
video loop). Before/after image pair with a soft cursor brush: `beforeSrc` is the always-shown
base (and the LCP image), `afterSrc` is painted along the pointer trail on a 2D
canvas and decays back when idle.

- Props: `beforeSrc`, `afterSrc`, `alt`, `className`.
- **The caller owns positioning.** The `<img>` and `<canvas>` inside are
  `absolute inset-0`, so `className` must carry `relative` or `absolute` — the
  component deliberately adds no position class of its own, because hardcoding
  `relative` collided with the hero's `absolute` and collapsed the host to zero
  height (see [[decisions-log]] ADR-0018).
- Params are fixed constants: brush radius `143`, decay `0.016`, dpr capped at
  `2`, hard clear after `120` idle frames.
- Skipped entirely under `prefers-reduced-motion: reduce` — the static base image
  remains.

> [!note]
> `components/ui/` now holds `icons.tsx` (8 inline SVGs sized `1em`, inheriting
> `currentColor`), `<PillButton>` (variants `dark`/`light`/`outline`, optional
> `right`/`up-right` arrow badge), `<Eyebrow>` (tones `dark`/`light`) and
> `<AnimatedLink>`. See [[folder-structure]].

## Related

[[component-conventions]] · [[components/animation-springs]]
