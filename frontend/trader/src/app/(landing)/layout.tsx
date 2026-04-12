'use client'

import { useEffect } from 'react'
import { PopupProvider } from '@/landing/components/PopupContext'
import ScrollProgress from '@/landing/components/animations/ScrollProgress'
import Navbar from '@/landing/components/Navbar'
import Footer from '@/landing/components/Footer'
import '@/landing/landing.css'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  /* Override trader-app theme for landing pages */
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme', 'dark')
    html.style.backgroundColor = '#0A0E1A'
    html.style.color = '#ffffff'
    return () => {
      html.setAttribute('data-theme', 'light')
      html.style.backgroundColor = '#F2EFE9'
      html.style.color = '#000000'
    }
  }, [])

  return (
    <PopupProvider>
      <ScrollProgress />
      <div className="landing-root min-h-screen bg-[#0A0E1A] text-white">
        <Navbar />
        {children}
        <Footer />
      </div>
    </PopupProvider>
  )
}
