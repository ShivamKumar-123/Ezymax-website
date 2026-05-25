'use client'

import StHero from '@/landing/pages/staking/StHero'
import StOverview from '@/landing/pages/staking/StOverview'
import StModes from '@/landing/pages/staking/StModes'
import StPlans from '@/landing/pages/staking/StPlans'
import StApy from '@/landing/pages/staking/StApy'
import StBonus from '@/landing/pages/staking/StBonus'
import StSelfVsCopy from '@/landing/pages/staking/StSelfVsCopy'
import StExample from '@/landing/pages/staking/StExample'
import StCTA from '@/landing/pages/staking/StCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function StakingPage() {
  return (
    <>
      <StHero />
      <StOverview />
      <StModes />
      <FxPageBanner
        image="/images/Staking_banner1.png"
        alt="FX Artha Staking"
        tagline="Put idle assets to work."
        taglineSub="Earn structured rewards while staying flexible."
      />
      <StPlans />
      <StApy />
      <StBonus />
      <FxPageBanner
        image="/images/Staking_banner2.png"
        alt="FX Artha Staking"
        tone="elev"
        tagline="Your capital. Your control."
        taglineSub="Flexible access, or lock in for better terms."
      />
      <StSelfVsCopy />
      <StExample />
      <StCTA />
    </>
  )
}
