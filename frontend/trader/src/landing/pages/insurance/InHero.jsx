'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'

export default function InHero() {
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
            <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[60px] lg:text-[68px] xl:text-[76px] fx-fade-up fx-fade-up-d1">
              A cushion on <br />
              <span className="fx-gold-text">your losing trades.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Pick a plan, set how much of each loss you want covered, and trade. When a
              qualifying trade goes against you, part of the loss comes back to your account.
              The plan runs until you use it up or the timer ends.
            </p>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="#coverage" className="fx-btn-primary justify-center">
                Explore Plans
                <ArrowRight size={18} />
              </Link>
              <Link to="/auth/register" className="fx-btn-ghost justify-center">
                <ShieldCheck size={16} />
                Activate Protection
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
