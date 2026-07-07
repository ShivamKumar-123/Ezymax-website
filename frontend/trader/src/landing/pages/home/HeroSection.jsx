'use client'

import TickerTape from '@/landing/components/TickerTape'
import SmokeRevealBg from '@/landing/components/SmokeRevealBg'

export default function HeroSection() {
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

      {/* Legibility scrim so the headline stays readable over the images.
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
          {/* ── Left: copy ────────────────────────────────────────── */}
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
