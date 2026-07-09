'use client'

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function TxHero() {
  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center"
      style={{
        backgroundColor: 'var(--fx-bg)',
        backgroundImage: "url('/images/trading_hero.png')",
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
          <h1 className="fx-headline text-[28px] sm:text-[44px] md:text-[52px] lg:text-[56px] xl:text-[64px] fx-fade-up fx-fade-up-d1">
            Trade Smart. <br />
            <span className="fx-gold-text">Pay Less Over Time.</span>
          </h1>
          <p
            className="mt-5 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
            style={{ color: 'var(--fx-text-2)' }}
          >
            A transparent trading system where your costs improve as you grow.
            No hidden fees. No swap charges. Just fair trading, built for you.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
            <Link to="/auth/register" className="fx-btn-primary justify-center">
              Start Trading
              <ArrowRight size={18} />
            </Link>
            <Link to="#how-it-works" className="fx-btn-ghost justify-center">
              See How It Works
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
