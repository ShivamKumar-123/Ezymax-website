'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { PopupProvider } from '@/landing/components/PopupContext'
import ScrollProgress from '@/landing/components/animations/ScrollProgress'
import MarketingNavbar from '@/landing/marketing/Navbar'
import Footer from '@/landing/components/Footer'
import LandingFooter from '@/components/landing/LandingFooter'
import { LangProvider } from '@/landing/i18n/LangProvider'

type NavKey = 'private' | 'partners' | 'institutional' | 'careers' | 'group' | 'markets' | 'platforms' | 'white-label' | 'about' | 'contact' | 'policy'

const ACTIVE_PAGE_BY_PATH: Record<string, NavKey> = {
  '/markets': 'markets',
  '/precious-metals': 'markets',
  '/currency-pairs': 'markets',
  '/cfds': 'markets',
  '/platforms': 'platforms',
  '/about': 'about',
  '/contact': 'contact',
  '/partners': 'partners',
  '/introducing-brokers': 'partners',
  '/money-managers': 'partners',
  '/collaboration': 'partners',
  '/institutional': 'institutional',
  '/careers': 'careers',
  '/group': 'group',
  '/policy': 'policy',
  '/privacy': 'policy',
  '/terms': 'policy',
  '/risk': 'policy',
}

// Home-page sub-nav dropdowns (the comprehensive Vantage-style sub-nav
// tier under the top "PRIVATE / PARTNERS / …" tabs). Ported from the
// legacy Swistrade home page; English strings inlined since we don't
// ship i18n. Only mounted when the current path is exactly '/'.
const HOME_SUBNAV_LEFT = [
  {
    label: 'Trade',
    href: '/',
    cards: [
      { title: 'CURRENCY PAIRS', body: 'Trade over 80 currency crosses with transparent pricing and deep liquidity.', accent: 'currency' as const },
      { title: 'PRECIOUS METALS', body: 'Trade gold, silver, palladium, and more with competitive all-in spreads.', accent: 'metals' as const },
      { title: 'CFDS', body: 'Diversify and hedge your exposure with spot, forward, and synthetic contracts.', accent: 'crypto' as const },
    ],
  },
  {
    label: 'Inspire',
    href: '/',
    featured: { title: 'INSPIRE', body: 'In finance, patience pays and knowledge wins. Stay sharp, stay ahead.', accent: 'orange' as const },
    groups: [
      { title: 'EXPERT INSIGHTS', items: ['Morning News', 'Youtube', 'Podcasts', 'eBooks', 'TradingView'] },
      { title: 'WEBINARS & EVENTS', items: ['Webinars'] },
    ],
  },
]

const HOME_SUBNAV_RIGHT = [
  {
    label: 'Pricing',
    href: '/',
    featured: { title: 'PRICING', body: 'Fair pricing for unlimited finances. Discover what you pay, before you trade.', accent: 'orange' as const },
    groups: [
      { title: 'TRADING PRICING', items: ['Account types', 'Trading conditions', 'Execution'] },
    ],
  },
  {
    label: 'Platforms',
    href: '/',
    featured: { title: 'FOREX & CFDS', body: "Platforms that put the world's largest market at your fingertips.", accent: 'orange' as const },
    groups: [
      { title: 'PLATFORMS', items: ['CFXD', 'MetaTrader 4', 'MetaTrader 5'] },
      { title: 'SOLUTIONS', items: ['FIX API', 'TradingView'] },
    ],
  },
  {
    label: 'Help',
    href: '/',
    cards: [
      { title: 'HELP CENTER', body: 'Questions? Solutions. Find fast answers and expert support.', accent: 'news' as const },
      { title: 'SWISSCRESTA INFO', body: 'Real-time updates on platform status, maintenance, and alerts.', accent: 'pricing' as const },
      { title: 'CUSTOMER CARE', body: 'We’re just a call, an email, or a chat away. Get support — your way, anytime.', accent: 'platform' as const },
    ],
  },
]
import '@/landing/landing.css'

// Marketing design system — tokens scoped under `[data-mkt]`. The
// wrapper below carries the attribute, so any descendant component
// that uses `bg-mkt-canvas` / `text-mkt-ink-primary` / etc. resolves
// to the new palette. The existing landing.css tokens are still loaded
// above; both coexist until STEP 3 replaces the chrome and STEP 4
// rebuilds the home sections.
import '@/styles/marketing.css'

// Textura landing theme — monochrome token set ported from
// next16-claude-starter, scoped under `[data-textura]` (set on the
// wrapper below). Light marketing pages style with `tx-*` utilities
// bound in tailwind.config.ts.
import '@/styles/textura.css'

/* Marketing pages rendered on the light SwissCresta canvas (#FFFFFF).
 * The shared Navbar reads `theme="light"` for these and `theme="dark"`
 * for everything else; LandingFooter swaps in for the legacy dark
 * Footer on these paths. Match is exact — `/platforms` is the light
 * index, but `/platforms/web` stays on the dark chrome because that
 * sub-page hero is still dark-themed. */
const LIGHT_MARKETING_PATHS = new Set<string>([
  '/',
  '/about',
  '/contact',
  '/how-it-works',
  '/platforms',
  '/privacy',
  '/risk',
  '/terms',
  '/white-label',
  // Swistrade-port marketing pages
  '/careers',
  '/collaboration',
  '/group',
  '/institutional',
  '/introducing-brokers',
  '/money-managers',
  '/partners',
  // home/page marketing rebuild pages
  '/policy',
  '/markets',
  '/cfds',
  '/currency-pairs',
  '/precious-metals',
  '/demo-account',
])

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname()
  /* Strip trailing slash so '/contact/' still matches '/contact', and
   * keep '/' as-is. Falls back to '' (never matches) when usePathname
   * is null during the very first client render. */
  const pathname =
    rawPathname === '/' || rawPathname == null
      ? rawPathname || ''
      : rawPathname.replace(/\/+$/, '')
  const isLight = LIGHT_MARKETING_PATHS.has(pathname)

  /* Force the html background to match the page surface so overscroll
   * doesn't reveal a stale dark/light stripe. Without this, dark home
   * looks fine, but the new light marketing pages get black bleed
   * because the html was previously pinned to #08090b. */
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.getAttribute('data-theme') || 'dark'
    const prevBg = html.style.backgroundColor
    const prevColor = html.style.color

    if (isLight) {
      html.setAttribute('data-theme', 'light')
      html.style.backgroundColor = '#ffffff'
      html.style.color = '#171717'
    } else {
      html.setAttribute('data-theme', 'dark')
      html.style.backgroundColor = '#08090b'
      html.style.color = '#f5f5f5'
    }

    return () => {
      html.setAttribute('data-theme', prevTheme)
      html.style.backgroundColor = prevBg
      html.style.color = prevColor
    }
  }, [isLight])

  // English is the business language for a B2B platform vendor; the French
  // default was a leftover from the template this site was ported from.
  return (
    <LangProvider defaultLang="en">
    <PopupProvider>
      <ScrollProgress />
      {/* Wrapper attributes per mode:
          - `data-mkt`        : dark pages only. Activates marketing.css
                                scope (`[data-mkt]` token bindings). Light
                                pages style with plain Tailwind, so the
                                scope's base bg/font rules are unnecessary.
          - `landing-root`    : dark pages only. Defined in landing.css and
                                pins bg to `var(--fx-bg)` (deep navy), which
                                would override `bg-white` if applied to a
                                light page.
          - `data-page-mode`  : present in both modes for DevTools / CSS
                                hooks that need to react to the current
                                theme without re-checking the URL. */}
      <div
        {...(isLight ? {} : { 'data-mkt': 'true' })}
        data-textura="true"
        data-page-mode={isLight ? 'light' : 'dark'}
        className={
          isLight
            ? 'min-h-screen bg-tx-bg text-tx-ink font-onest'
            : 'landing-root min-h-screen bg-[#08090b] text-[#f5f5f5] font-onest'
        }
      >
        <MarketingNavbar
          activePage={ACTIVE_PAGE_BY_PATH[pathname] ?? 'private'}
          subNavLeft={null}
          subNavRight={null}
        />
        {children}
        {isLight ? <LandingFooter /> : <Footer />}
      </div>
    </PopupProvider>
    </LangProvider>
  )
}
