'use client'

import TxHero from '@/landing/pages/trading/TxHero'
import TxOverview from '@/landing/pages/trading/TxOverview'
import TxModes from '@/landing/pages/trading/TxModes'
import TxLeverage from '@/landing/pages/trading/TxLeverage'
import TxCostStructure from '@/landing/pages/trading/TxCostStructure'
import TxXP from '@/landing/pages/trading/TxXP'
import TxExample from '@/landing/pages/trading/TxExample'
import TxRiskControl from '@/landing/pages/trading/TxRiskControl'
import TxDemoReal from '@/landing/pages/trading/TxDemoReal'
import TxFinalCTA from '@/landing/pages/trading/TxFinalCTA'
import FxPageBanner from '@/landing/components/FxPageBanner'

export default function TradingOverviewPage() {
  return (
    <>
      <TxHero />
      <TxOverview />
      <TxModes />
      <FxPageBanner
        image="/images/trading_banner1.png"
        alt="FX Artha Trading"
        tagline="Trade smart. Pay less over time."
        taglineSub="Transparent pricing that improves the more you trade."
      />
      <TxLeverage />
      <TxCostStructure />
      <TxXP />
      <FxPageBanner
        image="/images/trading_banner2.png"
        alt="FX Artha Trading"
        tone="elev"
        tagline="Every cost, known upfront."
        taglineSub="No swap charges. No hidden fees. Just three clear components."
      />
      <TxExample />
      <TxRiskControl />
      <TxDemoReal />
      <TxFinalCTA />
    </>
  )
}
