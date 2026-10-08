# Tech stack

The landing app for **Ezymax**, an invite-only CFD trading platform.

## Framework

| | |
|---|---|
| Next.js | 16.3.8, App Router, Turbopack |
| React | 19.2.8 |
| TypeScript | 5, strict |
| Package manager | **yarn 1** (`--frozen-lockfile` in Docker) |
| Output | `standalone` — required by the Dockerfile's runner stage |

## Styling

**Tailwind v4, CSS-first.** There is no `tailwind.config` file: every token,
utility and keyframe lives in `src/app/globals.css` under `@theme`,
`@theme inline` and `@utility`. PostCSS runs `@tailwindcss/postcss` and
nothing else.

Palette is a near-black ground (`bg #060606`) with an ember accent
(`orange-500 #ff6a00`) and glassmorphic panels. Dark only — there is no light
mode and no `dark:` variants.

Four `next/font/google` families, mapped onto `--font-sans` / `--font-display`
/ `--font-pixel` / `--font-mono`: Inter, Manrope, Silkscreen, Space Mono. They
are fetched at **build** time, so the Docker builder stage needs network
access.

## Motion and 3D

| | |
|---|---|
| `motion` v14 | import path is `motion/react`, **not** `framer-motion` |
| `three` 0.186 | + `@react-three/fiber` 9, `@react-three/drei` 10, `@react-three/postprocessing` 3 |

The hero WebGL scene is triple-gated (desktop width, no
`prefers-reduced-motion`, working WebGL context) with a pure-CSS fallback, and
pauses its frameloop off-screen.

## Other direct dependencies

`zustand` (the waitlist store), `zod` (API validation), `lucide-react` (icons),
`clsx` + `tailwind-merge` (via `lib/cn.ts`), `@next/mdx` + `@mdx-js/*`.

## What is NOT here

This app was rebuilt in October 2026 from a different codebase. The previous
stack is gone, and so is its documentation — see ADR-0010 in
[[decisions-log]]. If you have a memory of any of the following, it no longer
applies:

- `@react-spring/web` and the vendored spring engine under
  `src/components/animation/springs/`
- `spring-text-engine` and `TextEngine`
- `lenis` smooth scroll and `ScrollLayout`
- `threejs-components` / `TubesCursor`
- the `src/views/` architecture and the `src/data/mocks/` copy layer
- the adaptive-grid `html { font-size: <vw> }` rem ladder
- the three-tier `--raw-*` → semantic → `@theme` token convention

## Build gotchas

- `tsc --noEmit` fails on a fresh clone: `LayoutProps<"/">` is generated into
  `.next/types` **by `next build`**. Use `yarn build` as the typecheck gate.
- `next start` does not work with `output: "standalone"`. Run
  `node .next/standalone/server.js` after copying `.next/static` and `public`
  in beside it — which is what the Dockerfile's runner stage does.
