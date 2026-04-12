'use client'

import HeroSection from '@/landing/pages/home/HeroSection'
import StatsBar from '@/landing/pages/home/StatsBar'
import WhySection from '@/landing/pages/home/WhySection'
import MarketsSection from '@/landing/pages/home/MarketsSection'
import AccountsSection from '@/landing/pages/home/AccountsSection'
import PlatformSection from '@/landing/pages/home/PlatformSection'
import ConditionsSection from '@/landing/pages/home/ConditionsSection'
import ToolsSection from '@/landing/pages/home/ToolsSection'
import EducationSection from '@/landing/pages/home/EducationSection'
import PaymentsSection from '@/landing/pages/home/PaymentsSection'
import SecuritySection from '@/landing/pages/home/SecuritySection'
import AboutSection from '@/landing/pages/home/AboutSection'
import VisionMissionSection from '@/landing/pages/home/VisionMissionSection'
import PartnerProgramSection from '@/landing/pages/home/PartnerProgramSection'
import IslamicAccountSection from '@/landing/pages/home/IslamicAccountSection'
import LiveMarketChartsSection from '@/landing/pages/home/LiveMarketChartsSection'
import StartTradingSection from '@/landing/pages/home/StartTradingSection'
import BottomSection from '@/landing/pages/home/BottomSection'

export default function LandingHomePage() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <WhySection />
      <MarketsSection />
      <AccountsSection />
      <PlatformSection />
      <ConditionsSection />
      <ToolsSection />
      <LiveMarketChartsSection />
      <EducationSection />
      <PaymentsSection />
      <SecuritySection />
      <AboutSection />
      <VisionMissionSection />
      <IslamicAccountSection />
      <PartnerProgramSection />
      <StartTradingSection />
      <BottomSection />
    </>
  )
}
