'use client'

import ErHero from '@/landing/pages/earning/ErHero'
import ErRewardSystem from '@/landing/pages/earning/ErRewardSystem'
import ErHowYouEarn from '@/landing/pages/earning/ErHowYouEarn'
import ErPlayZone from '@/landing/pages/earning/ErPlayZone'
import ErRewardStore from '@/landing/pages/earning/ErRewardStore'
import ErTasks from '@/landing/pages/earning/ErTasks'
import ErBigRewards from '@/landing/pages/earning/ErBigRewards'
import ErCTA from '@/landing/pages/earning/ErCTA'

export default function EarningPage() {
  return (
    <>
      <ErHero />
      <ErRewardSystem />
      <ErHowYouEarn />
      <ErPlayZone />
      <ErRewardStore />
      <ErTasks />
      <ErBigRewards />
      <ErCTA />
    </>
  )
}
