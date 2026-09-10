import { Search, Palette, Code2, FlaskConical, Rocket, ArrowRight } from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = { title: 'How It Works — From Requirement to Live Platform — SetupFX' }

/**
 * Delivery process, rewritten from setupfx24.com.
 *
 * This page used to walk a retail trader through opening an account, funding
 * it and placing a first trade. The journey that matters to this business is
 * a client's project: scoping, branding, build, UAT, go-live.
 */

const STEPS = [
  {
    n: '01',
    icon: Search,
    title: 'Discovery & scoping',
    desc: 'We map your business model, markets, instruments and revenue structure, then turn it into a technical scope.',
  },
  {
    n: '02',
    icon: Palette,
    title: 'Branding & configuration',
    desc: 'Your identity applied across terminal, admin, apps and emails. Trading rules and commercials configured.',
  },
  {
    n: '03',
    icon: Code2,
    title: 'Development & integration',
    desc: 'Core build plus payment, KYC, liquidity and CRM connections. Progress demos, not silence.',
  },
  {
    n: '04',
    icon: FlaskConical,
    title: 'Testing & UAT',
    desc: 'Functional testing, load testing and a full acceptance round with your team before any real client sees it.',
  },
  {
    n: '05',
    icon: Rocket,
    title: 'Go live & support',
    desc: 'Deployment, staff training, documentation handover — then continuous monitoring and support.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E94E1B] mb-5">Process</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            From requirement to<br />
            <span className="text-[#E94E1B]">live platform in five steps</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            No mystery phase where nothing is heard for weeks. You see the build as it happens.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <ol className="relative">
            {STEPS.map(({ n, icon: Icon, title, desc }, i) => (
              <li key={n} className="relative flex gap-6 pb-12 last:pb-0">
                {/* connector */}
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="absolute left-7 top-16 bottom-0 w-px bg-gray-200" />
                )}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 bg-[#FCE6DD] rounded-2xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#E94E1B]" />
                  </div>
                </div>
                <div className="pt-1.5 min-w-0">
                  <div className="text-xs font-semibold text-gray-300 mb-1">{n}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Ready to start?</h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Tell us your business model and target market. We&rsquo;ll show you the platform
            that fits and give you a straight answer on scope and timeline.
          </p>
          <a href="/contact" className="inline-flex items-center gap-2 bg-[#E94E1B] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
            Book a free demo <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}
