'use client'

import ErHero from '@/landing/pages/earning/ErHero'
import ErRewardSystem from '@/landing/pages/earning/ErRewardSystem'
import ErHowYouEarn from '@/landing/pages/earning/ErHowYouEarn'
import ErPlayZone from '@/landing/pages/earning/ErPlayZone'
import ErRewardStore from '@/landing/pages/earning/ErRewardStore'
import ErTasks from '@/landing/pages/earning/ErTasks'
import ErBigRewards from '@/landing/pages/earning/ErBigRewards'
import ErCTA from '@/landing/pages/earning/ErCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function EarningPage() {
  return (
    <>
      <ErHero />
      <ErRewardSystem />
      <ErHowYouEarn />
      <FxPageBanner
        image="/images/Earning_banner1.png"
        alt="FX Artha Earning"
        tagline="Your activity has value."
        taglineSub="Earn XP, credits, and rewards while you do what you'd do anyway."
      />
      <ErPlayZone />
      <ErRewardStore />
      <ErTasks />
      <FxPageBanner
        image="/images/Earning_banner2.png"
        alt="FX Artha Earning"
        tone="elev"
        tagline="Stay active. Unlock more."
        taglineSub="The more you engage, the more the ecosystem gives back."
      />
      <ErBigRewards />
      <ErCTA />
    </>
  )
}
