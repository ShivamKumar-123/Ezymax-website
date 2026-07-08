import { StopCircle, Sliders, Activity, ShieldCheck } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const features = [
  {
    icon: StopCircle,
    accent: '#f87171',
    title: 'Stop Copying Anytime',
    desc: 'Pause or fully exit the copy relationship instantly — no waiting period.',
  },
  {
    icon: Sliders,
    accent: '#ecc657',
    title: 'Adjust Allocation',
    desc: 'Increase or decrease how much capital follows a Master Trader on demand.',
  },
  {
    icon: Activity,
    accent: '#4ade80',
    title: 'Real-time Performance',
    desc: 'Live view of P&L per Master Trader you copy, with full trade history.',
  },
  {
    icon: ShieldCheck,
    accent: '#a78bfa',
    title: 'Risk Management Tools',
    desc: 'Set caps, exposure limits, and protective rules per copy relationship.',
  },
]

const faq = [
  { q: 'Can I limit my risk?',              a: 'Yes, through allocation and stopping controls.' },
  { q: 'What happens if the trader loses?', a: 'Losses are reflected proportionally.' },
]

export default function CtControl() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="Control & Risk"
          title="Full Control. Transparent Risk."
          highlight="Transparent Risk"
          subtitle="Copy trading shouldn't mean handing over your account. Pause, change allocations, or pull out completely whenever you want — no waiting period, no calls."
        />
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.05}>
                <div className="glass-card h-full p-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${f.accent}1f`, border: `1px solid ${f.accent}55` }}
                  >
                    <Icon size={20} style={{ color: f.accent }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {f.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.22}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;You control your capital at all times.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-8 md:mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
