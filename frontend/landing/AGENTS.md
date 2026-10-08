# Agent Guide — Ezymax landing

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. **Heed deprecation notices and verify against the
docs before writing routing or framework code.**

## What this app is

The public marketing site for **Ezymax**, an invite-only CFD trading platform. It
funnels to one place: the waitlist, which posts through `/api/waitlist` to the
backend gateway. Everything else is content.

The brand is **Ezymax**; the domain is **ezymex.com**. That is not a typo — only
the domain was ever registered. URLs and e-mail addresses use `ezymex.com`,
visible copy says Ezymax, and `content/site.ts` is the only place either is
written down. Never "correct" an address to `@ezymax.com`; that domain is not
owned and the mail bounces.

This codebase began as a different site (setupzero.com, a vendor selling
brokerage software). Any remaining `SetupZero` / `setupzero` string outside an
explanatory comment is a bug.

## Hard rules (never violate)

1. **Nothing the code cannot support.** Ezymax takes deposits and holds no
   licence, so a wrong claim here is not a typo. Every number the site states
   about itself lives in `src/content/facts.ts` with a `source:` comment
   pointing at the config or table it was read from. If a figure has no source,
   the section that wanted it gets rewritten — it does not get an estimate.
   `facts.ts` also lists what is deliberately absent, and why. Read it before
   adding a statistic, a testimonial, a client count or a licence reference.
2. **Motion is `motion/react`** (Motion v14 — the import path is `motion/react`,
   not `framer-motion`). CSS keyframes are allowed **only** when registered as
   an `--animate-*` token in the `@theme` block of `src/app/globals.css`;
   ad-hoc `@keyframes` inside components are not. `Reveal` is the scroll
   primitive — use it rather than hand-rolling an intersection observer.
3. **Design tokens live in `src/app/globals.css`.** Tailwind v4, CSS-first —
   there is no `tailwind.config`. Colours come from the `@theme` tokens
   (`bg`, `bg-2`, `surface`, `ink`, `muted`, `dim`, `orange-*`, `line`) and
   composites from the `@utility` definitions (`glass`, `glow`, `highlight`,
   `bracket`, `container-x`, …). **Never write a raw colour in a class name.**
   Arbitrary values for one-off layout numbers (`h-[72px]`, `z-[200]`) are
   tolerated; arbitrary colours are not.
4. **Pages compose, content holds copy.** `app/**/page.tsx` assembles
   `src/components/sections/**` and reads every string from `src/content/**`.
   No component holds hardcoded marketing copy — if you find yourself typing a
   sentence into a `.tsx`, it belongs in a content file.
5. **Server Components by default**; add `"use client"` only at the leaves.
6. **No `any`.** Type everything. `yarn lint` runs the strict config with no
   rule overrides — keep it that way.
7. **Two API routes, and only two.** `/api/waitlist` is the invite gate and
   proxies to the gateway; `/api/contact` takes every form on the site, keyed
   by `type` (see `lib/lead-schema.ts`). **Do not recreate `/api/lead`** — it
   existed, only wrote to the server log, and silently discarded every
   submission. Secrets are server-only env vars read through `src/env.ts`;
   the browser calls same-origin `/api/*` and nothing else. Validate with
   `zod` and return the `{ data }` / `{ error }` envelope.
8. **Navigation** — standard `next/link` `<Link>` and `next/navigation`
   `useRouter`.
9. **Semantic, SEO-correct HTML** — native elements over `div`s, one `<h1>` +
   a clean heading outline, named landmarks, real `button`/`a`, `alt` text,
   JSON-LD (not microdata).
10. **Images are keyed by slug.** `content/images.ts` maps market and platform
    slugs to photos, and the lookups **fall back silently** to one default on a
    miss — rename a slug in `markets.ts` or `platform.ts` without re-keying
    here and every card quietly shows the same picture. The build will not
    catch it. Photos are currently hot-linked from Unsplash; they should be
    vendored into `public/photos/` (the apex CSP is `img-src 'self' data:
    blob:`, so this only works because `next/image` re-serves them
    same-origin).
11. **3D performance → use the skill.** If the request is about performance,
    jank, or shipping readiness, invoke the **`optimize-3d-scene`** skill first
    and follow its order of fixes. The hero renders a WebGL scene
    (`components/three/`), already gated on desktop + WebGL support +
    `prefers-reduced-motion`, with a CSS fallback.

## Build notes

- `output: "standalone"` in `next.config.ts` is load-bearing — the Dockerfile's
  runner stage copies `.next/standalone`. `next start` does not work with it;
  use `node .next/standalone/server.js` after copying `.next/static` and
  `public` in beside it.
- `tsc --noEmit` on a fresh clone **fails**: `LayoutProps<"/">` is generated
  into `.next/types` by `next build`. Use `yarn build` as the typecheck gate.
- The Docker builder stage needs network access — four `next/font/google`
  families (Inter, Manrope, Silkscreen, Space Mono) are fetched at build time.
- yarn, not npm or pnpm. The Dockerfile installs with `--frozen-lockfile`, so
  a dependency change that is not committed to `yarn.lock` fails the build on
  the server.

## After making changes

Update the vault in `obsidian/`: dependency changes → `tech-stack.md` +
`changelog.md`; architectural choices → an ADR in `decisions-log.md`.
