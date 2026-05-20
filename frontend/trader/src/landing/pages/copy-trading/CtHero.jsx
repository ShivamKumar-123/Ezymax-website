'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Crown, Star, BadgeCheck, Sliders, Eye, Lock } from 'lucide-react'

const leaders = [
  { rank: 1, name: 'AlphaQuant',  roi: '+48.2%', risk: 'Low',    color: '#4ade80' },
  { rank: 2, name: 'NorthStar.X', roi: '+34.7%', risk: 'Medium', color: '#f59e0b' },
  { rank: 3, name: 'SilkTrader',  roi: '+72.1%', risk: 'High',   color: '#f87171' },
]

const trustBadges = [
  { icon: BadgeCheck, title: 'Verified Performance', sub: 'Only proven masters' },
  { icon: Sliders,    title: 'Full Control',         sub: 'Adjust or stop anytime' },
  { icon: Eye,        title: 'Transparent',          sub: 'Real-time trade tracking' },
  { icon: Lock,       title: 'Secure & Reliable',    sub: 'Your funds, your control' },
]

export default function CtHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--fx-bg)',
        backgroundImage:
          'radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%), radial-gradient(40% 40% at 15% 90%, rgba(214,169,61,0.06) 0%, rgba(214,169,61,0) 60%)',
      }}
    >
      <div className="fx-grid-bg" />
      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-16 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <div className="fx-fade-up mb-5">
              <span className="badge">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                />
                Copy Trading
              </span>
            </div>
            <h1 className="fx-headline text-[36px] sm:text-[46px] md:text-[54px] lg:text-[60px] xl:text-[68px] fx-fade-up fx-fade-up-d1">
              Copy Top Traders. <br />
              <span className="fx-gold-text">Trade Smarter.</span>
            </h1>
            <p
              className="mt-5 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Automatically copy the trades of verified Master Traders, or prove your own
              performance and become one. Either side — you stay in full control.
            </p>
            <p
              className="mt-4 text-sm md:text-base font-semibold fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-gold-light)' }}
            >
              Performance earns trust. Not promises.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="#explore" className="fx-btn-primary justify-center">
                Explore Traders
                <ArrowRight size={18} />
              </Link>
              <Link to="#master" className="fx-btn-ghost justify-center">
                <Crown size={16} />
                Become a Master Trader
              </Link>
            </div>

            {/* Trust badges row */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 fx-fade-up fx-fade-up-d4 max-w-2xl">
              {trustBadges.map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(214,169,61,0.10)',
                      border: '1px solid rgba(214,169,61,0.30)',
                    }}
                  >
                    <Icon size={14} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-white leading-tight">{title}</div>
                    <div className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--fx-text-3)' }}>
                      {sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Leaderboard + Copy toggle + Perf chart */}
          <div className="lg:col-span-5 relative">
            <div className="relative h-[470px] sm:h-[520px] lg:h-[560px]">
              {/* Leaderboard card */}
              <div
                className="absolute inset-x-0 top-0 glass-card overflow-hidden"
                style={{ animation: 'fxFloat 7s ease-in-out infinite' }}
              >
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{
                    background: 'rgba(214,169,61,0.04)',
                    borderBottom: '1px solid var(--fx-line)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Crown size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Leaderboard
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--fx-text-3)' }}>
                    Verified
                  </span>
                </div>
                <ul>
                  {leaders.map((l, i) => (
                    <li
                      key={l.name}
                      className="flex items-center gap-3 px-5 py-3"
                      style={{
                        borderBottom: i === leaders.length - 1 ? 'none' : '1px solid var(--fx-line)',
                      }}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                        style={{
                          background:
                            l.rank === 1
                              ? 'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))'
                              : 'rgba(255,255,255,0.06)',
                          color: l.rank === 1 ? '#1a1408' : 'var(--fx-text-2)',
                        }}
                      >
                        {l.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                          {l.name}
                          <Star size={11} style={{ color: 'var(--fx-gold-light)' }} />
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            background: `${l.color}1f`,
                            color: l.color,
                            border: `1px solid ${l.color}55`,
                          }}
                        >
                          {l.risk}
                        </span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#4ade80' }}>
                        {l.roi}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
