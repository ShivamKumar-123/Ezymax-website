'use client'

import PrHero from '@/landing/pages/protocol/PrHero'
import PrCompare from '@/landing/pages/protocol/PrCompare'
import PrFlow from '@/landing/pages/protocol/PrFlow'
import PrFundsFlow from '@/landing/pages/protocol/PrFundsFlow'
import PrSecurity from '@/landing/pages/protocol/PrSecurity'
import PrTable from '@/landing/pages/protocol/PrTable'
import PrFaq from '@/landing/pages/protocol/PrFaq'
import PrCTA from '@/landing/pages/protocol/PrCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function ProtocolPage() {
  return (
    <>
      <PrHero />
      <PrCompare />
      <PrFlow />
      <FxPageBanner
        image="/images/Protocol_banner1.png"
        alt="FX Artha Protocol"
        tagline="Execution runs on logic — not control."
        taglineSub="A transparent, system-driven trading protocol."
      />
      <PrFundsFlow />
      <PrSecurity />
      <PrTable />
      <FxPageBanner
        image="/images/Protocol_banner2.png"
        alt="FX Artha Protocol"
        tone="elev"
        tagline="Your funds stay yours."
        taglineSub="Non-custodial by design — verifiable, automated settlement."
      />
      <PrFaq />
      <PrCTA />
    </>
  )
}
