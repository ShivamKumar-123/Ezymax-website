import {
  Monitor, LayoutDashboard, ShieldAlert, UserCircle, BarChart3, Palette,
  Globe, Building2, BrainCircuit, Check, ArrowRight, Info,
} from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = { title: 'Trading Platforms — Forex, Indian Market & Prop Firm Software — SetupFX' }

/**
 * Platforms page, rewritten from setupfx24.com.
 *
 * This described the platforms as things a visitor would TRADE on — "trade
 * from anywhere", spreads, account types. Here the visitor is a brokerage or
 * prop firm evaluating what to license, so the page describes what ships,
 * what it is built for, and how the three compare.
 */

const PLATFORMS = [
  {
    icon: Globe,
    kicker: 'Global Markets',
    name: 'Global Trading Platform',
    desc: 'A complete multi-asset forex trading platform for brokerages operating in international markets.',
    tags: ['Liquidity Bridge', 'MAM/PAMM', 'Copy Trading'],
  },
  {
    icon: Building2,
    kicker: 'Indian Exchanges',
    name: 'Global Prop Firm Platform',
    desc: 'A trading application built for Indian market participants, aligned with domestic exchange workflows.',
    tags: ['Equity & F&O', 'RMS', 'Back Office'],
  },
  {
    icon: BrainCircuit,
    kicker: 'AI & Algorithmic Trading',
    name: 'AI Trading Platform',
    desc: 'Build AI-driven strategies and run them as live algorithms — research, backtest and automate execution under your own brand.',
    tags: ['AI Strategy Builder', 'Algo Trading', 'Backtesting'],
  },
]

const CORE = [
  { n: '01', icon: Monitor, title: 'Trading terminal', desc: 'Web and mobile. Charting, order entry, positions and account history.' },
  { n: '02', icon: LayoutDashboard, title: 'Admin back office', desc: 'Users, funds, risk parameters, reports and audit logs in one console.' },
  { n: '03', icon: ShieldAlert, title: 'Risk engine', desc: 'Real-time exposure, limits and automated controls that run without supervision.' },
  { n: '04', icon: UserCircle, title: 'Client portal', desc: 'Onboarding, KYC upload, deposits, withdrawals and statements.' },
  { n: '05', icon: BarChart3, title: 'Reporting suite', desc: 'Trade, revenue, exposure and performance dashboards.' },
  { n: '06', icon: Palette, title: 'White-label branding', desc: 'Your logo, colours, domain and app listings. Nothing points back to us.' },
]

const COMPARE: { feature: string; cells: (string | boolean)[] }[] = [
  { feature: 'Best for', cells: ['Brokerages', 'Funded-trader firms', 'Automated and systematic desks'] },
  { feature: 'Markets', cells: ['FX, metals, indices, commodities, crypto CFDs', 'Equity, F&O, currency, commodity', 'Whichever venue you are authorised to use'] },
  { feature: 'Challenge engine', cells: [false, true, false] },
  { feature: 'Liquidity bridge', cells: [true, false, 'Optional'] },
  { feature: 'AI strategy builder', cells: [false, false, true] },
  { feature: 'Algorithmic execution', cells: [false, false, true] },
  { feature: 'Copy trading', cells: [true, true, true] },
  { feature: 'IB / affiliate', cells: [true, true, true] },
  { feature: 'Mobile apps', cells: [true, true, true] },
  { feature: 'White-label', cells: [true, true, true] },
]

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="w-4 h-4 text-[#E94E1B] mx-auto" />
  if (v === false) return <span className="text-gray-300">—</span>
  return <span>{v}</span>
}

export default function PlatformsPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E94E1B] mb-5">
            Flagship platforms
          </p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Trading platforms,<br />
            <span className="text-[#E94E1B]">built and branded as yours</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Complete systems — terminal, back office, risk engine and reporting.
            Deployed under your name, configured to your business model.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="/contact" className="inline-flex items-center gap-2 bg-[#E94E1B] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
              Book a free demo <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#compare" className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition">
              Compare platforms
            </a>
          </div>
        </div>
      </section>

      {/* The platforms */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Our products</p>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Three platforms. One technology partner.</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Each one is a full system, not a template. Run one, or several under a single brand.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {PLATFORMS.map(({ icon: Icon, kicker, name, desc, tags }) => (
              <div key={name} className="rounded-2xl border border-gray-200 p-7 flex flex-col">
                <div className="w-12 h-12 bg-[#FCE6DD] rounded-xl flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#E94E1B]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{kicker}</p>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-1">{desc}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core system */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Standard in every build</p>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">The core system ships with all of them</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">These are not add-ons. Every platform we deliver includes them.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#FCE6DD] rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#E94E1B]" />
                  </div>
                  <span className="text-xs font-semibold text-gray-300">{n}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="py-20 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Side by side</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Which platform fits your business?</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-4 font-semibold text-gray-500">Feature</th>
                  <th className="px-5 py-4 font-semibold text-gray-900">Global Trading</th>
                  <th className="px-5 py-4 font-semibold text-gray-900">Global Prop Firm</th>
                  <th className="px-5 py-4 font-semibold text-gray-900">AI Trading</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(({ feature, cells }) => (
                  <tr key={feature} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-3.5 text-gray-500">{feature}</td>
                    {cells.map((c, i) => (
                      <td key={i} className="px-5 py-3.5 text-center text-gray-700">
                        <Cell v={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-gray-500 text-sm mt-8">
            Still deciding? Send us your business model — we&rsquo;ll tell you which one fits,
            and tell you honestly if we&rsquo;re not the right fit.{' '}
            <a href="/contact" className="text-[#E94E1B] font-semibold hover:underline">Talk to our team →</a>
          </p>
        </div>
      </section>


      {/* Stated next to the features, not only in the footer. A list naming
          liquidity routing, MAM/PAMM and copy trading is what a brokerage's
          own site would show; this is where a reader could otherwise conclude
          we run those services rather than build them. */}
      <section className="pb-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden />
            <p className="text-sm leading-relaxed text-gray-500">
              <span className="font-semibold text-gray-900">These are platform capabilities, not services we run.</span>{' '}
              Every feature listed here is something we build into your platform and hand over with it.
              SetupFX does not operate a brokerage, hold client funds, route client orders or execute
              trades — your own licensed entity does, under your brand.
            </p>
          </div>
        </div>
      </section>
      <Disclaimer />
    </div>
  )
}
