'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Handshake } from 'lucide-react'

export default function IbHero() {
  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center"
      style={{ backgroundColor: 'var(--fx-bg)' }}
    >
      {/* Background banner */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-no-repeat bg-center bg-cover"
        style={{ backgroundImage: 'url(/images/Partnership_hero.png)' }}
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
        <div className="max-w-3xl">
          {/* LEFT */}
          <div>
            <h1 className="fx-headline text-[28px] sm:text-[52px] md:text-[60px] lg:text-[66px] xl:text-[72px] fx-fade-up fx-fade-up-d1">
              Partner With FX Artha. <br />
              <span className="fx-gold-text">Build Your Trading Business.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              If you already work with traders — a community, a school, a signal group — you
              can plug FX Artha into what you're doing and earn a share of the activity your
              people generate.
            </p>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="#apply" className="fx-btn-primary justify-center">
                Apply as IB
                <ArrowRight size={18} />
              </Link>
              <Link to="/company/contact" className="fx-btn-ghost justify-center">
                <Handshake size={16} />
                Talk to Partnership Team
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
