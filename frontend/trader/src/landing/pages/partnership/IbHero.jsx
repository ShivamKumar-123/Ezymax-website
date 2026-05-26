'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Handshake } from 'lucide-react'

export default function IbHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: 'var(--fx-bg)' }}
    >
      {/* Background banner */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-no-repeat bg-center bg-cover"
        style={{ backgroundImage: 'url(/images/banner2.png)' }}
      />
      {/* Dark overlay for text readability */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,10,14,0.55) 0%, rgba(8,10,14,0.75) 100%), radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%), radial-gradient(40% 40% at 15% 90%, rgba(96,165,250,0.08) 0%, rgba(96,165,250,0) 60%)',
        }}
      />
      <div className="fx-grid-bg" />
      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-8 md:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[60px] lg:text-[66px] xl:text-[72px] fx-fade-up fx-fade-up-d1">
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
