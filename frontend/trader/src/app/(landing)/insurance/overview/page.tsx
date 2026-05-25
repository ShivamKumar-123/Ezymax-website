'use client'

import InHero from '@/landing/pages/insurance/InHero'
import InWhy from '@/landing/pages/insurance/InWhy'
import InHow from '@/landing/pages/insurance/InHow'
import InCoverage from '@/landing/pages/insurance/InCoverage'
import InDuration from '@/landing/pages/insurance/InDuration'
import InLogic from '@/landing/pages/insurance/InLogic'
import InRules from '@/landing/pages/insurance/InRules'
import InUX from '@/landing/pages/insurance/InUX'
import InFaq from '@/landing/pages/insurance/InFaq'
import InCTA from '@/landing/pages/insurance/InCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function InsuranceOverviewPage() {
  return (
    <>
      <InHero />
      <InWhy />
      <InHow />
      <FxPageBanner
        image="/images/Insurance_banner1.png"
        alt="FX Artha Trade Insurance"
        tagline="Protection that works in the background."
        taglineSub="Activate a plan, then trade — coverage applies automatically on eligible losses."
      />
      <InCoverage />
      <InDuration />
      <InLogic />
      <FxPageBanner
        image="/images/Insurance_banner2.png"
        alt="FX Artha Trade Insurance"
        tone="elev"
        tagline="One pool. Continuous cover."
        taglineSub="Coverage spans your whole plan duration — not single trades."
      />
      <InRules />
      <InUX />
      <InFaq />
      <InCTA />
    </>
  )
}
