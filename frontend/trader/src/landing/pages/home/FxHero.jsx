'use client'

import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Eye,
  Wallet,
  TrendingUp,
  LineChart,
  Lock,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const trustBadges = [
  { icon: ShieldCheck, label: 'Non-Custodial' },
  { icon: Zap, label: 'Instant Settlement' },
  { icon: Eye, label: 'Transparent' },
  { icon: Wallet, label: 'No Withdrawal Delays' },
]

export default function FxHero() {
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

      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-20 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center lg:min-h-[600px]">
          {/* ── Left: copy + CTAs ──────────────────────────────── */}
          <div className="lg:col-span-7">
            <div className="fx-fade-up mb-6">
              <span className="badge">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                />
                Smart-Contract Trading
              </span>
            </div>

            <h1 className="fx-headline text-[28px] sm:text-[52px] md:text-[60px] lg:text-[68px] xl:text-[76px] fx-fade-up fx-fade-up-d1">
              Trade Without Giving Your Money to{' '}
              <span className="fx-gold-text">Any Broker</span>
            </h1>

            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Your funds move through a secure smart contract — not into a broker&apos;s account.
              You control access. The system handles execution.
            </p>

            <div className="mt-6 fx-fade-up fx-fade-up-d2">
              <span
                className="inline-block text-sm md:text-base font-semibold tracking-wide"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                Your Money. Your Wallet. Your Control.
              </span>
            </div>

            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="/auth/register" className="fx-btn-primary justify-center">
                Start Trading
                <ArrowRight size={18} />
              </Link>
              <Link to="#how-it-works" className="fx-btn-ghost justify-center">
                How It Works
              </Link>
            </div>

            {/* ── Trust badges row ─────────────────────────────── */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 fx-fade-up fx-fade-up-d4">
              {trustBadges.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(214,169,61,0.06)',
                    border: '1px solid rgba(214,169,61,0.22)',
                  }}
                >
                  <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--fx-text-2)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm fx-fade-up fx-fade-up-d4" style={{ color: 'var(--fx-text-3)' }}>
              No hidden control. No manual interference. Everything runs on system logic.
            </p>
          </div>

          {/* ── Right: floating UI composition ──────────────────── */}
          <div className="lg:col-span-5 relative">
            <div className="relative h-[460px] sm:h-[520px] lg:h-[560px]">
              {/* Trading chart card */}
              <div
                className="absolute top-0 right-0 w-[88%] glass-card p-5"
                style={{ animation: 'fxFloat 7s ease-in-out infinite' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="feature-icon" style={{ width: 36, height: 36 }}>
                      <LineChart size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">BTC / USD</div>
                      <div className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
                        Live
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">68,432.50</div>
                    <div className="text-xs font-semibold" style={{ color: '#4ade80' }}>
                      +2.41%
                    </div>
                  </div>
                </div>
                {/* SVG sparkline */}
                <svg viewBox="0 0 280 100" className="w-full h-24" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="fxHeroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(214,169,61,0.45)" />
                      <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,72 L24,60 L52,68 L82,42 L114,50 L144,30 L172,40 L204,22 L236,30 L264,12 L280,18 L280,100 L0,100 Z"
                    fill="url(#fxHeroSpark)"
                  />
                  <path
                    d="M0,72 L24,60 L52,68 L82,42 L114,50 L144,30 L172,40 L204,22 L236,30 L264,12 L280,18"
                    fill="none"
                    stroke="#ecc657"
                    strokeWidth="1.75"
                  />
                </svg>
              </div>

              {/* Wallet / smart-contract shield card */}
              <div
                className="absolute left-0 top-[58%] w-[68%] glass-card p-5"
                style={{ animation: 'fxFloat 8s ease-in-out infinite 1.2s' }}
              >
                <div className="flex items-center gap-3">
                  <div className="feature-icon">
                    <Lock size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--fx-gold-light)' }}>
                      Smart Contract
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      0xa4f3…91c2
                    </div>
                  </div>
                </div>
                <div
                  className="mt-3 pt-3 flex justify-between items-center"
                  style={{ borderTop: '1px solid var(--fx-line)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
                    Balance
                  </span>
                  <span className="text-sm font-bold text-white">12,480.00 USDT</span>
                </div>
              </div>

              {/* Profit pill */}
              <div
                className="absolute right-2 bottom-6 px-4 py-3 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(74,222,128,0.18), rgba(74,222,128,0.04))',
                  border: '1px solid rgba(74,222,128,0.4)',
                  boxShadow: '0 8px 30px -10px rgba(74,222,128,0.4)',
                  animation: 'fxFloat 6s ease-in-out infinite 0.4s',
                }}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} style={{ color: '#4ade80' }} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#4ade80' }}>
                      Auto Settled
                    </div>
                    <div className="text-base font-bold text-white">+$120.00</div>
                  </div>
                </div>
              </div>

              {/* Decorative glow */}
              <div
                className="absolute inset-0 -z-10 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(50% 50% at 50% 50%, rgba(214,169,61,0.16), transparent 70%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
