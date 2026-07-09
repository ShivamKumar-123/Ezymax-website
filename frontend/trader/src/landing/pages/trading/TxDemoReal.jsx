import { Link } from 'react-router-dom'
import { FlaskConical, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const demo = ['Simulated trading', 'Risk-free learning']
const real = ['Live execution', 'Smart contract settlement']

export default function TxDemoReal() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Demo vs Real</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Practice <span className="gradient-text">or Trade Live</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Same platform, same buttons. Demo runs on simulated funds — risk-free, just for learning. Real settles on-chain. Switch whenever you're ready.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold Demo tile + dark Real tile ────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-2 mt-12 md:mt-16 items-stretch">
          {/* Demo — solid gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-8 md:p-9 flex flex-col">
              <div className="relative z-[1] flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                  >
                    <FlaskConical size={22} style={{ color: '#1c1608' }} />
                  </div>
                  <h3 className="text-2xl md:text-[26px] font-bold" style={{ color: '#1c1608' }}>Demo</h3>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(28,22,8,0.12)',
                    color: '#1c1608',
                    border: '1px solid rgba(28,22,8,0.3)',
                  }}
                >
                  Risk-free
                </span>
              </div>
              <ul className="relative z-[1] space-y-3 mb-6">
                {demo.map((d) => (
                  <li key={d} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{d}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth/register"
                className="relative z-[1] mt-auto self-start inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(180deg, #2a2210 0%, #14100a 100%)',
                  color: 'var(--fx-gold-light)',
                  border: '1px solid rgba(28,22,8,0.5)',
                  boxShadow: '0 14px 30px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)',
                }}
              >
                Try Demo
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Real — dark tile with gold accents */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full p-8 md:p-9 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="feature-icon" style={{ width: 48, height: 48 }}>
                    <Zap size={22} />
                  </div>
                  <h3 className="text-2xl md:text-[26px] font-bold text-white">Real</h3>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(214,169,61,0.15)',
                    color: 'var(--fx-gold-light)',
                    border: '1px solid rgba(214,169,61,0.35)',
                  }}
                >
                  Live
                </span>
              </div>
              <ul className="space-y-3 mb-6">
                {real.map((r) => (
                  <li key={r} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{r}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth/register" className="fx-btn-primary mt-auto self-start">
                Go Live
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
