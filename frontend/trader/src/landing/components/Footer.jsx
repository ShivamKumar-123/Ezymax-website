import Link from 'next/link'
import { Facebook, Instagram, Linkedin, Youtube, Mail, Cookie } from 'lucide-react'
import ScrollReveal from './animations/ScrollReveal'
import { openCookieSettings } from '@/home/components/CookieConsent'
import { BRAND_NAME, BRAND_DOMAIN, BRAND_LOGO_LIGHT, BRAND_SUPPORT_EMAIL, BRAND_COPYRIGHT } from '@/lib/brand'

const columns = {
  Markets: [
    { name: 'Forex',       path: '/trading/forex' },
    { name: 'Indices',     path: '/trading/indices' },
    { name: 'Commodities', path: '/trading/commodities' },
    { name: 'Crypto',      path: '/trading/crypto' },
  ],
  Trading: [
    { name: 'Account Types',     path: '/account-types' },
    { name: 'Standard Account',  path: '/accounts/standard' },
    { name: 'Pro Account',       path: '/accounts/pro' },
    { name: 'Demo Account',      path: '/accounts/demo' },
  ],
  Platforms: [
    { name: 'Web Platform',  path: '/platforms/web' },
    { name: 'Copy Trading',  path: '/platforms/copy-trading' },
    { name: 'Download',      path: '/download' },
  ],
  Partners: [
    { name: 'IB Programme',    path: '/products/ib-referral' },
    { name: 'Referral',        path: '/products/referral' },
    { name: 'Trade Insurance', path: '/products/insurance' },
  ],
  Resources: [
    { name: 'Market Research', path: '/services/market-research' },
    { name: 'Education',       path: '/services/education' },
    { name: 'Guides',          path: '/academy/pdfs' },
    { name: 'Blog',            path: '/academy/blogs' },
  ],
  Company: [
    { name: 'About Us',  path: '/company/about' },
    { name: 'Contact',   path: '/company/contact' },
    { name: 'Careers',   path: '/careers' },
    { name: 'FAQ',       path: '/faq' },
  ],
}

const socials = [
  { icon: Facebook,  href: `https://${BRAND_DOMAIN}`, label: 'Facebook' },
  { icon: Instagram, href: `https://${BRAND_DOMAIN}`, label: 'Instagram' },
  { icon: Linkedin,  href: `https://${BRAND_DOMAIN}`, label: 'LinkedIn' },
  { icon: Youtube,   href: `https://${BRAND_DOMAIN}`, label: 'YouTube' },
]

export default function Footer() {
  return (
    /* 2026-09-01 redesign — solid black band, matching the homepage footer
       and the reference. Previously a white→near-black vertical gradient,
       which after the light retheme faded the ink copy straight into the
       black half and left the lower half of the footer unreadable.

       Rather than recolouring every descendant, the --fx-* text/surface
       tokens are re-pointed to their inverted values for this subtree, so
       every child that reads them (and there are many) follows. */
    <footer
      className="relative"
      style={{
        background: '#000000',
        borderTop: '1px solid var(--fx-line)',
        '--fx-text': '#ffffff',
        '--fx-text-2': 'rgba(255, 255, 255, 0.66)',
        '--fx-text-3': 'rgba(255, 255, 255, 0.48)',
        '--fx-line': 'rgba(255, 255, 255, 0.12)',
        '--fx-line-strong': 'rgba(255, 255, 255, 0.22)',
        '--fx-bg-elev': 'rgba(255, 255, 255, 0.05)',
        '--fx-bg-elev-2': 'rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
      }}
    >
      <div className="fx-divider-gold" />

      <div className="fx-container py-14 md:py-20">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand block — spans more on mobile */}
          <div className="col-span-2 lg:col-span-2">
            <ScrollReveal variant="fadeLeft">
              <Link href="/" className="inline-block mb-5" aria-label={`${BRAND_NAME} home`}>
                {BRAND_LOGO_LIGHT ? (
                  <img src={BRAND_LOGO_LIGHT} alt={BRAND_NAME} className="h-10 w-auto" />
                ) : (
                  <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--fx-text)' }}>{BRAND_NAME}</span>
                )}
              </Link>
              <p className="text-sm leading-relaxed max-w-sm mb-6" style={{ color: 'var(--fx-text-2)' }}>
                {BRAND_NAME} is a forex and CFD trading platform built for serious traders —
                offering fast execution, competitive spreads and transparent pricing across
                major, minor and exotic currency pairs.
              </p>
              <p className="text-sm leading-relaxed max-w-sm mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Trade from the web, mobile or desktop browser on a single account, with an
                Introducing Broker programme available for partners and affiliates.
              </p>

              <div className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--fx-text-3)' }}>
                <Mail size={14} style={{ color: 'var(--fx-gold-light)' }} />
                <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="hover:underline" style={{ color: 'var(--fx-text-2)' }}>
                  {BRAND_SUPPORT_EMAIL}
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                {socials.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--fx-line-strong)',
                      color: 'var(--fx-text-2)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--fx-gold-light)'
                      e.currentTarget.style.borderColor = 'rgba(232, 93, 61,0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--fx-text-2)'
                      e.currentTarget.style.borderColor = 'var(--fx-line-strong)'
                    }}
                  >
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            </ScrollReveal>
          </div>

          {/* Link columns */}
          {Object.entries(columns).map(([heading, links], i) => (
            <ScrollReveal key={heading} variant="fadeUp" delay={0.05 + i * 0.05}>
              <h3
                className="text-xs uppercase tracking-[0.16em] font-semibold mb-4"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                {heading}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.path}>
                    <Link
                      href={link.path}
                      className="text-sm transition-colors"
                      style={{ color: 'var(--fx-text-2)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fx-text)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fx-text-2)' }}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>

        {/* Risk warning + Restricted regions */}
        <div
          className="mt-12 md:mt-16 p-6 md:p-8 rounded-2xl space-y-7"
          style={{
            background: 'var(--fx-bg-elev)',
            border: '1px solid var(--fx-line)',
          }}
        >
          <div>
            <h3
              className="text-lg md:text-xl font-semibold mb-3"
              style={{ color: 'var(--fx-text)' }}
            >
              Risk Warning
            </h3>
            <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-3)' }}>
              Please note that forex trading and trading in other leveraged products involves a
              significant level of risk and is not suitable for all investors. Trading in financial
              instruments may result in losses as well as profits and your losses can be greater than
              your initial invested capital. Before undertaking any such transactions, you should
              ensure that you fully understand the risks involved and seek independent advice if
              necessary. {BRAND_NAME} does not provide investment advice.
            </p>
          </div>

          <div>
            <h3
              className="text-lg md:text-xl font-semibold mb-3"
              style={{ color: 'var(--fx-text)' }}
            >
              Restricted Regions
            </h3>
            <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-3)' }}>
              {BRAND_NAME} does not provide services for citizens/residents of the USA, Cuba, Iraq,
              Myanmar, North Korea, and Sudan. The services of {BRAND_NAME} are not intended for
              distribution to, or use by, any person in any country or jurisdiction where such
              distribution or use would be contrary to local law or regulation.
            </p>
          </div>
        </div>

        {/* Legal / Policy quick-links — each opens the official signed
            PDF in a new tab. Drop replacement files at /public/pdfs/terms/
            with the exact filenames used below. */}
        <nav
          aria-label="Legal documents"
          className="mt-10 pt-6 flex flex-wrap gap-x-7 gap-y-3"
          style={{ borderTop: '1px solid var(--fx-line)' }}
        >
          {[
            { name: 'Privacy Policy',              href: '/privacy' },
            { name: 'Terms & Conditions',          href: '/terms' },
            { name: 'Deposit & withdrawal Policy', href: '/deposit-withdrawal' },
            { name: 'Restricted Countries',        href: '/restricted-countries' },
            { name: 'Risk Warning',                href: '/risk-warning' },
            { name: 'Risk Disclosure',             href: '/risk' },
          ].map((doc) => (
            <a
              key={doc.name}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:underline transition-colors"
              style={{ color: 'var(--fx-text)' }}
            >
              {doc.name}
            </a>
          ))}
        </nav>

        {/* Bottom bar */}
        <div
          className="mt-6 pt-6 flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-center justify-between"
          style={{ borderTop: '1px solid var(--fx-line)' }}
        >
          <p className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
            {BRAND_COPYRIGHT} · Founded in 2010
          </p>
          {/* Cookie Settings — surfaces the consent modal even after
              the user has already accepted/saved a preference, so the
              choice stays revisable per GDPR. */}
          <button
            type="button"
            onClick={openCookieSettings}
            className="inline-flex items-center gap-1.5 text-xs hover:underline transition-colors"
            style={{ color: 'var(--fx-text-2)' }}
            aria-label="Open cookie settings"
          >
            <Cookie size={13} /> Cookie Settings
          </button>
        </div>
      </div>
    </footer>
  )
}
