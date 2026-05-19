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
            <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[60px] lg:text-[64px] xl:text-[72px] fx-fade-up fx-fade-up-d1">
              A trading platform that <br />
              <span className="fx-gold-text">doesn't hold your money.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Almost every broker out there takes your deposit and sits on it. We don't.
              Your funds stay in a smart contract you can verify, and we just run the trading
              side on top of that.
            </p>

            <p
              className="mt-5 max-w-xl text-sm md:text-base leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-3)' }}
            >
              What that gets you:
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

            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d4">
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
