'use client'

import HeroSection from '@/landing/pages/home/HeroSection'
import FxProblemSolution from '@/landing/pages/home/FxProblemSolution'
import FxHowItWorks from '@/landing/pages/home/FxHowItWorks'
import FxTradingModes from '@/landing/pages/home/FxTradingModes'
import FxTradeInsurance from '@/landing/pages/home/FxTradeInsurance'
import FxGamification from '@/landing/pages/home/FxGamification'
import FxCopyTrading from '@/landing/pages/home/FxCopyTrading'
import FxStaking from '@/landing/pages/home/FxStaking'
import FxReferral from '@/landing/pages/home/FxReferral'
import FxFinalCTA from '@/landing/pages/home/FxFinalCTA'

export default function LandingHomePage() {
  return (
    <>
      <HeroSection />
      <FxProblemSolution />
      <FxHowItWorks />
      <section style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container py-8 md:py-10 lg:py-12">
          <img
            src="/images/hero_banner1.png"
            alt=""
            className="w-full h-auto rounded-2xl"
          />
        </div>
      </section>
      <FxTradingModes />
      <FxTradeInsurance />
      <FxGamification />
      <section style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container py-8 md:py-10 lg:py-12">
          <img
            src="/images/hero_banner2.png"
            alt=""
            className="w-full h-auto rounded-2xl"
          />
        </div>
      </section>
      <FxCopyTrading />
      <FxStaking />
      <FxReferral />
      <section style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container py-8 md:py-10 lg:py-12">
          <img
            src="/images/hero_banner3.png"
            alt=""
            className="w-full h-auto rounded-2xl"
          />
        </div>
      </section>
      <FxFinalCTA />
    </>
  )
}
