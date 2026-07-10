'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Crown } from 'lucide-react'

export default function CtHero() {
  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center"
      style={{
        backgroundColor: 'var(--fx-bg)',
        backgroundImage: "url('/images/copy_trading_bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for text legibility */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,9,11,0.55) 0%, rgba(8,9,11,0.78) 100%), radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%)',
        }}
      />
      <div className="fx-container relative z-10 w-full pt-28 md:pt-32 lg:pt-36 pb-16 md:pb-20">
        <div className="max-w-3xl">
          <h1 className="fx-headline text-[28px] sm:text-[46px] md:text-[54px] lg:text-[60px] xl:text-[68px] fx-fade-up fx-fade-up-d1">
            Copy Top Traders. <br />
            <span className="fx-gold-text">Trade Smarter.</span>
          </h1>
          <p
            className="mt-5 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
            style={{ color: 'var(--fx-text-2)' }}
          >
            Automatically copy the trades of verified Master Traders, or prove your own
            performance and become one. Either side — you stay in full control.
          </p>
          <p
            className="mt-4 text-sm md:text-base font-semibold fx-fade-up fx-fade-up-d2"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            Performance earns trust. Not promises.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
            <Link to="#explore" className="fx-btn-primary justify-center">
              Explore Traders
              <ArrowRight size={18} />
            </Link>
            <Link to="#master" className="fx-btn-ghost justify-center">
              <Crown size={16} />
              Become a Master Trader
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
