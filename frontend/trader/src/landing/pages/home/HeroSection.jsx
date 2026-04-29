import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Zap, TrendingUp } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      {/* Decorative layers */}
      <div className="fx-grid-bg" aria-hidden="true" />
      <div className="fx-glow-gold" aria-hidden="true" />

      {/* Mandala backdrop — subtle, slowly rotating */}
      <div
        className="absolute pointer-events-none select-none opacity-[0.06] hidden md:block"
        style={{
          right: '-12%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(900px, 70vw)',
          height: 'min(900px, 70vw)',
        }}
        aria-hidden="true"
      >
        <img
          src="/images/fxartha-logo.png"
          alt=""
          className="w-full h-full object-contain fx-mandala-spin"
        />
      </div>

      <div className="fx-container relative z-10 pt-28 pb-20 md:pt-36 md:pb-28 lg:pt-44 lg:pb-36">
        <div className="max-w-3xl">
          <p className="fx-eyebrow fx-fade-up">
            FXArtha — Forex &amp; CFD Brokerage
          </p>

          <h1 className="fx-headline mt-6 text-[40px] sm:text-[52px] md:text-[64px] lg:text-[76px] xl:text-[84px] fx-fade-up fx-fade-up-d1">
            Trade with{' '}
            <span className="fx-gold-text">intelligence.</span>
            <br />
            Trade with <span className="fx-gold-text">Artha.</span>
          </h1>

          <p
            className="mt-6 md:mt-8 max-w-2xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
            style={{ color: 'var(--fx-text-2)' }}
          >
            Institutional-grade execution, raw spreads from 0.0 pips, and a trading
            terminal built for serious traders. Forex, indices, commodities, and
            crypto — one platform, one account.
          </p>

          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
            <Link to="/auth/register" className="fx-btn-primary justify-center">
              Open Live Account
              <ArrowRight size={18} />
            </Link>
            <Link to="/accounts/demo" className="fx-btn-ghost justify-center">
              Try Free Demo
            </Link>
          </div>

          {/* Trust strip */}
          <ul className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 fx-fade-up fx-fade-up-d4">
            <TrustItem
              icon={Zap}
              title="< 30 ms execution"
              sub="Co-located matching engine"
            />
            <TrustItem
              icon={ShieldCheck}
              title="Segregated funds"
              sub="Tier-1 banking partners"
            />
            <TrustItem
              icon={TrendingUp}
              title="0.0 pip spreads"
              sub="On EUR/USD, GBP/USD, USD/JPY"
            />
          </ul>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, var(--fx-bg))' }}
        aria-hidden="true"
      />
    </section>
  )
}

function TrustItem({ icon: Icon, title, sub }) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: 'var(--fx-gold-soft)',
          border: '1px solid rgba(214,169,61,0.25)',
        }}
      >
        <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--fx-text)' }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--fx-text-3)' }}>
          {sub}
        </p>
      </div>
    </li>
  )
}
