import { Link } from 'react-router-dom'
import { ArrowRight, Copy, Star, Users } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Copy Trading</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Access Experience <span className="gradient-text">Without Guesswork</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Pick a trader whose track record you actually trust. Their trades mirror into your account automatically, at your size, pause whenever you want.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold tile + dark table tile ────────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-12 mt-10 md:mt-14 items-stretch">
          {/* Follow proven strategies — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-5">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div className="relative z-[1] mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                >
                  <Copy size={20} style={{ color: '#1c1608' }} />
                </div>
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-2xl md:text-[28px] font-bold mb-4 leading-tight" style={{ color: '#1c1608' }}>
                Follow proven strategies, automatically
              </h3>
              <p className="relative z-[1] text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Select traders based on performance and replicate their strategies automatically.
              </p>

              <div className="relative z-[1] grid grid-cols-2 gap-3 mb-7">
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(28,22,8,0.10)',
                    border: '1px solid rgba(28,22,8,0.2)',
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(28,22,8,0.6)' }}>
                    For Users
                  </div>
                  <div className="text-sm font-medium leading-snug" style={{ color: '#1c1608' }}>
                    Follow structured strategies, reduce decision complexity.
                  </div>
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(28,22,8,0.10)',
                    border: '1px solid rgba(28,22,8,0.2)',
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(28,22,8,0.6)' }}>
                    For Traders
                  </div>
                  <div className="text-sm font-medium leading-snug" style={{ color: '#1c1608' }}>
                    Share strategies, earn based on performance.
                  </div>
                </div>
              </div>

              <Link to="/social" className="fx-btn-primary relative z-[1] mt-auto">
                Explore Copy Trading
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Traders leaderboard — dark tile (semantic data colors kept) */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-7">
            <div className="fx-tile h-full overflow-hidden">
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

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Strategy over speculation.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
