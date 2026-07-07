'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import TickerTape from '@/landing/components/TickerTape'
import SmokeRevealBg from '@/landing/components/SmokeRevealBg'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function HeroSection() {
  const router = useRouter()
  const demoLogin = useAuthStore((s) => s.demoLogin)
  const [demoLoading, setDemoLoading] = useState(false)

  const handleDemo = async () => {
    setDemoLoading(true)
    try {
      await demoLogin()
      toast.success('Welcome — demo account')
      router.push('/accounts')
    } catch (err) {
      toast.error(err?.message || 'Demo sign-in failed')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--fx-bg)',
        backgroundImage: "url('/images/hero_bg1.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Smoke-reveal background — hover anywhere to wipe the top image
          (reaveal1) and reveal the bottom one (reaveal2), with rising smoke.
          It fills the whole hero and heals back after a couple of seconds. */}
      <SmokeRevealBg topImage="/images/reaveal1.png" bottomImage="/images/reaveal2.png" />

      {/* Legibility scrim so the headline + CTAs stay readable over the images.
          pointer-events:none so it never blocks the reveal underneath. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,9,11,0.82) 0%, rgba(8,9,11,0.55) 38%, rgba(8,9,11,0.15) 70%, rgba(8,9,11,0) 100%)',
        }}
      />

      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-10 md:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center lg:min-h-[560px]">
          {/* ── Left: copy + CTAs ─────────────────────────────────── */}
          <div className="lg:col-span-7 xl:col-span-7">
            <h1 className="fx-headline text-[44px] sm:text-[56px] md:text-[64px] lg:text-[72px] xl:text-[82px] fx-fade-up">
              Trade Globally
              <br />
              <span className="fx-gold-text">Prosper Limitlessly</span>
            </h1>

            <p
              className="mt-5 md:mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d1"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Experience next-level trading with ARTHA FX where technology
              meets opportunity.
            </p>

            <div className="mt-10 md:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="/auth/register" className="fx-btn-primary justify-center">
                Open Live Account
                <ArrowRight size={18} />
              </Link>
              <button
                type="button"
                onClick={handleDemo}
                disabled={demoLoading}
                className="fx-btn-ghost justify-center disabled:opacity-60"
              >
                {demoLoading ? <Loader2 size={16} className="animate-spin" /> : 'Try Demo Account'}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Live ticker — sits flush at the bottom of the hero */}
      <div className="relative z-10">
        <TickerTape />
      </div>
    </section>
  )
}
