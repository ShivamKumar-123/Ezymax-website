'use client'

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function AbHero() {
  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center"
      style={{ backgroundColor: 'var(--fx-bg)' }}
    >
      {/* Background banner */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-no-repeat bg-center bg-cover"
        style={{ backgroundImage: 'url(/images/About_hero.png)' }}
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
      <div className="fx-container relative z-10 w-full pt-28 md:pt-32 lg:pt-36 pb-10 md:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <h1 className="fx-headline text-[26px] sm:text-[42px] md:text-[50px] lg:text-[56px] xl:text-[62px] fx-fade-up fx-fade-up-d1">
              Reimagining How Modern <br />
              <span className="fx-gold-text">Trading Works.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              FX Artha is building a next-generation trading ecosystem powered by smart
              contract infrastructure, transparent settlement systems, and trader-focused
              innovation.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d4">
              <Link to="#ecosystem" className="fx-btn-primary justify-center">
                Explore Ecosystem
                <ArrowRight size={18} />
              </Link>
              <Link to="/auth/register" className="fx-btn-ghost justify-center">
                Start Trading
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
