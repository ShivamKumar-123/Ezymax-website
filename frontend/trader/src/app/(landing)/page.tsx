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
      <FxTradingModes />
      <FxTradeInsurance />
      <FxGamification />
      <FxCopyTrading />
      <FxStaking />
      <FxReferral />
      <FxFinalCTA />
    </>
  )
}
