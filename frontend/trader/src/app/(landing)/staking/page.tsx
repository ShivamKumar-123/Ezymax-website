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

export default function StakingPage() {
  return (
    <>
      <StHero />
      <StOverview />
      <StModes />
      <StPlans />
      <StApy />
      <StBonus />
      <StSelfVsCopy />
      <StExample />
      <StCTA />
    </>
  )
}
