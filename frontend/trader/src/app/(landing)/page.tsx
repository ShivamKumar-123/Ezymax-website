/**
 * SetupFX marketing home. Keep the file as a thin composer —
 * each section lives in `@/landing/marketing/*` and is independently
 * editable.
 *
 * The parent `(landing)/layout.tsx` already mounts the shared Navbar +
 * LandingFooter for light marketing routes. We deliberately do NOT
 * mount `marketing/Navbar.tsx` here — that component is ported for
 * future use (multi-tier sub-nav with PRIVATE/PARTNERS/INSTITUTIONAL/
 * CAREERS/GROUP hover dropdowns) but mounting it here would double up
 * the chrome.
 */

import Hero from '@/landing/marketing/Hero'
import DifferentBank from '@/landing/marketing/DifferentBank'
import Platforms from '@/landing/marketing/Platforms'
import Pricing from '@/landing/marketing/Pricing'
import Securities from '@/landing/marketing/Securities'
import Crypto from '@/landing/marketing/Crypto'
import Steps from '@/landing/marketing/Steps'
import AboutUs from '@/landing/marketing/AboutUs'
import FollowUs from '@/landing/marketing/FollowUs'
import FooterLinks from '@/landing/marketing/FooterLinks'
import CapabilityNote from '@/landing/marketing/CapabilityNote'
import Disclaimer from '@/landing/marketing/Disclaimer'

export default function LandingHomePage() {
  return (
    <div className="min-h-screen bg-tx-bg text-tx-ink">
      <main>
        <Hero />
        <DifferentBank />
        <CapabilityNote />
        <Platforms />
        <Pricing />
        <Securities />
        <Crypto />
        <CapabilityNote />
        <Steps />
        <AboutUs />
        <FollowUs />
        <FooterLinks />
      </main>
      <Disclaimer />
    </div>
  )
}
