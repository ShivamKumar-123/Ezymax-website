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

export default function TradingOverviewPage() {
  return (
    <>
      <TxHero />
      <TxOverview />
      <TxModes />
      <TxLeverage />
      <TxCostStructure />
      <TxXP />
      <TxExample />
      <TxRiskControl />
      <TxDemoReal />
      <TxFinalCTA />
    </>
  )
}
