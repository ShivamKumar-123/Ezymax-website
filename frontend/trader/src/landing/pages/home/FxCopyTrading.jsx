import { Link } from 'react-router-dom'
import { ArrowRight, Copy, Star, Users } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const traders = [
  { name: 'AlphaQuant',  roi: '+48.2%', risk: 'Low',    riskColor: '#4ade80', followers: '2.4k', avatar: 'AQ' },
  { name: 'NorthStar.X', roi: '+34.7%', risk: 'Medium', riskColor: '#f59e0b', followers: '1.8k', avatar: 'NS' },
  { name: 'SilkTrader',  roi: '+72.1%', risk: 'High',   riskColor: '#f87171', followers: '3.1k', avatar: 'ST' },
  { name: 'OrionFX',     roi: '+21.5%', risk: 'Low',    riskColor: '#4ade80', followers: '1.2k', avatar: 'OF' },
]

export default function FxCopyTrading() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Copy Trading"
          title="Access Experience Without Guesswork"
          highlight="Without Guesswork"
          subtitle="Strategy over speculation."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* ── Left content ──────────────────────────────────── */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-5">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <Copy size={20} />
              </div>
              <h3 className="text-2xl md:text-[28px] font-bold text-white mb-4 leading-tight">
                Follow proven strategies, automatically
              </h3>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Select traders based on performance and replicate their strategies automatically.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-7">
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(214,169,61,0.06)',
                    border: '1px solid rgba(214,169,61,0.22)',
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    For Users
                  </div>
                  <div className="text-sm text-white font-medium leading-snug">
                    Follow structured strategies, reduce decision complexity.
                  </div>
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(214,169,61,0.06)',
                    border: '1px solid rgba(214,169,61,0.22)',
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    For Traders
                  </div>
                  <div className="text-sm text-white font-medium leading-snug">
                    Share strategies, earn based on performance.
                  </div>
                </div>
              </div>

              <Link to="/social" className="fx-btn-primary">
                Explore Copy Trading
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* ── Right traders table ──────────────────────────── */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-7">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div
                className="grid grid-cols-12 px-5 md:px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: 'rgba(214,169,61,0.04)',
                  borderBottom: '1px solid var(--fx-line)',
                  color: 'var(--fx-text-3)',
                }}
              >
                <div className="col-span-5">Trader</div>
                <div className="col-span-2 text-right">ROI</div>
                <div className="col-span-2 text-right">Risk</div>
                <div className="col-span-1 text-right">Fol.</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {traders.map((t, i) => (
                <div
                  key={t.name}
                  className="grid grid-cols-12 items-center px-5 md:px-6 py-4 transition-colors hover:bg-white/[0.02]"
                  style={{
                    borderBottom: i === traders.length - 1 ? 'none' : '1px solid var(--fx-line)',
                  }}
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                        color: '#1a1408',
                      }}
                    >
                      {t.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                      <div
                        className="text-[11px] flex items-center gap-1"
                        style={{ color: 'var(--fx-text-3)' }}
                      >
                        <Star size={10} style={{ color: 'var(--fx-gold-light)' }} /> Verified
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-sm font-bold" style={{ color: '#4ade80' }}>
                    {t.roi}
                  </div>
                  <div className="col-span-2 text-right">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{
                        background: `${t.riskColor}1f`,
                        color: t.riskColor,
                        border: `1px solid ${t.riskColor}55`,
                      }}
                    >
                      {t.risk}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right text-xs inline-flex items-center justify-end gap-1"
                    style={{ color: 'var(--fx-text-2)' }}
                  >
                    <Users size={11} />
                    {t.followers}
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                        color: '#1a1408',
                        boxShadow: '0 6px 16px -6px rgba(214,169,61,0.5)',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
