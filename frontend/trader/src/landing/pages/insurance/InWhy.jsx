import { ShieldCheck, TrendingDown, Activity, Eye } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Why Trade Insurance</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                A Smarter Way to Manage <span className="gradient-text">Downside Risk</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Markets move against everyone sooner or later. Trade Insurance gives back a slice of those losses — based on the coverage level you chose when you activated the plan.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold content tile + image tile ─────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-2 mt-12 md:mt-16 items-stretch">
          {/* Gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <ShieldCheck size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <p className="relative z-[1] text-base md:text-lg leading-relaxed mb-6" style={{ color: '#1c1608' }}>
                Trade Insurance covers a portion of your losses — based on your selected{' '}
                coverage level and the active
                plan duration. It is a structured layer of protection across your trading activity,
                not a per-trade refund.
              </p>

              <ul className="relative z-[1] space-y-3 mt-auto">
                {pillars.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(28,22,8,0.08)',
                      border: '1px solid rgba(28,22,8,0.2)',
                    }}
                  >
                    <Icon size={16} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full min-h-[280px] overflow-hidden">
              <img
                src="/images/insurance_card1.png"
                alt="Trade Insurance coverage"
                className="h-full w-full object-cover"
              />
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
    </section>
  )
}
