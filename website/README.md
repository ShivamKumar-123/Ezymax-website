# EZYMEX website

The public EZYMEX website: landing pages, platforms, markets, education and company pages. It is a Next.js app in `apps/trader` and runs on **port 3010**.

The website has no accounts of its own. Every **Log in**, **Sign up** and **Open account** button takes the visitor to the Ezymex Client Area:

| Website link | Goes to |
|---|---|
| Log in (`/auth/login`) | `http://localhost:3000/login` |
| Sign up / Open account (`/auth/register`, keeps `?ref=CODE`) | `http://localhost:3000/register` |
| Reset password (`/auth/reset-password`) | `http://localhost:3000/forgot` |
| Signed-in pages (`/dashboard`, `/wallet`, …) | `http://localhost:3000/login` |

The Client Area address comes from `NEXT_PUBLIC_CRM_URL` (default `http://localhost:3000`); set it to the live Client Area domain in production. The links are defined in `apps/trader/src/lib/crm.ts`, and the forwarding is in `apps/trader/next.config.mjs` (redirects) and `apps/trader/src/middleware.ts`.

## Getting started

```bash
npm run install:all      # first time only
npm run dev              # website on http://localhost:3010
```

Other scripts: `build`, `start`, `lint`.

## Environment

Copy the block in [.env.example](.env.example) to `apps/trader/.env.local`. This file is git-ignored, so a fresh clone has none. Without it, `next dev` falls back to the white-label defaults in `src/lib/brand.ts` and shows the name "Bullza".

## Content

`apps/trader/README-CONTENT-PLACEHOLDERS.md` lists where to drop images and banners. The About page still needs its four images (`about banner.png`, `about_card1.png`, `about_card2.png`, `about_card3.png`).
