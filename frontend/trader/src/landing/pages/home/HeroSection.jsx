import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Zap,
  Shield,
  Headphones,
  TrendingUp,
  Award,
  ShieldCheck,
} from 'lucide-react'

const featurePills = [
  { icon: TrendingUp, title: 'Tight Spreads',     sub: 'From 0.0 pips' },
  { icon: Zap,        title: 'Lightning Fast',    sub: 'Execution' },
  { icon: Shield,     title: 'Secure & Trusted',  sub: 'Global Standard' },
  { icon: Headphones, title: '24/7 Support',      sub: 'Always Here' },
]

const trustBadges = [
  { icon: Award,       title: 'Trusted by',           sub: '100K+ Traders Worldwide' },
  { icon: ShieldCheck, title: 'Secure Funds',         sub: 'Segregated Client Accounts' },
  { icon: Award,       title: 'Award Winning',        sub: 'Forex Brokerage Platform' },
]

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-grid-bg" aria-hidden="true" />
      <div className="fx-glow-gold" aria-hidden="true" />

      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-16 md:pb-20">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT — text + CTAs */}
          <div className="lg:col-span-7">
            <h1 className="fx-headline text-[44px] sm:text-[56px] md:text-[64px] lg:text-[72px] xl:text-[82px] fx-fade-up">
              Trade Globally
              <br />
              <span className="fx-gold-text">Prosper Limitlessly</span>
            </h1>

            <p
              className="mt-5 md:mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d1"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Experience next-level trading with FXArtha — where institutional
              technology meets the opportunity of global markets.
            </p>

            {/* Feature pills row */}
            <ul className="mt-7 md:mt-8 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 fx-fade-up fx-fade-up-d2">
              {featurePills.map(({ icon: Icon, title, sub }) => (
                <li key={title} className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      background: 'var(--fx-gold-soft)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <Icon size={15} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-[13px] font-semibold leading-tight" style={{ color: 'var(--fx-text)' }}>
                      {title}
                    </p>
                    <p className="text-[11px] md:text-xs leading-tight" style={{ color: 'var(--fx-text-3)' }}>
                      {sub}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="/auth/register" className="fx-btn-primary justify-center">
                Open Live Account
                <ArrowRight size={18} />
              </Link>
              <Link to="/accounts/demo" className="fx-btn-ghost justify-center">
                Try Demo Account
              </Link>
            </div>

            {/* Trust badges */}
            <ul className="mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 fx-fade-up fx-fade-up-d4">
              {trustBadges.map(({ icon: Icon, title, sub }) => (
                <li key={title} className="flex items-center gap-3">
                  <Icon size={22} style={{ color: 'var(--fx-gold-light)' }} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs md:text-[13px] font-semibold leading-tight" style={{ color: 'var(--fx-text)' }}>
                      {title}
                    </p>
                    <p className="text-[11px] md:text-xs leading-tight" style={{ color: 'var(--fx-text-3)' }}>
                      {sub}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — hero visual (oversized mandala + glow) */}
          <div className="lg:col-span-5 relative hidden md:block">
            <div className="relative aspect-square w-full max-w-[560px] mx-auto">
              {/* Glow halo */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(closest-side, rgba(214,169,61,0.35) 0%, rgba(214,169,61,0.08) 45%, transparent 70%)',
                  filter: 'blur(20px)',
                }}
                aria-hidden="true"
              />
              {/* Outer rotating mandala */}
              <img
                src="/images/fxartha-logo.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-contain fx-mandala-spin opacity-90"
              />
              {/* Floating currency badges */}
              <FloatingBadge
                label="$"
                color="#22c55e"
                style={{ top: '6%', left: '52%', width: 78, height: 78 }}
              />
              <FloatingBadge
                label="€"
                color="#eab308"
                style={{ top: '36%', left: '8%', width: 68, height: 68 }}
              />
              <FloatingBadge
                label="£"
                color="#3b82f6"
                style={{ top: '46%', right: '4%', width: 78, height: 78 }}
              />
              <FloatingBadge
                label="¥"
                color="#f97316"
                style={{ bottom: '8%', right: '14%', width: 64, height: 64 }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, var(--fx-bg))' }}
        aria-hidden="true"
      />
    </section>
  )
}

function FloatingBadge({ label, color, style }) {
  return (
    <div
      className="absolute rounded-full flex items-center justify-center font-bold text-2xl select-none"
      style={{
        ...style,
        background: 'rgba(15, 15, 18, 0.85)',
        border: `2px solid ${color}`,
        color,
        boxShadow: `0 0 24px ${color}33, inset 0 0 18px ${color}22`,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fxFloat 6s ease-in-out infinite',
      }}
    >
      {label}
    </div>
  )
}
