import { useState } from 'react'
import { DollarSign, Gem, Bitcoin, BarChart3 } from 'lucide-react'
import ScrollReveal from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import TradingViewWidget from '../../components/TradingViewWidget'

const chartTabs = [
  { id: 'forex', label: 'Forex', symbol: 'FX:EURUSD', icon: <DollarSign size={16} /> },
  { id: 'gold', label: 'Gold', symbol: 'OANDA:XAUUSD', icon: <Gem size={16} /> },
  { id: 'crypto', label: 'Crypto', symbol: 'BINANCE:BTCUSDT', icon: <Bitcoin size={16} /> },
  { id: 'indices', label: 'Indices', symbol: 'CAPITALCOM:US30', icon: <BarChart3 size={16} /> },
]

export default function LiveMarketChartsSection() {
  const [activeTab, setActiveTab] = useState('forex')

  return (
    <section className="pt-20 pb-24 md:pt-24 md:pb-32 bg-primary-bg">
      <div className="container-custom">
        <SectionHeader
          badge="Live Charts"
          title="Live Market Charts"
          highlight="Market Charts"
          subtitle="Real-time professional charts powered by TradingView — the world's leading charting platform."
        />

        {/* Tab Navigation */}
        <ScrollReveal variant="fadeUp" delay={0.2}>
          <div className="flex flex-wrap justify-center gap-3 mb-12 mt-10">
            {chartTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-white shadow-lg shadow-primary-purple/20'
                    : 'bg-primary-secondary text-text-secondary hover:text-white border border-white/5 hover:border-white/10'
                }`}
                style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #7B2FFF, #1A56FF)' } : undefined}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* Chart */}
        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="w-full max-w-7xl mx-auto">
            <TradingViewWidget symbol={chartTabs.find(t => t.id === activeTab)?.symbol} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
