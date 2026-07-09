'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Eye, Wallet, Cpu, Network } from 'lucide-react'

const pillars = [
  { icon: Eye,     label: 'Trading becomes more transparent' },
  { icon: Wallet,  label: 'Users gain greater control' },
  { icon: Cpu,     label: 'Technology improves trust' },
  { icon: Network, label: 'Modern infrastructure replaces outdated systems' },
]

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

            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl fx-fade-up fx-fade-up-d3">
              {pillars.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(214,169,61,0.05)',
                    border: '1px solid rgba(214,169,61,0.22)',
                  }}
                >
                  <Icon size={14} style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-xs md:text-sm" style={{ color: 'var(--fx-text-2)' }}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>

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
