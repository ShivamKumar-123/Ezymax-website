import { Search, MousePointer2, Wallet, Repeat2, Eye } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const steps = [
  { icon: Search,       title: 'Browse Traders',     desc: 'See verified Master Traders and their stats.' },
  { icon: MousePointer2,title: 'Select a Trader',    desc: 'Pick one that matches your risk and goals.' },
  { icon: Wallet,       title: 'Allocate Funds',     desc: 'Choose how much capital to copy with.' },
  { icon: Repeat2,      title: 'Auto Copy',          desc: 'Every trade is mirrored in your account.' },
  { icon: Eye,          title: 'Monitor & Control',  desc: 'Adjust or stop copying anytime.' },
]

const faq = [
  { q: 'Can I copy multiple traders?', a: 'Yes, diversification is supported.' },
  { q: 'Can I stop anytime?',          a: 'Yes, instantly.' },
]

export default function CtHow() {
  return (
    <section id="explore" className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Centered header (reference "How it works") ─────── */}
        <div className="max-w-2xl mx-auto text-center">
          <ScrollReveal variant="fadeUp">
            <span className="badge mx-auto">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--fx-gold-light)' }} />
              How To Copy
            </span>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.05}>
            <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
              How <span className="gradient-text">It Works</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg mt-5" style={{ color: 'var(--fx-text-2)' }}>
              Five quick steps from picking a trader to seeing the first mirrored trade in your account. No setup gymnastics.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Clean dark step cards with top icon badges ─────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mt-12 md:mt-16 items-stretch">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="feature-icon" style={{ width: 44, height: 44 }}>
                      <Icon size={20} />
                    </div>
                    <span
                      className="text-sm font-extrabold gradient-text"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-base md:text-[17px] font-bold text-white mb-1.5">
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {s.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.18}>
          <p
            className="mt-8 md:mt-10 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Simple setup. Full flexibility.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 md:mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
