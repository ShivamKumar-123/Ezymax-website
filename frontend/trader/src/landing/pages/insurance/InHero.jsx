'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, CalendarDays, BadgePercent, Zap, Smile } from 'lucide-react'

const features = [
  { icon: CalendarDays,  title: 'Flexible Plans',     sub: 'Daily, Weekly, Monthly' },
  { icon: BadgePercent,  title: 'Smart Protection',   sub: 'Up to 50% coverage levels' },
  { icon: Zap,           title: 'Automatic Coverage', sub: 'Applied to eligible losses' },
  { icon: Smile,         title: 'Peace of Mind',      sub: 'Focus on trading, we manage the risk' },
]

export default function InHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: 'var(--fx-bg)' }}
    >
      {/* Background banner */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-no-repeat bg-center bg-cover"
        style={{ backgroundImage: 'url(/images/banner2.png)' }}
      />
      {/* Dark overlay for text readability */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,10,14,0.55) 0%, rgba(8,10,14,0.75) 100%), radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%), radial-gradient(40% 40% at 15% 90%, rgba(96,165,250,0.08) 0%, rgba(96,165,250,0) 60%)',
        }}
      />
      <div className="fx-grid-bg" />
      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-10 md:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-6">
            <div className="fx-fade-up mb-5">
              <span className="badge">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                />
                Trade Insurance
              </span>
            </div>
            <h1 className="fx-headline text-[32px] sm:text-[40px] md:text-[48px] lg:text-[52px] xl:text-[58px] fx-fade-up fx-fade-up-d1">
              Trade With <br />
              <span className="fx-gold-text">Built-In Protection.</span>
            </h1>
            <p
              className="mt-5 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Pick a coverage plan and stay protected across all your trading activity.
              Clear rules, no surprises — just structured risk control that works in the background.
            </p>
            <p
              className="mt-4 text-sm md:text-base font-semibold fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-gold-light)' }}
            >
              Flexible coverage. Controlled risk. Smarter trading.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="#coverage" className="fx-btn-primary justify-center">
                Explore Plans
                <ArrowRight size={18} />
              </Link>
              <Link to="/auth/register" className="fx-btn-ghost justify-center">
                <ShieldCheck size={16} />
                Activate Protection
              </Link>
            </div>
          </div>

          {/* RIGHT — Shield + feature badges */}
          <div className="lg:col-span-6 relative">
            <div className="relative h-full min-h-[360px] flex items-center justify-center">
              {/* Glow halo */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(40% 50% at 50% 50%, rgba(214,169,61,0.35) 0%, rgba(214,169,61,0) 70%)',
                }}
              />

              {/* Floating feature badges grid */}
              <div className="relative grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-md fx-fade-up fx-fade-up-d2">
                {features.map(({ icon: Icon, title, sub }, idx) => (
                  <div
                    key={title}
                    className="rounded-xl p-3 sm:p-4 flex items-start gap-2.5"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0.03) 100%), rgba(15,17,21,0.65)',
                      border: '1px solid rgba(214,169,61,0.32)',
                      backdropFilter: 'blur(6px)',
                      boxShadow: '0 18px 40px -22px rgba(214,169,61,0.30)',
                      animation: `fxFloat ${6 + (idx % 2)}s ease-in-out infinite${idx % 2 ? ' reverse' : ''}`,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(214,169,61,0.18)',
                        border: '1px solid rgba(214,169,61,0.40)',
                      }}
                    >
                      <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] sm:text-[13px] font-bold text-white leading-tight">
                        {title}
                      </div>
                      <div
                        className="text-[10px] sm:text-[11px] leading-tight mt-1"
                        style={{ color: 'var(--fx-text-3)' }}
                      >
                        {sub}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Central shield */}
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden lg:flex w-24 h-24 rounded-2xl items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, var(--fx-gold-light), var(--fx-gold))',
                  boxShadow:
                    '0 0 0 8px rgba(214,169,61,0.10), 0 30px 60px -20px rgba(214,169,61,0.55)',
                  animation: 'fxFloat 6s ease-in-out infinite',
                }}
              >
                <ShieldCheck size={42} style={{ color: '#1a1408' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
