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
      <FxPageBanner label="Banner / Image" />
      <InCoverage />
      <InDuration />
      <InLogic />
      <FxPageBanner label="Banner / Image" tone="elev" />
      <InRules />
      <InUX />
      <InFaq />
      <FxPageBanner label="Banner / Image" />
      <InCTA />
    </>
  )
}
