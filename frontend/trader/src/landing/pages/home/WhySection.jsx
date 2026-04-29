import { TrendingUp, Globe2, Coins, ShieldCheck } from 'lucide-react'
import ScrollReveal from '../../components/animations/ScrollReveal'

const features = [
  {
    icon: TrendingUp,
    title: 'Advanced Trading',
    desc: 'Powerful platforms, real-time data, and advanced tools for smart trading.',
  },
  {
    icon: Globe2,
    title: 'Global Markets',
    desc: 'Trade Forex, Commodities, Indices, Stocks & Crypto from one account.',
  },
  {
    icon: Coins,
    title: 'Low Spreads',
    desc: 'Enjoy ultra-low spreads and transparent pricing with no hidden fees.',
  },
  {
    icon: ShieldCheck,
    title: 'Fast Withdrawals',
    desc: 'Quick, secure & hassle-free withdrawals with multiple payment options.',
  },
]

export default function WhySection() {
  return (
    <section className="relative" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container py-12 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <ScrollReveal key={title} variant="fadeUp" delay={i * 0.06}>
              <div
                className="h-full rounded-2xl p-5 md:p-6 flex items-start gap-4 transition-all duration-300"
                style={{
                  background: 'var(--fx-bg-elev)',
                  border: '1px solid var(--fx-line)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(214,169,61,0.4)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--fx-line)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'var(--fx-gold-soft)',
                    border: '1px solid rgba(214,169,61,0.28)',
                  }}
                >
                  <Icon size={20} style={{ color: 'var(--fx-gold-light)' }} />
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-base md:text-lg font-semibold mb-1.5"
                    style={{ color: 'var(--fx-gold-light)' }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
