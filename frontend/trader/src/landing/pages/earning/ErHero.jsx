'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Gift } from 'lucide-react'

export default function ErHero() {
  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center"
      style={{ backgroundColor: 'var(--fx-bg)' }}
    >
      {/* Background banner */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-no-repeat bg-center bg-cover"
        style={{ backgroundImage: 'url(/images/Earning_hero.png)' }}
      />
      {/* Dark overlay for text readability */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,10,14,0.55) 0%, rgba(8,10,14,0.78) 100%), radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%)',
        }}
      />
      <div className="fx-container relative z-10 w-full pt-28 md:pt-32 lg:pt-36 pb-8 md:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <h1 className="fx-headline text-[28px] sm:text-[52px] md:text-[60px] lg:text-[68px] xl:text-[76px] fx-fade-up fx-fade-up-d1">
              Earn Beyond <br />
              <span className="fx-gold-text">Trading.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Your activity on FX Artha turns into rewards, progression, and real benefits.
            </p>
            <p
              className="mt-4 text-sm md:text-base font-semibold fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-gold-light)' }}
            >
              Trade. Engage. Progress. Earn.
            </p>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="/auth/register" className="fx-btn-primary justify-center">
                Start Earning
                <ArrowRight size={18} />
              </Link>
              <Link to="#rewards" className="fx-btn-ghost justify-center">
                <Gift size={16} />
                Explore Rewards
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
