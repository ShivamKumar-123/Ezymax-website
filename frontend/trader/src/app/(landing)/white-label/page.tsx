import {
  Code2, Palette, Smartphone, Plug, Figma, LifeBuoy,
  CreditCard, ShieldCheck, Waves, LineChart, Users2, MessageSquare, BarChart4, Braces,
  ArrowRight, Info,
} from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = { title: 'Trading Software Development Services — SetupFX' }

/**
 * Services page, rewritten from setupfx24.com (previously "White Label
 * Solutions", written as a broker's enterprise pitch).
 */

const SERVICES = [
  { n: '01', icon: Code2, title: 'Custom trading software', desc: 'Purpose-built systems designed around your instruments, workflows and revenue model.' },
  { n: '02', icon: Palette, title: 'White-label deployment', desc: 'Complete branding, configuration and launch of any of our platforms under your identity.' },
  { n: '03', icon: Smartphone, title: 'Mobile app development', desc: 'Native Android and iOS trading apps, built for performance and published under your accounts.' },
  { n: '04', icon: Plug, title: 'API & third-party integration', desc: 'Liquidity feeds, market data, payment gateways, KYC providers, CRM systems and internal tools.' },
  { n: '05', icon: Figma, title: 'UI/UX for trading products', desc: 'Interfaces designed for dense data and fast decisions. Tested with traders, not just designers.' },
  { n: '06', icon: LifeBuoy, title: 'Maintenance & support', desc: 'Uptime monitoring, issue resolution, security updates and scheduled feature releases.' },
]

const INTEGRATIONS = [
  { icon: CreditCard, label: 'Payment gateways' },
  { icon: ShieldCheck, label: 'KYC & AML providers' },
  { icon: Waves, label: 'Liquidity providers' },
  { icon: LineChart, label: 'Market data feeds' },
  { icon: Users2, label: 'CRM systems' },
  { icon: MessageSquare, label: 'SMS & email services' },
  { icon: BarChart4, label: 'Analytics tools' },
  { icon: Braces, label: 'Custom APIs' },
]

export default function ServicesPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E94E1B] mb-5">What we build</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Development services<br />
            <span className="text-[#E94E1B]">beyond the platform</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            When your business model needs something our standard products don&rsquo;t cover, we build it.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="/contact" className="inline-flex items-center gap-2 bg-[#E94E1B] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
              Request a proposal <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/platforms" className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition">
              View platforms
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900">Six things we deliver well</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="rounded-xl border border-gray-200 p-6">
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

      {/* Integrations */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Connected during the build</p>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">We handle the plumbing</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Integrations are part of the project, not left as your problem afterwards.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {INTEGRATIONS.map(({ icon: Icon, label }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <Icon className="w-6 h-6 text-[#E94E1B] mx-auto mb-3" />
                <div className="text-sm font-medium text-gray-700">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Next step</p>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Tell us what you need built</h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Send us the requirement. We&rsquo;ll come back with a scope, a timeline and an
            honest answer on whether we&rsquo;re the right team for it.
          </p>
          <a href="/contact" className="inline-flex items-center gap-2 bg-[#E94E1B] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
            Contact us <ArrowRight className="w-4 h-4" />
          </a>
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
