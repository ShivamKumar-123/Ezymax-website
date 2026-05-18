'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, Eye, Wallet, Cpu, Network, Activity } from 'lucide-react'

const pillars = [
  { icon: Eye,     label: 'Trading becomes more transparent' },
  { icon: Wallet,  label: 'Users gain greater control' },
  { icon: Cpu,     label: 'Technology improves trust' },
  { icon: Network, label: 'Modern infrastructure replaces outdated systems' },
]

export default function AbHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--fx-bg)',
        backgroundImage:
          'radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%), radial-gradient(40% 40% at 15% 90%, rgba(96,165,250,0.08) 0%, rgba(96,165,250,0) 60%)',
      }}
    >
      <div className="fx-grid-bg" />
      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-20 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <div className="fx-fade-up mb-5">
              <span className="badge">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                />
                About FX Artha
              </span>
            </div>
            <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[60px] lg:text-[64px] xl:text-[72px] fx-fade-up fx-fade-up-d1">
              Reimagining How <br />
              <span className="fx-gold-text">Modern Trading Works.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              FX Artha is building a next-generation trading ecosystem powered by smart contract
              infrastructure, transparent settlement systems, and trader-focused innovation.
            </p>

            <p
              className="mt-5 max-w-xl text-sm md:text-base leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-3)' }}
            >
              Traditional trading platforms were built around brokers controlling user funds.
              FX Artha is designed differently — an ecosystem where:
            </p>

            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl fx-fade-up fx-fade-up-d3">
              {pillars.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(214,169,61,0.05)',
                    border: '1px solid rgba(214,169,61,0.22)',
                  }}
                >
                  <Icon size={14} style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-xs md:text-sm" style={{ color: 'var(--fx-text-2)' }}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d4">
              <Link to="#ecosystem" className="fx-btn-primary justify-center">
                Explore Ecosystem
                <ArrowRight size={18} />
              </Link>
              <Link to="/auth/register" className="fx-btn-ghost justify-center">
                Start Trading
              </Link>
            </div>
          </div>

          {/* RIGHT — Futuristic network visual */}
          <div className="lg:col-span-5 relative">
            <div className="relative h-[460px] sm:h-[520px] lg:h-[560px]">
              {/* Main globe-network panel */}
              <div
                className="absolute inset-x-0 top-0 rounded-2xl overflow-hidden"
                style={{
                  background:
                    'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                  border: '1px solid rgba(214,169,61,0.28)',
                  animation: 'fxFloat 7s ease-in-out infinite',
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    background: 'rgba(214,169,61,0.04)',
                    borderBottom: '1px solid var(--fx-line)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Settlement Network
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--fx-text-3)' }}>
                    Active
                  </span>
                </div>

                <div className="relative h-[260px] overflow-hidden">
                  <svg
                    viewBox="0 0 400 260"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid slice"
                  >
                    <defs>
                      <radialGradient id="abHeroGlow" cx="50%" cy="50%" r="60%">
                        <stop offset="0%" stopColor="rgba(214,169,61,0.22)" />
                        <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                      </radialGradient>
                    </defs>
                    <rect width="400" height="260" fill="url(#abHeroGlow)" />

                    {/* Orbits */}
                    {[120, 95, 70, 45].map((r, i) => (
                      <circle
                        key={`orb-${i}`}
                        cx="200"
                        cy="130"
                        r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray={i % 2 ? '2 6' : ''}
                      />
                    ))}

                    {/* Hub */}
                    <circle cx="200" cy="130" r="14" fill="rgba(214,169,61,0.18)" />
                    <circle cx="200" cy="130" r="6" fill="#ecc657" />

                    {/* Nodes */}
                    {[
                      [80, 130, 'FX'],
                      [200, 30, 'Swap'],
                      [320, 130, 'TX'],
                      [200, 230, 'P&L'],
                      [115, 65, 'KYC'],
                      [285, 65, 'API'],
                      [285, 195, 'IB'],
                      [115, 195, 'XP'],
                    ].map(([x, y], i) => (
                      <g key={`n-${i}`}>
                        <line
                          x1="200"
                          y1="130"
                          x2={x}
                          y2={y}
                          stroke="rgba(214,169,61,0.40)"
                          strokeWidth="0.9"
                        />
                        <circle cx={x} cy={y} r="9" fill="rgba(214,169,61,0.10)" />
                        <circle cx={x} cy={y} r="3.5" fill="#ecc657" />
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Dashboard overlay */}
              <div
                className="absolute left-0 bottom-0 w-[64%] glass-card p-4"
                style={{ animation: 'fxFloat 8s ease-in-out infinite 0.9s' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-gold-light)' }}>
                      Protocol TPS
                    </span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: '#4ade80' }}>
                    ● Live
                  </span>
                </div>
                <svg viewBox="0 0 200 40" className="w-full h-10" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="abHeroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(214,169,61,0.45)" />
                      <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,32 L24,28 L48,30 L72,20 L96,24 L120,14 L144,18 L168,10 L200,6 L200,40 L0,40 Z"
                    fill="url(#abHeroSpark)"
                  />
                  <path
                    d="M0,32 L24,28 L48,30 L72,20 L96,24 L120,14 L144,18 L168,10 L200,6"
                    fill="none"
                    stroke="#ecc657"
                    strokeWidth="1.5"
                  />
                </svg>
                <div className="mt-2 grid grid-cols-3 text-center gap-1">
                  <div>
                    <div className="text-[10px] uppercase" style={{ color: 'var(--fx-text-3)' }}>Settle</div>
                    <div className="text-xs font-bold text-white">~2s</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase" style={{ color: 'var(--fx-text-3)' }}>Uptime</div>
                    <div className="text-xs font-bold text-white">99.9%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase" style={{ color: 'var(--fx-text-3)' }}>Chains</div>
                    <div className="text-xs font-bold text-white">Multi</div>
                  </div>
                </div>
              </div>

              {/* Floating chip */}
              <div
                className="absolute right-0 top-[58%] px-4 py-3 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(167,139,250,0.18), rgba(167,139,250,0.04))',
                  border: '1px solid rgba(167,139,250,0.4)',
                  boxShadow: '0 8px 30px -10px rgba(167,139,250,0.4)',
                  animation: 'fxFloat 6s ease-in-out infinite 0.4s',
                }}
              >
                <div className="flex items-center gap-2">
                  <Cpu size={16} style={{ color: '#a78bfa' }} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#a78bfa' }}>
                      Smart Contracts
                    </div>
                    <div className="text-base font-bold text-white">Protocol-powered</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
