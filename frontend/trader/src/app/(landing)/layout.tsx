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
        <Navbar />
        {children}
        <Footer />
      </div>
    </PopupProvider>
  )
}
