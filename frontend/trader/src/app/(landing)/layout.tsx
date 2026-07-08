'use client'

import { useEffect } from 'react'
import { PopupProvider } from '@/landing/components/PopupContext'
import ScrollProgress from '@/landing/components/animations/ScrollProgress'
import Navbar from '@/landing/components/Navbar'
import Footer from '@/landing/components/Footer'
import '@/landing/landing.css'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  /* Landing pages are intentionally a dark marketing surface — independent
   * of the trader-app theme toggle. On unmount we restore whatever the
   * user had picked (read from the persisted ui-store snapshot) instead
   * of always force-resetting to light, which was clobbering dark-mode
   * preferences when users navigated landing → app. */
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.getAttribute('data-theme') || 'dark'
    const prevBg = html.style.backgroundColor
    const prevColor = html.style.color

    html.setAttribute('data-theme', 'dark')
    html.style.backgroundColor = '#08090b'
    html.style.color = '#f5f5f5'

    return () => {
      // Restore the snapshot, not a hardcoded light theme.
      html.setAttribute('data-theme', prevTheme)
      html.style.backgroundColor = prevBg
      html.style.color = prevColor
    }
  }, [])

  return (
    <PopupProvider>
      <ScrollProgress />
      <div className="landing-root min-h-screen bg-[#08090b] text-[#f5f5f5]">
        {/* Shared glossy-gold gradient — referenced by `.feature-icon > svg`
            (stroke: url(#fxIconGold)) so every badge icon across the site reads
            as dimensional gold, matching the How-It-Works 3D icons. */}
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          focusable="false"
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        >
          <defs>
            <linearGradient id="fxIconGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fdeeb0" />
              <stop offset="0.42" stopColor="#ecc657" />
              <stop offset="1" stopColor="#a9781f" />
            </linearGradient>
          </defs>
        </svg>
        <Navbar />
        {children}
        <Footer />
      </div>
    </PopupProvider>
  )
}
