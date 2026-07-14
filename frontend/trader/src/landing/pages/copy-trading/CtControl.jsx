import { StopCircle, Sliders, Activity, ShieldCheck } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const features = [
  {
    icon: StopCircle,
    title: 'Stop Copying Anytime',
    desc: 'Pause or fully exit the copy relationship instantly — no waiting period.',
  },
  {
    icon: Sliders,
    title: 'Adjust Allocation',
    desc: 'Increase or decrease how much capital follows a Master Trader on demand.',
  },
  {
    icon: Activity,
    title: 'Real-time Performance',
    desc: 'Live view of P&L per Master Trader you copy, with full trade history.',
  },
  {
    icon: ShieldCheck,
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Control &amp; Risk</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Full Control. <span className="gradient-text">Transparent Risk.</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Copy trading shouldn't mean handing over your account. Pause, change allocations, or pull out completely whenever you want — no waiting period, no calls.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Clean dark feature cards, top-left icon badges ─── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-12 md:mt-16 items-stretch">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
    </section>
  )
}
