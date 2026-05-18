import {
  BarChart3,
  Users,
  Activity,
  Coins,
  TrendingUp,
  History,
  Globe2,
  Eye,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const widgets = [
  { icon: Users,      title: 'User Analytics',       value: '482',     sub: 'Active traders'  },
  { icon: Activity,   title: 'Trading Volume',       value: '$1.42M',  sub: '7-day rolling'   },
  { icon: Coins,      title: 'Reward Tracking',      value: '$8,940',  sub: 'This month'      },
  { icon: TrendingUp, title: 'Performance Overview', value: '+12.4%',  sub: 'vs last period'  },
  { icon: Eye,        title: 'Referral Monitoring',  value: 'Live',    sub: 'Real-time view'  },
  { icon: History,    title: 'Commission History',   value: '36 mo.',  sub: 'Full timeline'   },
]

const faq = [
  { q: 'Can I track my network in real time?', a: 'Yes, through the IB dashboard.' },
  { q: 'Can I manage multiple communities?',   a: 'Yes, depending on partnership structure.' },
]

export default function IbDashboard() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Dashboard Preview"
          title="Built for Professional Partners"
          highlight="Professional Partners"
          subtitle="Professional tools for serious growth — real-time visibility into your network performance."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 rounded-2xl overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
              border: '1px solid rgba(214,169,61,0.32)',
              boxShadow: '0 30px 70px -30px rgba(214,169,61,0.30)',
            }}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-6 md:px-7 py-4"
              style={{
                borderBottom: '1px solid var(--fx-line)',
                background: 'rgba(214,169,61,0.04)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="feature-icon" style={{ width: 40, height: 40 }}>
                  <BarChart3 size={18} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                    Partner Console
                  </div>
                  <div className="text-sm font-bold text-white">IB Dashboard · Preview</div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.7)' }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4ade80' }}>
                  Live
                </span>
              </div>
            </div>

            <div className="p-5 md:p-7 grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Volume chart card */}
              <div
                className="lg:col-span-2 rounded-2xl p-5 md:p-6"
                style={{
                  background: 'var(--fx-bg)',
                  border: '1px solid var(--fx-line-strong)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                      Volume · 30d
                    </span>
                  </div>
                  <span className="text-sm font-extrabold gradient-text">$1.42M</span>
                </div>
                <svg viewBox="0 0 600 140" className="w-full h-32" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="ibDashSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(214,169,61,0.40)" />
                      <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                    </linearGradient>
                  </defs>
                  {/* baseline grid */}
                  {[28, 56, 84, 112].map((y) => (
                    <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="rgba(255,255,255,0.04)" />
                  ))}
                  <path
                    d="M0,110 L40,98 L80,104 L120,86 L160,90 L200,72 L240,76 L280,58 L320,64 L360,46 L400,52 L440,36 L480,40 L520,24 L560,30 L600,16 L600,140 L0,140 Z"
                    fill="url(#ibDashSpark)"
                  />
                  <path
                    d="M0,110 L40,98 L80,104 L120,86 L160,90 L200,72 L240,76 L280,58 L320,64 L360,46 L400,52 L440,36 L480,40 L520,24 L560,30 L600,16"
                    fill="none"
                    stroke="#ecc657"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>

              {/* Geography map */}
              <div
                className="rounded-2xl p-5 md:p-6"
                style={{
                  background: 'var(--fx-bg)',
                  border: '1px solid var(--fx-line-strong)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe2 size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                      Geography
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white">12 regions</span>
                </div>
                <svg viewBox="0 0 220 130" className="w-full h-32" preserveAspectRatio="xMidYMid meet">
                  {[0, 1, 2].map((i) => (
                    <ellipse
                      key={i}
                      cx="110"
                      cy="65"
                      rx={88 - i * 14}
                      ry={56 - i * 8}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                    />
                  ))}
                  {[
                    [44, 36], [72, 28], [110, 48], [148, 32], [180, 60],
                    [56, 80], [96, 92], [140, 86], [176, 100],
                  ].map(([x, y], i) => (
                    <g key={i}>
                      <circle cx={x} cy={y} r="5" fill="rgba(214,169,61,0.18)" />
                      <circle cx={x} cy={y} r="2" fill="#ecc657" />
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Widget grid */}
            <div
              className="px-5 md:px-7 pb-7 grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
            >
              {widgets.map((w) => {
                const Icon = w.icon
                return (
                  <div
                    key={w.title}
                    className="rounded-xl p-4"
                    style={{
                      background: 'var(--fx-bg)',
                      border: '1px solid var(--fx-line-strong)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'rgba(214,169,61,0.08)',
                          border: '1px solid rgba(214,169,61,0.22)',
                        }}
                      >
                        <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                        {w.sub}
                      </span>
                    </div>
                    <div className="text-base md:text-lg font-extrabold text-white">{w.value}</div>
                    <div className="text-[11px]" style={{ color: 'var(--fx-text-2)' }}>
                      {w.title}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
