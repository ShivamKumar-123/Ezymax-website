# Folder structure

```
src/
  app/                      routes (App Router)
    page.tsx                home — composes sections/home/*
    layout.tsx              the one layout: fonts, JSON-LD, Preloader,
                            Header, Footer, WaitlistModal
    globals.css             ALL design tokens, utilities and keyframes
    markets/                /markets + /markets/[slug]   (4 asset classes)
    platform/               /platform + /platform/[slug] (9 capabilities)
    protection/             Shield plans + risk tools
    earn/                   staking, XP ladder
    (company)/              about, partners, faq, contact
    legal/[slug]/           privacy-policy, terms-of-service, risk-disclosure
    api/waitlist/           the invite gate — proxies to the backend gateway
    api/contact/            every form on the site, keyed by `type`
    opengraph-image.tsx     share card, rendered with next/og
    robots.ts  sitemap.ts   both derive from content/routes.ts

  components/
    layout/                 Header, Footer, Preloader, SectionShell
    sections/home/          the home page's sections, in page order
    sections/shared/        reusable bands (PageHero, CTABand, FeatureList,
                            PlanTable, Timeline, TextBlock, BulletList…)
    templates/              MarketTemplate, PlatformTemplate, LegalTemplate
    three/                  HeroScene (gate), HeroCanvas (R3F), HeroFallback
    forms/                  WaitlistModal + the lead forms
    ui/                     primitives — Button, Modal, Field, Reveal, Logo…

  content/                  ALL copy. See below.
  lib/                      cn, icons, seo, webgl, lead-schema, api-client,
                            api envelope, waitlist-store
  utils/seo/                root metadata + JSON-LD
  env.ts                    server/public env access
```

## The content layer

Nothing in `components/` holds marketing copy. Pages read from `src/content/`
and pass it down.

| File | Holds |
|---|---|
| `site.ts` | brand, domain, tagline, disclaimer, `tradeConfig` |
| `facts.ts` | **every number the site may state about itself**, each with a `source:` comment |
| `home.ts` | the home page, section by section |
| `markets.ts` | the four asset classes → `/markets/[slug]` |
| `platform.ts` | the nine capabilities → `/platform/[slug]` |
| `protection.ts`, `earn.ts`, `about.ts`, `faq.ts`, `partners.ts`, `contact.ts` | one page each |
| `legal.ts` | the three real legal documents, as block unions |
| `nav.ts` | header, footer and legal navigation — derived from the arrays above |
| `routes.ts` | every public path; `sitemap.ts` reads this |
| `images.ts` | photography, **keyed by slug** |
| `schema.ts` | the shared types |

Two coupling hazards worth knowing:

1. `nav.ts`, `routes.ts` and `sitemap.ts` all *derive* from the content arrays,
   and the `[slug]` routes set `dynamicParams = false`. A slug renamed in one
   place and not another is a hard 404.
2. `images.ts` lookups **fall back silently** to one default image. Rename a
   slug without re-keying it here and every card shows the same photo, with no
   build error.
