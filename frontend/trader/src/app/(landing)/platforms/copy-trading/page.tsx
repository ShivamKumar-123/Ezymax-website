'use client'

import CtHero from '@/landing/pages/copy-trading/CtHero'
import CtWhat from '@/landing/pages/copy-trading/CtWhat'
import CtHow from '@/landing/pages/copy-trading/CtHow'
import CtMaster from '@/landing/pages/copy-trading/CtMaster'
import CtProfit from '@/landing/pages/copy-trading/CtProfit'
import CtFee from '@/landing/pages/copy-trading/CtFee'
import CtControl from '@/landing/pages/copy-trading/CtControl'
import CtCTA from '@/landing/pages/copy-trading/CtCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function CopyTradingPage() {
  return (
    <>
      <CtHero />
      <CtWhat />
      <CtHow />
      <FxPageBanner label="Banner / Image" />
      <CtMaster />
      <CtProfit />
      <CtFee />
      <FxPageBanner label="Banner / Image" tone="elev" />
      <CtControl />
      <CtCTA />
    </>
  )
}
