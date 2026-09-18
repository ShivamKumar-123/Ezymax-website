'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { PopupProvider } from '@/landing/components/PopupContext'
import ScrollProgress from '@/landing/components/animations/ScrollProgress'
import Footer from '@/landing/components/Footer'
import { Navbar as HomeNavbar } from '@/home/components/Navbar'
import { ScrollToTopButton } from '@/home/components/ScrollToTopButton'
import '@/marketing/tokens.css'
import '@/home/styles.css'
import '@/landing/landing.css'

/**
 * Landing layout — wraps every page under (landing). The home page (/)
 * brings its own self-contained chrome (see src/home/HomePage), so we
 * skip the legacy Navbar/Footer + scrub the body padding on that exact
 * path. All inner pages (about, contact, how-it-works, etc.) keep the
 * existing landing chrome unchanged.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome = pathname === '/'

  /* Override trader-app theme for landing pages.
     The marketing site is light-only after the 2026-09-01 redesign — it
     no longer flips the document to dark on entry. We still pin the
     attribute (rather than inheriting) so a visitor who left the trader
     app in dark mode doesn't land on a half-dark marketing page, and we
     restore whatever the app had on the way out. */
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.getAttribute('data-theme')
    const prevBg = html.style.backgroundColor
    const prevColor = html.style.color

    html.setAttribute('data-theme', 'light')
    html.style.backgroundColor = '#ffffff'
    html.style.color = '#0b0b0c'

    return () => {
      if (prevTheme) html.setAttribute('data-theme', prevTheme)
      html.style.backgroundColor = prevBg
      html.style.color = prevColor
    }
  }, [])

  if (isHome) {
    // Bare wrapper — HomePage renders its own Navbar + CtaFooter.
    return (
      <PopupProvider>
        <ScrollProgress />
        <div className="mk">{children}</div>
        <ScrollToTopButton />
      </PopupProvider>
    )
  }

  return (
    <PopupProvider>
      <ScrollProgress />
      <div className="mk brand-home landing-root min-h-screen">
        <HomeNavbar />
        {children}
        <Footer />
      </div>
      <ScrollToTopButton />
    </PopupProvider>
  )
}
