import { Link } from 'react-router-dom'
import { FlaskConical, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const demo = ['Simulated trading', 'Risk-free learning']
const real = ['Live execution', 'Smart contract settlement']

export default function TxDemoReal() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Demo vs Real"
          title="Practice or Trade Live"
          highlight="or Trade Live"
          subtitle="Same platform, same buttons. Demo runs on simulated funds — risk-free, just for learning. Real settles on-chain. Switch whenever you're ready."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Demo */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full rounded-2xl p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(245,158,11,0.30)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.4)' }}
                  >
                    <FlaskConical size={22} style={{ color: '#f59e0b' }} />
                  </div>
                  <h3 className="text-2xl md:text-[26px] font-bold text-white">Demo</h3>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.35)',
                  }}
                >
                  Risk-free
                </span>
              </div>
              <ul className="space-y-3 mb-6">
                {demo.map((d) => (
                  <li key={d} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#f59e0b' }} />
                    <span className="text-sm md:text-[15px] text-white">{d}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth/register" className="fx-btn-ghost">
                Try Demo
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Real */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(74,222,128,0.30)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.4)' }}
                  >
                    <Zap size={22} style={{ color: '#4ade80' }} />
                  </div>
                  <h3 className="text-2xl md:text-[26px] font-bold text-white">Real</h3>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(74,222,128,0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(74,222,128,0.35)',
                  }}
                >
                  Live
                </span>
              </div>
              <ul className="space-y-3 mb-6">
                {real.map((r) => (
                  <li key={r} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                    <span className="text-sm md:text-[15px] text-white">{r}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth/register" className="fx-btn-primary">
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
