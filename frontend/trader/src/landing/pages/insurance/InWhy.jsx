import { ShieldCheck, TrendingDown, Activity, Eye } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const pillars = [
  { icon: TrendingDown, label: 'Cushion drawdowns' },
  { icon: Activity,     label: 'Stay in the market longer' },
  { icon: Eye,          label: 'Trade with clear risk visibility' },
]

export default function InWhy() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="Why Trade Insurance"
          title="A Smarter Way to Manage Downside Risk"
          highlight="Downside Risk"
          subtitle="Markets move against everyone sooner or later. Trade Insurance gives back a slice of those losses — based on the coverage level you chose when you activated the plan."
        />
        <div className="mt-12 md:mt-16 max-w-3xl mx-auto">
          <ScrollReveal variant="fadeUp">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <ShieldCheck size={20} />
              </div>
              <p className="text-base md:text-lg leading-relaxed mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Trade Insurance covers a portion of your losses — based on your selected{' '}
                <span style={{ color: 'var(--fx-gold-light)' }}>coverage level</span> and the active
                plan duration. It is a structured layer of protection across your trading activity,
                not a per-trade refund.
              </p>

              <ul className="space-y-3">
                {pillars.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.22)',
                    }}
                  >
                    <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Structured protection helps you stay consistent.&rdquo;
          </p>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
