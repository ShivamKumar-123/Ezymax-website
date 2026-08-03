---
tags: [meta, changelog]
updated: 2026-08-01
---

# Changelog

Chronological log of notable changes to the project. Newest first.
This is a human-curated log — not a mirror of `git log`.

## 2026-08-01 (evening) — Hero typewriter + subline crawl + split comparison

- **Landing wired into the fxartha trader platform (2026-08-03)** — new
  `NEXT_PUBLIC_TRADE_URL` public env (default `http://localhost:3001`) +
  `tradeConfig` in `src/lib/site.ts`; every conversion CTA now links into the
  platform (`/auth/register` / `/auth/login`): drawer Open-account/Log-in,
  home final CTA, referral, and the four page CTAs via `SectionText`'s new
  `ctaTarget="trade"` (contact keeps the modal; `OpenAccountButton` now links
  to register). In the platform clone (branch `shivam`): the site was merged
  in as `frontend/landing` and the trader app's `(landing)` group deleted —
  its `/` redirects to `/auth/login`. See [[decisions-log]] ADR-0022 and
  [[environment-variables]]. Demo login still needs the monorepo's Docker
  backend (Docker not installed on this machine).
- **Drawer accordion replaced by full slide-down pages (2026-08-03)** — the
  digest accordion read as "just options" and its measured-height panel was
  unreliable, so clicking a nav group now slides a **full-screen page panel**
  down over the menu (new `chrome/nav-page.tsx`, `useTransition` translateY,
  fixed layout — no height measurement) carrying the SAME sections the routed
  page renders, from the same data: new aggregate
  `src/data/mocks/nav-pages.ts` imports the five pages' mocks and the layout
  passes it to `NavMenu`. Section ids are `m-` prefixed to avoid collisions
  with the page underneath; the panel header has Menu (back) / page name /
  Open full page / Close; body scrolls natively (Lenis already stopped).
  `RequestModal` z raised 110 → 125 so in-panel "Open account" CTAs surface
  above the drawer. `navLabels` gained `backToMenu`/`close`. The accordion
  `Panel`, per-item `blurb` rendering and group `intro` display were removed
  from the menu (blurb/intro copy remains in `navGroups` data, currently
  unused).
- **Drawer nav is now an accordion (2026-08-02)** — clicking a group label no
  longer navigates; it slides open a spring-animated panel in place
  (`Panel` sub-component: measured-height spring, `aria-expanded`/
  `aria-controls`, `inert` while closed) showing that page's content digest:
  a one-line group `intro`, every section as a link with a `blurb`, and an
  "Open full page" link. Only `Home` navigates directly. `navGroups` items
  gained `blurb` copy (+ per-group `intro`); new `navLabels` export; drawer
  nav container switched from vertically-centred to scrollable top-aligned
  so tall expansions don't clip. Rotating arrow indicator on group rows.
- **Cursor tubes recoloured to a void-black palette** — `TubesCursor` swapped
  from neon lime to "black knight / black hole": near-black tube bodies
  (`#050505/#0d0d0d/#161616`) lit by grey→white rim lights
  (`#6b6b6b/#3d3d3d/#ffffff/#242424`) so they render as glossy dark coils
  against the obsidian page; the click re-roll (`randomVoid`) now stays
  inside 2–16% lightness greys.
- **Hero art restored, video dropped** — the ambient F1 loop was removed from
  the hero (file kept unused at `public/assets/hero/hero-loop.mp4`) and both
  hero images returned with their original brush animation: `<LiquidReveal>`
  (base jpg + cursor-painted png) is **in use again**, with the left-dark
  scrim and lime screen-blend wash, under the typewriter h1.
  `heroContent.video` → `beforeSrc`/`afterSrc`. The same two images also
  remain as the Rewards opener's framed cards — flagged to the user as
  intentional duplication to revisit.
- **Hero stripped to video + headline; Rewards opener now static with big
  art** — the hero's bottom block (subline ticker crawl, Open-account/Connect
  CTAs, example pill, risk line) was overlapping the film and is removed:
  the hero is now the ambient loop + centred typewriter h1 only
  (`heroContent` fields `sublineTicker`/CTAs/`example`/`risk` deleted; CTAs
  remain in the drawer). **`Marquee` is now unused** (kept in
  `components/ui/` as a reusable primitive). The Rewards opener dropped its
  scroll-slide pin entirely — `scroll-slide.tsx` deleted (git history) — in
  favour of a static aligned grid `[1fr_2fr_1fr]`: big bold art cards
  (`ring-2`, ±4° tilt, full column width) left and right of the centred
  heading, revealed with plain `<Inview>` like every other section.
- **Hero gains an ambient background video loop** — user-supplied
  `hero page vedio.mp4` (2.4 MB, F1 car through a trading-chart tunnel) moved
  to `public/assets/hero/hero-loop.mp4` and rendered behind the hero
  typography: muted `autoPlay loop playsInline`, `aria-hidden`, 70% opacity
  under left/bottom scrims. The generator's corner watermark is cropped out
  by a 1.12 `scale` inside the hero's `overflow-hidden` (no ffmpeg available
  for a re-encode). Pauses under `prefers-reduced-motion`. Wired via
  `heroContent.video`.
- **Former hero art returns as framed cards on the Rewards slide** — both
  images (`hero-standing.jpg`, `hero-portrait.png`) now ride the pinned
  `ScrollSlide` as tilted card figures (±6°, `rounded-card-sm`, white/lime
  rings, 3:4 crop) flanking the "We reward how you trade…" heading; desktop
  only (`lg:`+), decorative (`aria-hidden`, empty alt). Sourced from
  `rewards.art` in the home mock data.
- **Section backdrops removed after review; Rewards heading now a scroll
  slide** — the two relocated hero images (margin-calculator right,
  settlement left) were removed the same day at the user's call ("not
  looking good"); both sections are back to clean glass-on-obsidian. The
  `SectionCards` `background` prop remains available but unused. The Rewards
  pinned opener swapped its image fly-across for a **text slide**: new
  `components/ui/scroll-slide.tsx` (`<ScrollSlide>`) pins the heading
  viewport-high and slides it in from the right, holds centred, and out to
  the left, paced by scroll (same piecewise-progress + spring pattern).
  `scroll-fly-in.tsx` deleted (no callers; lives in git history);
  `rewards.flyIn` removed from the mock data. The site is now fully
  image-free apart from the intro film.
- **Hero blanked; its art relocated to two sections** — the hero dropped
  `LiquidReveal` and all scrims/washes and is now pure typography over the
  tubes canvas + grid/noise textures. `hero-standing.jpg` became the
  right-side backdrop of the margin-calculator section and
  `hero-portrait.png` the left-side backdrop of the Automatic-settlement
  section — big (3/5 section width), at 75% opacity with
  **`mix-blend-screen` over an obsidian span** so the art's black background
  dissolves into the page, fading into `--background` via directional +
  vertical gradients; hidden on mobile. With a side backdrop the heading
  block aligns to the clear side (settlement heading sits right) and the
  glass cards write over the art. `SectionCards` gained an optional
  `background: { src, side }` prop for this; the margin calculator renders
  its own. `heroContent.beforeSrc/afterSrc` removed. **`LiquidReveal` is now
  unused** (kept in `components/common/`, see [[components/common]]).
- **Opening film replaced with the new FXARTHA intro** — user-supplied
  `FXARTHA Intro.mp4` (1.8 MB) moved from the repo root to
  `public/assets/intro/fxartha-intro.mp4` and wired via `introContent.src`;
  the previous `opening.mp4` (936 KB) remains on disk unused. `IntroVideo`
  behaviour unchanged (muted autoplay, sound toggle, skip, `ready` gate,
  self-skips mid-session).
- **Rewards section gains a scroll fly-across opener** — new
  `components/ui/scroll-fly-in.tsx` (`<ScrollFlyIn>`): a 200lvh block pins
  its centre viewport-high; the section heading sits static while the gold
  card art (`rewards.flyIn` in the home mock data) sweeps from off-screen
  left to off-screen right, fading in/out at the ends. Spring-based port of a
  user-supplied framer-motion `useScroll`/`useTransform` reference —
  **framer-motion was NOT installed** (banned, ADR-0002); `ProgressTrigger`
  maps scroll progress piecewise to x(vw)/opacity through one spring. The
  Rewards heading moved inside the pinned block (centered, light tone);
  cards/ladder/activity flow below unchanged.

- **Hero headline is now a write-and-delete typewriter** — new
  `components/ui/typewriter.tsx` (`<Typewriter>`): timer-driven substring
  typing/holding/deleting/cycling with a spring-blink caret, gated on the
  intro `ready` flag; cycles the four headline variants from the copy doc
  (`heroContent.headlineVariants`, first = canonical h1 SEO/SR text; the h1
  reserves the height of its longest variant to avoid layout jumps). Static
  first phrase under prefers-reduced-motion. Rule interpretation logged as
  [[decisions-log]] ADR-0021 (state-driven content vs TextEngine glyph
  animation — TextEngine cannot loop write/delete without banned
  `mode="manual"`).
- **Hero subline runs as a continuous ticker crawl** — new
  `components/ui/marquee.tsx` (`<Marquee>`): duplicated row + linear-timed
  spring translating exactly one copy's width per loop (seamless, constant
  px/s, ResizeObserver-measured; no keyframes), edge-fade mask, lime dot
  separators; static wrapped paragraph under reduced motion. Replaces the
  TextEngine word-fade subline; copy now `heroContent.sublineTicker[]`.
- **Problem/Solution rebuilt as hero-scale alternating split rows** — the two
  image-backed cards became full-width rows: content column (mono kicker,
  4–6xl bold title, numbered steps at body-large, closing line) beside a big
  `75lvh` image column; broker row = image right, FX Artha row = image left
  (`lg:order-*` swap), watermark row number on the art. `StoryCard`/`Hover`
  lift dropped in favour of `SplitRow`.

## 2026-08-01 (later still) — Ticker-tape statement band

- **`TickerBand` home section shipped** (`src/views/home/ticker-band.tsx`,
  mounted between Problem/Solution and the margin calculator, section
  `id="ticker"`): a horizontal ticker-tape statement — one continuous sentence
  ("In every trade, your money stays yours…") that glides sideways as the
  visitor scrolls a pinned 250lvh section. Implementation of a user-supplied
  GSAP-ScrollTrigger reference **adapted to the spring system** (ADR-0002 —
  no GSAP): `<ProgressTrigger start="top top" end="bottom bottom">` maps
  scroll progress to a spring-smoothed `translate3d` across the strip's
  measured overflow (ResizeObserver-cached), with a lime scroll-progress line
  beneath. Inline "punctuation" elements flow inside the sentence: lime SVG
  curve, mono `Live settlement` status tag, emerald check, and a
  `$9,460 withdrawable` glass chip. Lime-gradient italic emphasis words via
  `bg-clip-text`. Accessibility: full sentence in an `sr-only` paragraph; the
  visual strip is `aria-hidden`. New `Check` icon added to `icons.tsx`;
  copy in `tickerBand` (`src/data/mocks/home.ts`). Design chosen from the
  Superdesign canvas round (base "Horizontal Ticker Band" draft).

## 2026-08-01 (later still) — Superdesign tooling

- **Superdesign adopted for design-version exploration** (user request, for the
  horizontal ticker-tape text section): skill installed globally at
  `~/.claude/skills/superdesign/`, `@superdesign/cli` v0.9.0 installed globally
  via npm (**not** a project dependency), repo analysis output lands in
  `.superdesign/init/`. Registered per the skill convention — see
  [[superdesign]] and the skills table in [[ai-agent-guide]]. Designs it
  produces are visual references only; implementation still follows the hard
  rules (springs not GSAP, tokens, route→view).

## 2026-08-01 (later) — Obsidian & Lime retheme

- **Whole theme swapped to the "Obsidian & Lime" glassmorphism reference**
  (user-supplied design spec, adopted directly onto the existing layouts) —
  executed almost entirely as a Tier 1/2 token swap in `globals.css`, which is
  exactly what the three-tier convention exists for. Obsidian ink ramp
  (#0a0a0a/#0c0c0c/#161616), neon-lime accent #ccff00 (+ #deff4d / #9ec700),
  emerald `--accent-positive` #10b981, glass tokens (`--glass` rgba-white 3% +
  `--glass-blur` 16px + `--line` → rgba-white 10% border), `--shadow-glow` lime
  CTA glow, card radii bumped to 2.5rem/1.5rem. See [[decisions-log]] ADR-0020
  and [[design-system]].
- **Fonts: Onest → Space Grotesk (sans) + JetBrains Mono (mono)** via
  `next/font/google`; `--font-mono` binding added. Display headings are now
  `font-bold tracking-display` (−0.05em, the "bold + squeezed" typography also
  requested separately); technical labels (eyebrows, table headers, footer
  column titles, clock) are mono `uppercase tracking-label` (0.2em). `Eyebrow`
  restyled as the reference's system-status tag.
- **Glassmorphism surfaces** — card/panel fills swapped from `bg-ink/85` /
  `bg-surface/80` / `bg-white/[0.04]` to `bg-glass` + `backdrop-blur-glass`
  (16px, per the reference's legibility rule) across section components, home
  sections, tables and FAQ cards. Primary `PillButton` gains `shadow-glow` and
  bold weight.
- **Anti-flat textures** — fixed 60px grid + noise-SVG overlays added as
  `body::before/::after` pseudo-elements (`@layer components`, ADR-0012 case)
  at z-index 1, visible through translucent sections.
- **Canvas palettes repainted** — `TubesCursor` tube/light colours and its
  click re-roll now lime/emerald; `AnimatedGradient` `Artha` preset now black →
  deep olive → lime. Hero's gold radial wash → lime. `--ease-entrance` updated
  to the reference curve `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Not adapted verbatim:** the reference's `@keyframes float/pulse` (banned —
  ADR-0002; the floating-card treatment is skipped, dots are static), and its
  layout restructure (floating shell, bento grid, split hero) — the user chose
  "retheme existing layouts" scope. Hero/section photography is still the
  gold-toned art set; flagged for a future asset swap.

## 2026-08-01

- **Site restructured from one-pager to six routes** — `/trade`, `/platform`,
  `/earn`, `/protection`, `/company` added beside `/`, matching the five nav
  groups (Trade · Platform · Earn · Protection · Company). Each route follows
  ADR-0003 (thin `app/<route>/page.tsx` → `src/views/<route>/index.tsx`), exports
  route metadata via the shared generator, and opens with a `PageHero` (back
  link + h1). `sitemap.ts` now lists all six routes. See [[decisions-log]]
  ADR-0019.
- **Site chrome hoisted into the root layout** — `Header`, `NavMenu`,
  `SiteFooter`, `RequestModal` moved from `views/home/` to
  `components/common/chrome/`; `TubesCursor` and the skip link moved into
  `app/layout.tsx`. Chrome now persists across routes (one WebGL context, no
  remounts). See [[components/common]].
- **Drawer nav rebuilt around routes** — `navItems` (`{label, target}` scroll
  targets) replaced by `navGroups` (`{label, href, items[]}`) in the new
  site-wide data file `src/data/mocks/site.ts`; drawer entries are `next/link`
  links (big label → page, small labels → section anchors). Logo links to `/`.
- **`ready`-gate handling for sub-pages** — new `<MarkReady>`
  (`components/common/`) releases the reveal gate on pages that render without
  `IntroVideo`; `IntroVideo` now skips itself when the gate is already open
  (i.e. the visitor navigated home from a sub-page mid-session).
- **Generic data-driven section components** — `components/common/sections/`:
  `SectionText`, `SectionCards`, `SectionTable`, `SectionFaq`, `SectionSteps`.
  All five sub-pages (and two home sections) compose these instead of bespoke
  section files. New ui primitives: `BackLink`, `PageHero`; new common
  `OpenAccountButton` (modal CTA usable from Server Components).
- **Homepage copy rewritten around the custody claim** — hero ("Trade CFDs
  without handing your money to a broker"), broker-vs-contract step comparison,
  a new **interactive margin calculator** (deposit/lots/leverage sliders with a
  spring-animated locked-vs-free bar), How-It-Works cut from 7 to 5 steps, a new
  Automatic Settlement section, honest trading-mode trade-offs, insurance FAQ
  (funding source named), Gamification renamed **Rewards** (`rewards.tsx`,
  `gamification.tsx` deleted) with an XP ladder table, staking/referral
  tightened, and a "Why traders choose FX Artha" five-point block.
- **Unverifiable copy-trading statistics removed** — the 500+/72% ROI/$40M/4.8⭐
  scroll-counter stat cards were placeholder numbers; replaced with verifiable
  process claims + a risk disclaimer. (`StatValue`/`ProgressTrigger` counter
  removed with them.)
- **Broker/not-a-broker contradiction resolved** — footer tagline,
  `siteConfig.description` and the final-CTA disclaimer all now carry the same
  protocol positioning ("protocol-driven trading ecosystem with automated
  settlement"); "institutional-grade forex and CFD broker" removed site-wide. A
  withdrawal-rules qualifier line was added under the footer risk warning.
- **`AnimatedLink` is route-aware** — internal `/…` hrefs render `next/link`;
  mailto/hash/external stay plain anchors. `loaderContent` (declared, never
  consumed) removed from the home mock data.

## 2026-07-31

- **Project forked as the Lumora site** — an independent design & engineering
  studio landing page. Git history reset to a single initial commit; `siteConfig`
  rebranded. **No new dependencies** — Lenis, zustand and the spring stack the
  starter already ships cover the whole theme.
- **Lumora palette added to `globals.css`** — Tier 1 `--raw-color-ink/grey/rust-*`
  plus hero gradient stops, Tier 2 `--ink`, `--muted`, `--subtle`, `--line`,
  `--surface`, `--surface-raised`, `--accent[-from|-to]`, `--hero-from|to`, and
  Tier 3 `--radius-pill|card|card-sm|control`, `--text-watermark`,
  `--container-shell`. The design is a **fixed light palette**, so the
  `prefers-color-scheme` override was removed rather than re-themed — the ink
  surfaces are a contrast device, not a dark mode.
- **`.shell`** page-gutter utility added under `@layer utilities` (max-width +
  auto margins, no structure of its own → a utility, not a component).
- **`components/ui/` created** — first design-system primitives: `icons.tsx`
  (8 inline SVGs, `1em` + `currentColor`), `PillButton`, `Eyebrow`,
  `AnimatedLink`.
- **`<LiquidReveal>`** (`components/common/`) — the hero's before/after brush
  reveal on a 2D canvas. See [[components/common]].
- **`useClock`** (`hooks/use-clock.ts`) — live local time/date for the header and
  nav overlay. See [[hooks]].
- **`useUi`** (`lib/ui-store.ts`) — zustand store for the loader `ready` gate and
  the two overlays; scroll locking reuses the starter's `useScroll`.
- **Home view built out** — `views/home/` with loader, header, hero, about,
  create band, portfolio, services, stats, footer, nav menu and request modal.
- **Two bugs found by screenshotting the running page** (neither was visible to
  `lint` or `tsc`), see [[decisions-log]] ADR-0018:
  - `LiquidReveal` hardcoded `relative` while its caller passed `absolute`, so
    the host collapsed to zero height and the hero image never showed.
  - The services row hover animated `padding`/`background-color` through
    react-spring, which hydrates dirty — react-spring's SSR style object uses
    camelCase keys and unnormalised colours that never match its client DOM
    writes. Converted to a CSS transition, which ADR-0014 already sanctions for
    a discrete hover fill.

## 2026-07-25

- **Released into the public domain (Unlicense)** — the starter now ships a root
  `LICENSE.md` carrying the [Unlicense](https://unlicense.org) and declares
  `"license": "Unlicense"` in `package.json`. Anyone may copy, modify, sell, or
  redistribute it with **no attribution requirement and no copyright retained** —
  the intent being that projects built from this starter can absorb it wholesale
  without carrying a notice. Briefly authored as MIT in the same session and
  changed before any release; the MIT attribution clause was the specific thing
  being dropped, so a recognized no-attribution licence was chosen over an
  edited MIT text. `"private": true` is unchanged, so npm publishing stays
  blocked regardless — the licence governs redistribution of the source, not
  registry availability.

## 2026-07-24

- **`optimize-3d-scene` hardened from its first field run** — the skill was run
  on a real raw-WebGL scene (no three.js, no scroll) and eight gaps came back,
  ranked by the time each cost. Fixed in `SKILL.md` and `references/patterns.md`:
  **§0** now ships a `getContext` hook so a non-three.js scene has counted
  equivalents of `renderer.info` (`draws` / `verts` / `links[]` timestamps /
  captured `attrs`) — previously §0 was unexecutable there — plus the
  *measurement environment* rules that invalidate everything if missed
  (production build only: dev's eager chunks fake a §1 failure and Strict Mode's
  double-mount fakes 2 listeners and a halved fps; kill the stale server;
  `waitUntil: "load"`, since `networkidle0` never fires against `next start`;
  SwiftShader is not a GPU, so only counted quantities transfer). **§3** now
  states that **§1 breaks it** — `dynamic(ssr: false)` pushes compilation past
  hydration, measured at 5.0 s against a loader lifting at 2.36 s — and gains a
  fifth stall cause (CPU decode/parse → **Worker**, 3.9 s measured) and the
  `as="fetch"` preload credentials trap (only `use-credentials` + `include`
  dedupes; the others silently download twice). **§5** admits `1000/30` measures
  ~26 fps given the ticker's `<=` throttle. **§7** requires a decile ordering
  check before truncating a baked point buffer (one was spatially sorted —
  truncating would have deleted half the subject). **§13** splits canvas `lvh`
  from content `dvh`. **§1**'s poster is rejustified — crawler screenshots and
  the no-WebGL fallback, not layout stability — with two crops and the
  `headers()` → static-prerender (`○`→`ƒ`) trade-off named. Unchanged on
  purpose: the cheapest-first order, the canonical-file table, and "port, don't
  invent". ADR: [[decisions-log]] ADR-0017.
- **`optimize-3d-scene` skill registered in the vault** — the new skill at
  `.claude/skills/optimize-3d-scene/` is now a first-class part of the workflow
  set, documented in [[optimize-3d-scene]] and linked from the
  [[README|Map of Content]] and [[ai-agent-guide]].
  **Routing rule (AGENTS.md hard rule #11):**
  a performance / jank / pre-ship request on a project that renders a three.js
  or WebGL scene must invoke the skill and follow its fourteen-step order — no
  improvised fix list. The vault note also maps the skill's canonical patterns
  onto primitives the starter *already* ships, so nothing gets duplicated:
  `subscribeToTicker` (`src/lib/animation/ticker.ts`, ADR-0009) is the one
  app-wide rAF loop the skill's §4/§5 ask for, `isBot()` (`src/utils/is-bot.ts`,
  ADR-0010) is the §1 bot path, the Lenis scroll store is the §9/§10 scroll
  source, `useDynamicInView` is the §4 visibility gate, and `lvh.ts` covers §13
  sizing. Only device tiering (§2) has no local equivalent. The starter itself
  carries **no `three` dependency** ([[tech-stack]] unchanged) — this applies to
  projects built from it. ADR: [[decisions-log]] ADR-0016.
- **Fixed a broken path inside the skill** — its closing "write it down" step
  pointed at `obsidian/Meta/changelog.md` / `decisions-log.md` (capital `M`, and
  an `open-questions.md` that does not exist here), so an agent following it
  would have written to a non-existent folder. Rewritten against this vault's
  actual `obsidian/meta/` layout.
- **`ai-agent-guide` gained a Skills section** — how skills are registered
  (drop in `.claude/skills/<name>/`, add a `workflows/` note, link from the MoC
  and the skills table, log in the changelog), so the next skill follows the
  same path.

## 2026-07-17

- **README — one-prompt quick start** — added a copy-paste **⚡ Start in one
  prompt** block at the top of the README: a single prompt that has Claude Code
  (or Cursor) clone the starter, detach it from this repo's git history, read the
  vault first, and run the default install. The manual [Getting started](../../README.md#getting-started)
  path stays below for anyone who prefers it.
- **Fixed: `cp .env.example .env` broke `/api/contact`** — surfaced by writing
  that step into the quick-start prompt. Copying the example leaves
  `CONTACT_ENDPOINT=` (blank), which reaches zod as `""`, and `""` is not
  `undefined` — so `z.url().optional()` rejected it. The route returned **HTTP
  400 `{"path":"CONTACT_ENDPOINT","message":"Invalid URL"}`**, misreporting a
  *server misconfiguration* as the caller's bad input. `src/env.ts` now routes
  optional URLs through an `optionalUrl()` helper that preprocesses `""` →
  `undefined`. Verified end-to-end: a valid POST now returns 200, and genuinely
  invalid payloads still return 400. Any new **optional** variable must use the
  same helper — see [[environment-variables]].
- **README — corrected clone URL & Node requirement** — step 1 pointed at
  `github.com/textura/next16-claude-starter` (wrong org — the repo is
  `textura-agency/…`), so the documented clone would 404. Also added the Node
  floor (**22.13+**; 20.19+ works, 24 LTS recommended) — below it `yarn install`
  fails outright on `eslint-visitor-keys` — and the missing
  `cp .env.example .env` step.
- **TextEngine alignment & clipping rules documented** — two failure modes that
  bite every TextEngine block, now written into [[text-engine]] (new *Alignment &
  line-height* section), [[text-engine-reference]], and AGENTS.md hard rule #3.
  **(1)** The container renders `display: flex; flex-wrap: wrap`, so words are
  flex items and `text-align` cannot position them — a lone `text-center`
  silently does nothing. Always pair `text-*` with `justify-*` on the tag
  (`justify-between` is a trap: it spreads *words*, not lines). **(2)** `overflow`
  sets `overflow: hidden` on `inline-block` wrap layers whose height comes from
  `line-height`, so tight leading shaves descenders and accented caps — keep
  leading ≥ 1.1 via the new `leading-display` token, never `leading-none` with
  `overflow`, and watch for `text-5xl`+ which ship `line-height: 1`. Both fixes
  are **classes on the `TextEngine` tag** — no wrapper component, no helper to
  import. Verified against the `spring-text-engine@0.1.5` dist source.
- **Strict three-tier token naming convention** — tokens now follow a fixed,
  portable grammar so names are predictable across every project built from this
  starter: `--raw-<category>-<name>` primitives → `--<role>` semantic →
  `--<tw-namespace>-<role>: var(--<role>)` bindings in `@theme inline`. Only
  Tier 1 holds literals; Tier 2 names purpose and is the themeable layer.
  `globals.css` restructured accordingly — **no brand palette invented**, the
  convention is the deliverable. Two deviations from the reference article,
  verified by compiling a probe against `tailwindcss` v4.3.3: primitives are
  `--raw-*` and stay out of `@theme` (a `--color-*` entry would generate
  utilities and let markup skip the semantic tier), and **`--duration-*` is not a
  Tailwind v4 namespace** — `duration-fast` compiles to nothing, so durations
  stay Tier 2 and are used as `duration-[var(--duration-fast)]`. See
  [[decisions-log]] ADR-0015 and [[design-system]].
- **Narrow CSS-transition exception** — hard rule #1 no longer bans CSS
  transitions outright. CSS `transition-*` is allowed for simple discrete state
  changes only (hover/focus colour, opacity, border, small nudges), requiring
  token-backed timing (`duration-[var(--duration-fast)] ease-entrance`),
  `transition-*` only (`@keyframes` still banned), and utilities only. Everything
  scroll-driven, revealing, staggered, or layout-affecting stays spring-based.
  A hover colour fade no longer needs a client component wrapping `<Hover>`. See
  [[decisions-log]] ADR-0014, [[animation-system]], [[design-system]].
- **New tokens** — `--raw-color-white` / `--raw-color-neutral-100/900/950`,
  `--raw-duration-fast/normal`, `--duration-fast/normal`, `--leading-display`
  (1.1 — the TextEngine clip floor), `--ease-entrance`.
- **Build & lint verified clean** — `yarn lint` and `yarn build` both pass with 0
  errors and 0 warnings; no lint fixes were needed. Note: `yarn install` **fails
  on Node 20.17** (`eslint-visitor-keys` requires `^20.19 || ^22.13 || >=24`) —
  use Node ≥ 20.19; this repo was verified on 24.16.

## 2026-06-07

- **Fixed `<Inview>` standalone reveal + spring resize gating** — `<Inview>`
  never animated unless an external `trigger` ref was passed. The JSX `ref`
  callback wrote `inViewRef.current = node`, but that tuple slot is a *callback
  ref* (`setNode`), so the element was never observed and the `node` stayed
  `null`. Now calls `setInViewNode(node)`. This was also a build-breaking type
  error. Additionally, `<Inview>`, `<Spring>`, and `<Hover>` tracked `width` as a
  hook dependency but never passed it to `isMobileDisabled` — fixed by passing the
  tracked `width`, restoring resize re-evaluation and clearing the
  `react-hooks/exhaustive-deps` warnings. `yarn build` and `yarn lint` are now
  clean. See [[decisions-log]] ADR-0013 and [[components/animation-springs]].

## 2026-06-05

- **Home view emptied** — removed the animation showcase (`src/views/home-showcase.tsx`
  deleted) and reduced `HomeView` to an empty `<main>`. The home view is now the
  blank starting point for new work. Documented the convention — *if the project
  is empty and no other instructions are provided, start developing in the home
  view on route `/`* — in [[ai-agent-guide]] and [[new-page]].

## 2026-05-23

- **README — setup + Vercel deploy steps added** — *Getting started* expanded
  into a four-step flow (clone the template → delete bundled `.git` →
  initialise your own GitHub repo → install & run), with a macOS hint for
  revealing the hidden `.git` folder (`⇧ + ⌘ + .`). Added a *🚀 Deploy to
  Vercel* section covering the CLI flow (`vercel` / `vercel --prod`) and the
  dashboard import path, plus an `env pull` pointer to
  [[environment-variables]].
- **README rewritten to lead with the AI workflow** — root `README.md`
  reorganised so the AI usage guide is the first section: how the three
  `.claude/settings.json` hooks (`SessionStart`, `UserPromptSubmit`, `Stop`)
  enforce the vault workflow automatically, how to write a good request
  against this convention layer, and a cost-expectations note recommending
  **Claude Max (5×)** as the minimum plan (the vault-fan-out + hook
  re-injection on every turn is token-intensive by design). Technical
  *Getting started* and the existing AI-agents entry-point pointer stay
  below.

## 2026-05-22

- **Styling-placement convention added** — to stop `globals.css` accumulating
  hundreds of component-specific classes, styling now follows a strict
  placement order: one-offs are Tailwind utilities, repeated patterns become
  **React components** (not `@layer components` classes), and `@layer
  components` is reserved strictly for pseudo-elements and third-party
  overrides. `globals.css` stays bounded — `@import`, tokens, base resets only.
  No CSS Modules. Codified in [[decisions-log]] ADR-0012; [[design-system]]
  (new *Where a style goes* section) and [[component-conventions]] updated.
- **Semantic-HTML / SEO-markup convention added** — new [[html-semantics]]
  rulebook: landmarks, one `<h1>` + heading outline, native elements over
  `div`s, forms/images/ARIA, JSON-LD over microdata, a `data-*` convention, and
  passing a semantic `tag` to animation components. Codified as AGENTS.md hard
  rule #10; cross-linked from [[component-conventions]] and [[new-page]]. Fixed
  the demo (`home-showcase.tsx`) to a single `<h1>` to follow it.
- **API layer added** — a convention for reaching external services.
  `app/api/<resource>/route.ts` Route Handlers own their logic and read secret
  env vars directly (safe — route files never reach the browser). New: `zod`
  dependency; `src/env.ts` (validated env, public/server split); `src/lib/api/`
  (`handle` wrapper + `ApiError` + `{ data }`/`{ error }` envelope);
  `src/lib/api-client.ts` (typed same-origin fetch); example
  `app/api/contact/route.ts`. Codified as AGENTS.md hard rule #9. See
  [[decisions-log]] ADR-0011 and [[api-architecture]].

## 2026-05-21

- **Asset convention added** — site content assets (images, videos) now live
  under `public/assets/<section>/`, one folder per section; meta/PWA/SEO assets
  stay at the `public/` root. Documented in [[folder-structure]],
  [[component-conventions]], and the [[new-page]] playbook; `public/assets/`
  created with a `.gitkeep`.
- **SEO & performance hardening** — a broad pass on the starter. **SEO:** new
  `src/lib/site.ts` config (single source of truth, fed by `NEXT_PUBLIC_SITE_URL`);
  `metadataBase` is now always set (relative OG/canonical URLs resolve);
  `themeColor` moved to a `viewport` export; added `app/robots.ts`,
  `app/sitemap.ts`, and an `Organization`+`WebSite` JSON-LD helper; OG image
  dimensions corrected to match the asset; dead `keywords`/`other` tags dropped.
  **Performance:** populated `next.config.ts` (`removeConsole` in prod,
  AVIF/WebP, `next/image` breakpoints aligned to the grid, `poweredByHeader:
  false`); fixed a `requestAnimationFrame` leak in `ScrollLayout` (Lenis loop
  never cancelled on unmount); `HomeView` is now a Server Component with the
  animation demo split into the `HomeShowcase` client leaf; added
  `<ReducedMotion>` (honours `prefers-reduced-motion` via react-spring's global
  `skipAnimation`); removed a per-frame `console.log` from the demo; added
  `app/loading.tsx` / `error.tsx` / `not-found.tsx`. See [[decisions-log]]
  ADR-0010, [[seo-metadata]], and [[environment-variables]].
- **Animation engine — lint pass** — cleared all 13 pre-existing ESLint problems
  in the engine (2 errors + 11 warnings), an authorized engine edit (ADR-0009).
  `isMobileDisabled` now takes an optional `viewportWidth` argument, so the
  `active` memos in `<Spring>` / `<Hover>` / `<Inview>` / the trigger hooks
  depend on it genuinely. Added missing `disableOnMobile` effect deps; fixed a
  `trigger.current`-in-cleanup hazard in `<Hover>`; ref-stabilised `<Handle>`'s
  transition effects. **API change:** `useProgressTrigger` now returns `progress`
  as a `RefObject<number>` (read `.current`) instead of a render-time ref read —
  no consumer was affected (`<ProgressTrigger>` discards the return).
- **Animation engine — performance refactor** — fixed load issues that scaled
  with the number of animated components. Added `src/lib/animation/ticker.ts`, a
  single reference-counted `requestAnimationFrame` loop; `useLoop` (and all loop
  hooks) now subscribe to it instead of each starting its own rAF. `useWindowWidth`
  / `Height` / `Size` now share one debounced `resize` listener via a
  `useSyncExternalStore` store (the `debounceDelay` param was dropped — unused).
  `useDynamicInView` rewritten without the per-render `Proxy`/observer churn.
  Fixed a stale-closure bug in `useLoop`. `mode="forward"` scroll listeners made
  `passive`. This was an **authorized edit to `#do-not-modify` engine files** —
  hard rule #2 amended. See [[decisions-log]] ADR-0009 and [[animation-system]].
- **`spring-text-engine` updated** — bumped `^0.1.3` → `^0.1.5` (latest). The
  public API, types, and dependencies are unchanged between these versions
  (verified) — an internal-only patch bump, no code changes required.
- **Adaptive scaling grid added** — a root-font-size scaling system landed in
  `src/components/common/grid/` (`<AdaptiveGrid>` + `useAdaptiveGrid` hook +
  `grid.config.ts`), with `vw` media queries in `globals.css` for scale-down.
  It was dropped into `common/` as a `styled-components` system; ported to the
  project stack — config-driven TS + CSS-only Tailwind, no `styled-components`.
  The unused dropped files (`colors.ts`, `fonts.ts`, `utils.ts`, `index.ts`,
  the `styled-components` `grid.tsx`) were removed. Mounted via `<AdaptiveGrid>`
  in the root layout. See [[components/common]] and [[decisions-log]] ADR-0008.
- **Vault created** — `obsidian/` Obsidian vault initialised as the project's
  second brain. Architecture, frontend, and workflow docs populated. See [[decisions-log]] ADR-0001.
- **Root README rewritten** — replaced `create-next-app` boilerplate with a real
  project README that points into this vault.
- **`generic-layout-prompt.md` moved** — relocated from repo root to
  `obsidian/workflows/` as [[generic-layout-prompt]].
- **Navigation convention resolved** — standard `next/link` confirmed; the unbuilt
  `<AnimLink>` / `useAnimRouter()` convention dropped. See [[decisions-log]] ADR-0005.
- **Docs consolidated into the vault** — `project-specs.md` deleted (decomposed into
  vault notes + new [[environment-variables]]); `text-engine-docs.md` moved in as
  [[text-engine-reference]]. `AGENTS.md` rewritten as a thin shim; `.cursorrules`
  repointed to `@AGENTS.md`. The vault is now the single source of truth.
  See [[decisions-log]] ADR-0006.
- **Vault renamed & restructured** — vault folder `getlayers.io/` → `obsidian/`;
  number prefixes dropped from section folders (`00-meta` → `meta`, etc.). Project
  name standardised to **`next16-claude-starter`** across docs and `package.json`.
- **Components linked to docs** — every file in `src/components/` now carries a
  `// 📖 Docs:` pointer comment to its catalog note, so agents can jump from code
  to docs and back.
- **Vault workflow automated** — added `.claude/settings.json` with `SessionStart`,
  `UserPromptSubmit`, and `Stop` hooks that make agents read the vault first,
  follow the relevant guide, and update docs after every change — with no manual
  reminder. See [[decisions-log]] ADR-0007 and [[ai-agent-guide]].
- **Cookie component replaced** — the `react-cookie-consent`-based `cookie.tsx`
  was replaced by an in-house `Cookie/` component (banner + category preferences
  modal + Zustand store). `react-cookie-consent` removed from dependencies. The
  component shipped using `styled-components` + an external design system; it was
  ported to the project stack — Tailwind v4 tokens and `@react-spring/web` motion.
  Mounted via `<LazyCookie>`. See [[components/common]].
- **Fixed TextEngine spring type mismatch** — the `mode="once"` heading in
  `views/home.tsx` mixed `lineIn={{ y: 0 }}` (number) with `lineOut={{ y: "100%" }}`
  (string), throwing *"Cannot animate between _AnimatedString and _AnimatedValue"*.
  Changed to `y: "0%"`. The buggy pattern in [[text-engine]] / [[text-engine-reference]]
  examples was corrected and a type-matching gotcha note added.

## Project baseline (git history)

| Commit | Description |
|--------|-------------|
| `94b0870` | feat: update starter |
| `5280ef2` | fix: linter errors & build |
| `b2b84e6` | initial — `next16-claude-starter` scaffold |

> [!note]
> The starter shipped with: Next.js 16.2, React 19.2, Tailwind v4, `@react-spring/web`,
> `spring-text-engine`, Lenis, and Zustand. See [[tech-stack]] for the current state.
