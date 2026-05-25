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
      <FxPageBanner
        image="/images/copy_banner1.png"
        alt="FX Artha Copy Trading"
        tagline="Copy proven traders."
        taglineSub="Mirror verified strategies automatically — at your size, on your terms."
      />
      <CtMaster />
      <CtProfit />
      <CtFee />
      <FxPageBanner
        image="/images/copy_banner2.png"
        alt="FX Artha Copy Trading"
        tone="elev"
        tagline="Performance earns trust."
        taglineSub="Prove your results and become a verified Master Trader."
      />
      <CtControl />
      <CtCTA />
    </>
  )
}
