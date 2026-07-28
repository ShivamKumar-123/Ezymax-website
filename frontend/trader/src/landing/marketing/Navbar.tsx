'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Globe, Menu, X, Download, Monitor } from 'lucide-react'
import Button from './ui/Button'
import { slugify } from './ui/slugify'
import { useLang } from '@/landing/i18n/LangProvider'
import { useAuthStore } from '@/stores/authStore'

/**
 * Comprehensive SwissCresta marketing Navbar, ported from the legacy
 * Swistrade Next.js site. The legacy app's `LanguageDrawer` (a
 * full-screen i18n region/language picker) was dropped — the trader
 * app does not ship i18n. The Globe button below is a static label.
 *
 * NOTE: the trader app's `(landing)/layout.tsx` already renders a
 * Navbar for marketing routes. This component is intentionally not
 * mounted there — it lives here so the entire marketing chrome is
 * preserved in code, available if a future page needs the multi-tier
 * sub-nav with the PRIVATE / PARTNERS / INSTITUTIONAL / CAREERS / GROUP
 * hover dropdowns that the legacy site shipped with.
 */

type CardAccent = 'currency' | 'metals' | 'crypto' | 'platform' | 'news' | 'pricing'
type FeaturedAccent = 'orange' | 'image' | 'plain'

export interface DropdownCardItem {
  title: string
  body: string
  accent?: CardAccent
}

export interface FeaturedItem {
  title: string
  body: string
  accent?: FeaturedAccent
}

export interface LinkGroupItem {
  title: string
  items: string[]
  extraTitle?: string
  extraItems?: string[]
}

export interface SubNavLink {
  label: string
  href: string
  active?: boolean
  cards?: DropdownCardItem[]
  featured?: FeaturedItem
  groups?: LinkGroupItem[]
}

type ActivePage = 'private' | 'partners' | 'institutional' | 'careers' | 'group' | 'markets' | 'platforms' | 'white-label' | 'about' | 'contact' | 'policy' | 'liquidity'

export interface NavbarProps {
  activePage?: ActivePage
  showCta?: boolean
  subNavLeft?: SubNavLink[] | null
  subNavRight?: SubNavLink[] | null
}

const NAV_LINKS: { label: string; key: ActivePage; href: string; external?: boolean }[] = [
  { label: 'Platforms', key: 'platforms', href: '/platforms' },
  { label: 'Liquidity', key: 'liquidity', href: 'https://liquidity.swisscresta.com', external: true },
  { label: 'Partners', key: 'partners', href: '/partners' },
  { label: 'Policy', key: 'policy', href: '/policy' },
  { label: 'About', key: 'about', href: '/about' },
  { label: 'Contact', key: 'contact', href: '/contact' },
]

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="SwissCresta home">
      <Image
        src="/marketing/swisscresta-logo.png"
        alt="SwissCresta"
        width={220}
        height={48}
        priority
        className="h-8 lg:h-9 w-auto"
      />
    </Link>
  )
}

interface DropdownCardProps {
  title: string
  body: string
  accent?: CardAccent
}

function DropdownCard({ title, body, accent = 'currency' }: DropdownCardProps) {
  return (
    <a
      href={`/${slugify(title)}`}
      className="group relative block rounded-2xl bg-gray-50 overflow-hidden p-6 h-[220px] hover:shadow-md transition-shadow"
    >
      <span className={`pointer-events-none absolute inset-0 marketing-dropdown-accent-${accent}`} />
      <h3 className="relative z-10 text-xl font-extrabold uppercase tracking-tight text-gray-900 max-w-[60%]">
        {title}
      </h3>
      <p className="absolute z-10 bottom-16 left-6 right-6 text-sm text-gray-900/80 leading-relaxed max-w-[60%]">
        {body}
      </p>
      <span className="absolute bottom-5 right-5 w-9 h-9 rounded-full border border-gray-900/40 flex items-center justify-center text-gray-900 z-10 group-hover:border-[#E94E1B] group-hover:text-[#E94E1B] transition-colors">
        <ChevronRight className="w-4 h-4" strokeWidth={2} />
      </span>
    </a>
  )
}

interface FeaturedHeroProps {
  title: string
  body: string
  accent?: FeaturedAccent
}

function FeaturedHero({ title, body, accent = 'orange' }: FeaturedHeroProps) {
  const href = `#${slugify(title)}`
  if (accent === 'image') {
    return (
      <a
        href={href}
        className="group relative block rounded-2xl overflow-hidden h-full min-h-[420px] bg-[#475a6b] text-white"
      >
        <span className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#E94E1B] z-20" aria-hidden="true" />
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(112,135,150,0.85) 0%, rgba(60,85,100,0.95) 50%, rgba(20,30,40,1) 100%)',
          }}
          aria-hidden="true"
        />
        <h3 className="absolute top-6 left-8 right-6 text-3xl font-extrabold uppercase tracking-tight z-10">
          {title}
        </h3>
        <div
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 via-black/55 to-transparent z-10"
          aria-hidden="true"
        />
        <p className="absolute bottom-6 left-8 right-16 text-sm font-semibold leading-snug z-10">{body}</p>
        <span className="absolute bottom-5 right-5 w-9 h-9 rounded-full border border-white/70 flex items-center justify-center text-white z-10 group-hover:bg-white group-hover:text-[#E94E1B] transition-colors">
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </span>
      </a>
    )
  }
  return (
    <a
      href={href}
      className={`group relative block rounded-2xl overflow-hidden p-6 h-full min-h-[420px] ${
        accent === 'orange' ? 'bg-[#E94E1B] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <h3 className="text-3xl font-extrabold uppercase tracking-tight relative z-10">{title}</h3>
      <div className="absolute inset-0 marketing-featured-illustration" />
      <p className="absolute bottom-6 left-6 right-16 text-sm font-semibold leading-snug z-10">{body}</p>
      <span className="absolute bottom-5 right-5 w-9 h-9 rounded-full border border-white/70 flex items-center justify-center text-white z-10 group-hover:bg-white group-hover:text-[#E94E1B] transition-colors">
        <ChevronRight className="w-4 h-4" strokeWidth={2} />
      </span>
    </a>
  )
}

interface LinkGroupProps {
  title: string
  items: string[]
  extraTitle?: string
  extraItems?: string[]
}

function LinkGroup({ title, items, extraTitle, extraItems }: LinkGroupProps) {
  return (
    <div>
      <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-900/40 mb-4">{title}</h4>
      <ul className="flex flex-col gap-3">
        {items.map((label) => (
          <li key={label}>
            <a
              href={`/${slugify(label)}`}
              className="text-[15px] text-gray-900 hover:text-[#E94E1B] transition-colors"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      {extraTitle && extraItems && extraItems.length > 0 && (
        <>
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-900/40 mt-7 mb-4">
            {extraTitle}
          </h4>
          <ul className="flex flex-col gap-3">
            {extraItems.map((label) => (
              <li key={label}>
                <a
                  href={`/${slugify(label)}`}
                  className="text-[15px] text-gray-900 hover:text-[#E94E1B] transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function DropdownPanel({ item }: { item: SubNavLink | undefined }) {
  if (!item) return null
  const { cards, featured, groups } = item

  if (featured || groups) {
    return (
      <div className="absolute left-0 right-0 top-full bg-white border-t border-gray-200 shadow-lg">
        <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {featured && (
              <div className="md:col-span-4">
                <FeaturedHero title={featured.title} body={featured.body} accent={featured.accent} />
              </div>
            )}
            {groups && (
              <div
                className={`${featured ? 'md:col-span-8' : 'md:col-span-12'} grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8 ${
                  groups.length >= 5
                    ? 'lg:grid-cols-5'
                    : groups.length >= 4
                      ? 'lg:grid-cols-4'
                      : 'lg:grid-cols-3'
                }`}
              >
                {groups.map((g) => (
                  <LinkGroup
                    key={g.title}
                    title={g.title}
                    items={g.items}
                    extraTitle={g.extraTitle}
                    extraItems={g.extraItems}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!cards || !cards.length) return null
  return (
    <div className="absolute left-0 right-0 top-full bg-white border-t border-gray-200 shadow-lg">
      <div className="w-full mx-auto px-6 md:px-10 lg:px-16 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((c) => (
            <DropdownCard key={c.title} title={c.title} body={c.body} accent={c.accent} />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SubNavItemProps {
  link: SubNavLink
  onHover: (label: string) => void
  isActive: boolean
}

function SubNavItem({ link, onHover, isActive }: SubNavItemProps) {
  const showAccent = isActive || link.active
  return (
    <li onMouseEnter={() => onHover(link.label)} className="relative">
      <a
        href={link.href}
        className={`block py-3 text-sm font-bold transition-colors ${
          showAccent ? 'text-[#E94E1B]' : 'text-gray-900 hover:text-[#E94E1B]'
        }`}
      >
        {link.label}
      </a>
    </li>
  )
}

export default function MarketingNavbar({
  activePage = 'private',
  showCta = true,
  subNavLeft = null,
  subNavRight = null,
}: NavbarProps) {
  const [open, setOpen] = useState(false)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)
  const { lang, toggleLang, t } = useLang()

  // Marketing pages don't live inside an auth provider, so the store
  // starts unauthenticated even when the cookie is present. Kick off
  // loadUser() once on mount so /auth/me decides the navbar's CTA.
  // `mounted` guards against the hydration-time flash of Login/Signup
  // for users who are actually logged in.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const loadUser = useAuthStore((s) => s.loadUser)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    if (!isInitialized) void loadUser()
  }, [isInitialized, loadUser])
  const showAppLink = mounted && isAuthenticated

  const labelFor = (key: ActivePage, fallback: string) =>
    t(`nav.${key}`) === `nav.${key}` ? fallback : t(`nav.${key}`)
  const ctaLabel = activePage === 'partners' ? t('nav.partners') : t('nav.signup')
  const hasSubNav = Boolean(
    (subNavLeft && subNavLeft.length) || (subNavRight && subNavRight.length),
  )

  const allSubNav: SubNavLink[] = [...(subNavLeft ?? []), ...(subNavRight ?? [])]
  const hoveredItem = allSubNav.find((l) => l.label === hoveredLabel)
  const hasDropdown = Boolean(
    hoveredItem && (hoveredItem.cards || hoveredItem.featured || hoveredItem.groups),
  )

  return (
    <header className="sticky top-3 md:top-4 z-50 mx-3 md:mx-4 lg:mx-5 rounded-2xl bg-white/55 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] supports-[backdrop-filter]:bg-white/45">
      <nav className="w-full mx-auto px-3 md:px-4 lg:px-5 relative flex items-center gap-3 h-16 md:h-[68px]">
        <div className="shrink-0">
          <Wordmark />
        </div>

        <ul className="hidden lg:flex flex-1 items-center justify-center gap-3 xl:gap-5 2xl:gap-6">
          {NAV_LINKS.map((link) => {
            const active = link.key === activePage
            const cls = `whitespace-nowrap text-[13px] 2xl:text-[14px] font-semibold tracking-tight transition-colors hover:text-[#E94E1B] ${
              active ? 'text-[#E94E1B]' : 'text-gray-900'
            }`
            return (
              <li key={link.key}>
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {labelFor(link.key, link.label)}
                  </a>
                ) : (
                  <Link href={link.href} className={cls}>
                    {labelFor(link.key, link.label)}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>

        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 ml-auto shrink-0">
          {/* Direct Android APK download. Plain <a download> so the browser
              fetches the file straight away; on Android the OS then shows the
              install prompt (user may need "install from unknown sources"). */}
          <a
            href="/downloads/SwissCresta.apk"
            download="SwissCresta.apk"
            className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-full border border-[#E94E1B] text-[13px] font-semibold text-[#E94E1B] hover:bg-[#E94E1B] hover:text-white transition-colors"
          >
            <Download className="w-4 h-4 shrink-0" strokeWidth={2} />
            Download APK
          </a>
          {/* Direct Windows desktop-terminal installer. Same <a download>
              pattern as the APK — the browser saves the .exe; the user then
              runs it (SmartScreen "More info → Run anyway" for the unsigned
              build) through the next-next Inno Setup wizard. */}
          <a
            href="/downloads/SwissCrestaTerminal-Setup-1.0.0.exe"
            download="SwissCrestaTerminal-Setup.exe"
            className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-full border border-[#E94E1B] text-[13px] font-semibold text-[#E94E1B] hover:bg-[#E94E1B] hover:text-white transition-colors"
          >
            <Monitor className="w-4 h-4 shrink-0" strokeWidth={2} />
            Windows Terminal
          </a>
          {showCta && (showAppLink ? (
            <Button
              variant="primary"
              href="/dashboard"
              className="px-5 py-2 rounded-full"
            >
              Open App
            </Button>
          ) : (
            <>
              <Link
                href="/auth/portal"
                className="inline-flex items-center justify-center whitespace-nowrap px-3.5 py-2 rounded-full border border-gray-900 text-[13px] font-semibold text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
              >
                {t('nav.login')}
              </Link>
              <Button
                variant="primary"
                href="/auth/register"
                className="whitespace-nowrap px-3.5 py-2 text-[13px] rounded-full"
              >
                {ctaLabel}
              </Button>
            </>
          ))}
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1 text-[13px] text-gray-900 px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={`Switch language to ${lang === 'fr' ? 'English' : 'Français'}`}
            title={`Switch language to ${lang === 'fr' ? 'English' : 'Français'}`}
          >
            <Globe className="w-4 h-4 text-[#E94E1B]" strokeWidth={2} />
            <span className="font-semibold uppercase">{lang === 'fr' ? 'FR' : 'EN'}</span>
          </button>
        </div>

        <button
          type="button"
          className="lg:hidden ml-auto p-2 -mr-2 text-gray-900"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {hasSubNav && (
        <div
          className="hidden lg:block border-t border-black/5 relative"
          onMouseLeave={() => setHoveredLabel(null)}
        >
          <div className="w-full mx-auto px-5 md:px-8 lg:px-10 flex items-center justify-between h-11">
            <ul className="flex items-center gap-8">
              {(subNavLeft ?? []).map((link) => (
                <SubNavItem
                  key={link.label}
                  link={link}
                  onHover={setHoveredLabel}
                  isActive={hoveredLabel === link.label}
                />
              ))}
            </ul>
            <ul className="flex items-center gap-8">
              {(subNavRight ?? []).map((link) => (
                <SubNavItem
                  key={link.label}
                  link={link}
                  onHover={setHoveredLabel}
                  isActive={hoveredLabel === link.label}
                />
              ))}
            </ul>
          </div>

          {hasDropdown && <DropdownPanel item={hoveredItem} />}
        </div>
      )}

      {open && (
        <div className="lg:hidden border-t border-black/5 rounded-b-2xl bg-white/80 backdrop-blur-2xl backdrop-saturate-150">
          <ul className="w-full mx-auto px-6 md:px-10 lg:px-16 py-4 flex flex-col gap-3">
            {NAV_LINKS.map((link) => {
              const active = link.key === activePage
              const cls = `block text-sm font-semibold py-1 ${
                active ? 'text-[#E94E1B]' : 'text-gray-900/80'
              }`
              return (
                <li key={link.key}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cls}
                      onClick={() => setOpen(false)}
                    >
                      {labelFor(link.key, link.label)}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className={cls}
                      onClick={() => setOpen(false)}
                    >
                      {labelFor(link.key, link.label)}
                    </Link>
                  )}
                </li>
              )
            })}
            {hasSubNav && (
              <li className="pt-3 mt-1 border-t border-gray-200">
                <ul className="flex flex-col gap-2">
                  {allSubNav.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="block text-sm text-gray-900/80 py-1"
                        onClick={() => setOpen(false)}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            <li className="pt-3 border-t border-gray-200">
              <a
                href="/downloads/SwissCresta.apk"
                download="SwissCresta.apk"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 px-5 py-2.5 rounded-full border border-[#E94E1B] text-[#E94E1B] text-sm font-semibold hover:bg-[#E94E1B] hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" strokeWidth={2} />
                Download APK
              </a>
            </li>
            <li>
              <a
                href="/downloads/SwissCrestaTerminal-Setup-1.0.0.exe"
                download="SwissCrestaTerminal-Setup.exe"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 px-5 py-2.5 rounded-full border border-[#E94E1B] text-[#E94E1B] text-sm font-semibold hover:bg-[#E94E1B] hover:text-white transition-colors"
              >
                <Monitor className="w-4 h-4" strokeWidth={2} />
                Windows Terminal
              </a>
            </li>
            {showCta && (
              <li className="flex items-center gap-3 pt-3 border-t border-gray-200">
                {showAppLink ? (
                  <Button
                    variant="primary"
                    href="/dashboard"
                    className="px-5 py-2 rounded-full"
                  >
                    Open App
                  </Button>
                ) : (
                  <>
                    <Link
                      href="/auth/portal"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center justify-center px-5 py-2 rounded-full border border-gray-900 text-gray-900 text-sm font-semibold"
                    >
                      {t('nav.login')}
                    </Link>
                    <Button
                      variant="primary"
                      href="/auth/register"
                      className="px-5 py-2 rounded-full"
                    >
                      {ctaLabel}
                    </Button>
                  </>
                )}
              </li>
            )}
          </ul>
        </div>
      )}

      <style>{`
        .marketing-dropdown-accent-currency {
          background:
            radial-gradient(circle at 78% 60%, rgba(233,78,27,0.18) 0, transparent 35%),
            radial-gradient(circle at 88% 30%, rgba(30,80,200,0.18) 0, transparent 30%),
            radial-gradient(circle at 70% 80%, rgba(199,62,17,0.18) 0, transparent 30%);
        }
        .marketing-dropdown-accent-metals {
          background:
            radial-gradient(circle at 80% 55%, rgba(212,175,55,0.35) 0, transparent 38%),
            radial-gradient(circle at 90% 80%, rgba(180,180,180,0.45) 0, transparent 32%);
        }
        .marketing-dropdown-accent-crypto {
          background:
            radial-gradient(circle at 75% 45%, rgba(233,78,27,0.30) 0, transparent 32%),
            radial-gradient(circle at 90% 75%, rgba(212,175,55,0.30) 0, transparent 30%),
            radial-gradient(circle at 70% 75%, rgba(30,80,200,0.18) 0, transparent 28%);
        }
        .marketing-dropdown-accent-platform {
          background:
            radial-gradient(circle at 85% 60%, rgba(30,80,200,0.22) 0, transparent 38%),
            radial-gradient(circle at 75% 30%, rgba(80,80,80,0.18) 0, transparent 30%);
        }
        .marketing-dropdown-accent-news {
          background:
            radial-gradient(circle at 80% 55%, rgba(233,78,27,0.22) 0, transparent 36%);
        }
        .marketing-dropdown-accent-pricing {
          background:
            radial-gradient(circle at 80% 60%, rgba(0,150,80,0.22) 0, transparent 36%);
        }
        .marketing-featured-illustration {
          background:
            radial-gradient(circle at 60% 55%, rgba(255,255,255,0.45) 0, rgba(255,255,255,0) 28%),
            radial-gradient(circle at 30% 40%, rgba(255,255,255,0.18) 0, transparent 32%),
            radial-gradient(circle at 75% 70%, rgba(0,0,0,0.10) 0, transparent 30%);
          pointer-events: none;
        }
      `}</style>
    </header>
  )
}
