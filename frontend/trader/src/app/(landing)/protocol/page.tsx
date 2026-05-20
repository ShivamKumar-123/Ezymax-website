'use client'

import PrHero from '@/landing/pages/protocol/PrHero'
import PrCompare from '@/landing/pages/protocol/PrCompare'
import PrFlow from '@/landing/pages/protocol/PrFlow'
import PrFundsFlow from '@/landing/pages/protocol/PrFundsFlow'
import PrSecurity from '@/landing/pages/protocol/PrSecurity'
import PrTable from '@/landing/pages/protocol/PrTable'
import PrFaq from '@/landing/pages/protocol/PrFaq'
import PrCTA from '@/landing/pages/protocol/PrCTA'

export default function ProtocolPage() {
  return (
    <>
      <PrHero />
      <PrCompare />
      <PrFlow />
      <PrFundsFlow />
      <PrSecurity />
      <PrTable />
      <PrFaq />
      <PrCTA />
    </>
  )
}
