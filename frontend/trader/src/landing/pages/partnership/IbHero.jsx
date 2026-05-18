'use client'

import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Handshake,
  Globe2,
  TrendingUp,
  Users,
  BarChart3,
} from 'lucide-react'

export default function IbHero() {
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
                Introducing Broker Program
              </span>
            </div>
            <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[60px] lg:text-[66px] xl:text-[72px] fx-fade-up fx-fade-up-d1">
              Partner With FX Artha. <br />
              <span className="fx-gold-text">Build Your Trading Business.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Join the FX Artha Introducing Broker (IB) Program and grow with a next-generation
              trading protocol designed for modern traders.
            </p>
            <div className="mt-6 fx-fade-up fx-fade-up-d2">
              <span
                className="inline-block text-sm md:text-base font-semibold tracking-wide"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                Professional partnership. Transparent rewards. Long-term growth.
              </span>
            </div>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="#apply" className="fx-btn-primary justify-center">
                Apply as IB
                <ArrowRight size={18} />
              </Link>
              <Link to="/company/contact" className="fx-btn-ghost justify-center">
                <Handshake size={16} />
                Talk to Partnership Team
              </Link>
            </div>
          </div>

          {/* RIGHT — Globe + partner-dashboard preview */}
          <div className="lg:col-span-5 relative">
            <div className="relative h-[480px] sm:h-[540px] lg:h-[580px]">
              {/* Global network visual */}
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
                    <Globe2 size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Network Coverage
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--fx-text-3)' }}>
                    Live
                  </span>
                </div>

                <div className="relative h-[210px] overflow-hidden">
                  {/* Stylised dotted globe */}
                  <svg
                    viewBox="0 0 400 210"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid slice"
                  >
                    <defs>
                      <radialGradient id="ibGlobeGrad" cx="50%" cy="50%" r="60%">
                        <stop offset="0%" stopColor="rgba(214,169,61,0.18)" />
                        <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                      </radialGradient>
                    </defs>
                    <rect width="400" height="210" fill="url(#ibGlobeGrad)" />
                    {/* longitude curves */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <ellipse
                        key={`lng-${i}`}
                        cx="200"
                        cy="105"
                        rx={140 - i * 8}
                        ry="98"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="0.8"
                      />
                    ))}
                    {/* latitude dotted lines */}
                    {[40, 80, 130, 170].map((y, i) => (
                      <line
                        key={`lat-${i}`}
                        x1="40"
                        y1={y}
                        x2="360"
                        y2={y}
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray="2 6"
                      />
                    ))}
                    {/* nodes */}
                    {[
                      [70, 70], [130, 50], [210, 75], [290, 55], [330, 110],
                      [110, 120], [180, 140], [250, 130], [310, 160], [80, 165],
                    ].map(([x, y], i) => (
                      <g key={`node-${i}`}>
                        <circle cx={x} cy={y} r="6" fill="rgba(214,169,61,0.18)" />
                        <circle cx={x} cy={y} r="2.5" fill="#ecc657" />
                      </g>
                    ))}
                    {/* connecting threads */}
                    {[
                      [70, 70, 210, 75],
                      [210, 75, 290, 55],
                      [290, 55, 330, 110],
                      [70, 70, 180, 140],
                      [180, 140, 250, 130],
                      [250, 130, 310, 160],
                    ].map(([x1, y1, x2, y2], i) => (
                      <line
                        key={`thr-${i}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="rgba(214,169,61,0.45)"
                        strokeWidth="0.9"
                      />
                    ))}
                  </svg>
                </div>

                {/* mini stat row inside the panel */}
                <div
                  className="grid grid-cols-3 gap-px"
                  style={{ borderTop: '1px solid var(--fx-line)', background: 'var(--fx-line)' }}
                >
                  {[
                    { label: 'Regions', value: '40+' },
                    { label: 'Partners', value: '1.2k' },
                    { label: 'Active', value: '24/7' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="text-center py-3"
                      style={{ background: 'var(--fx-bg-elev)' }}
                    >
                      <div className="text-sm font-extrabold gradient-text">{s.value}</div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating dashboard preview */}
              <div
                className="absolute left-0 bottom-0 w-[64%] glass-card p-4"
                style={{ animation: 'fxFloat 8s ease-in-out infinite 0.9s' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-gold-light)' }}>
                      Partner Dashboard
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--fx-text-3)' }}>
                    24h
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { icon: Users,      v: '482',    l: 'Traders' },
                    { icon: TrendingUp, v: '$1.4M',  l: 'Volume' },
                    { icon: BarChart3,  v: '+12.4%', l: 'Growth' },
                  ].map(({ icon: Icon, v, l }) => (
                    <div
                      key={l}
                      className="rounded-lg px-2 py-2 text-center"
                      style={{
                        background: 'rgba(214,169,61,0.05)',
                        border: '1px solid rgba(214,169,61,0.18)',
                      }}
                    >
                      <Icon size={12} className="mx-auto mb-1" style={{ color: 'var(--fx-gold-light)' }} />
                      <div className="text-[11px] font-bold text-white">{v}</div>
                      <div className="text-[9px] uppercase" style={{ color: 'var(--fx-text-3)' }}>
                        {l}
                      </div>
                    </div>
                  ))}
                </div>
                {/* mini sparkline */}
                <svg viewBox="0 0 200 36" className="w-full h-9" preserveAspectRatio="none">
                  <path
                    d="M0,28 L24,24 L48,22 L72,18 L96,20 L120,12 L144,14 L168,8 L200,4"
                    fill="none"
                    stroke="#ecc657"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              {/* Floating reward chip */}
              <div
                className="absolute right-0 top-[58%] px-4 py-3 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(74,222,128,0.18), rgba(74,222,128,0.04))',
                  border: '1px solid rgba(74,222,128,0.4)',
                  boxShadow: '0 8px 30px -10px rgba(74,222,128,0.4)',
                  animation: 'fxFloat 6s ease-in-out infinite 0.4s',
                }}
              >
                <div className="flex items-center gap-2">
                  <Handshake size={16} style={{ color: '#4ade80' }} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#4ade80' }}>
                      Performance-based
                    </div>
                    <div className="text-base font-bold text-white">Aligned rewards</div>
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
