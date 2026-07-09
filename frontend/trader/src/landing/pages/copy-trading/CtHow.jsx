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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How To Copy</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                How <span className="gradient-text">It Works</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Five quick steps from picking a trader to seeing the first mirrored trade in your account. No setup gymnastics.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: numbered step cards (middle = gold) ────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mt-10 md:mt-14 items-stretch">
          {steps.map((s, i) => {
            const Icon = s.icon
            const gold = i === 2
            return (
              <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                <div className={`${gold ? 'fx-tile-gold' : 'fx-tile'} h-full p-6 md:p-7 flex flex-col`}>
                  <div
                    className={`${gold ? 'relative z-[1] text-4xl md:text-5xl font-extrabold mb-4' : 'text-4xl md:text-5xl font-extrabold gradient-text mb-4'}`}
                    style={gold ? { color: '#1c1608' } : undefined}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  {gold ? (
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                  ) : (
                    <span className="fx-accent-bar mb-4" />
                  )}
                  {gold ? (
                    <div
                      className="relative z-[1] w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                  ) : (
                    <div className="feature-icon mb-4" style={{ width: 44, height: 44 }}>
                      <Icon size={20} />
                    </div>
                  )}
                  <h3
                    className={`text-base md:text-[17px] font-bold mb-1.5 ${gold ? 'relative z-[1]' : 'text-white'}`}
                    style={gold ? { color: '#1c1608' } : undefined}
                  >
                    {s.title}
                  </h3>
                  <p
                    className={`text-sm leading-relaxed ${gold ? 'relative z-[1]' : ''}`}
                    style={{ color: gold ? 'rgba(28,22,8,0.78)' : 'var(--fx-text-2)' }}
                  >
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
