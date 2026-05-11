'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import TickerTape from '@/landing/components/TickerTape'
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
