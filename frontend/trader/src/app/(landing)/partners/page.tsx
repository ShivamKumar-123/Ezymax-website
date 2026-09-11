import {
  Handshake, Users, Wrench, Globe2, FileCheck, Headphones, Info, ArrowRight,
} from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = { title: 'Partner With SetupFX — Referral & Reseller Programme' }

/**
 * Partners page, rewritten.
 *
 * What was here was an introducing-broker rebate pitch: "USD 16 per standard
 * lot on every lot your clients trade", "professional counterparty", "your
 * clients trade with a platform that...". Per-lot rebates on client volume are
 * something a brokerage pays. We are not one, and a page offering them would
 * have read as the clearest possible statement that we are.
 *
 * The partners this business actually has are people who introduce brokerages
 * and prop firms to us, resell deployments, or integrate their own product
 * into ours.
 */

const TRACKS = [
  {
    icon: Users,
    title: 'Referral partner',
    body: 'You know operators launching or replatforming a trading business. You introduce them; we scope, build and support. Commission is agreed per engagement, on the project — never on anybody’s trading volume.',
  },
  {
    icon: Handshake,
    title: 'Reseller',
    body: 'You hold the client relationship and sell the platform under your own commercial terms. We deliver and maintain the technology behind it.',
  },
  {
    icon: Wrench,
    title: 'Technology partner',
    body: 'Payment providers, KYC vendors, liquidity venues, market-data and CRM products — integrations our clients ask for by name.',
  },
]

const WHAT_YOU_GET = [
  { icon: FileCheck, title: 'A straight answer on fit', body: 'If the lead is not a fit for what we build, we say so early rather than running them through a sales cycle.' },
  { icon: Globe2, title: 'Delivered worldwide', body: 'White-label deployments run in multiple countries. Your introduction is not limited by geography.' },
  { icon: Headphones, title: 'You are not the support desk', body: 'Once a client is live, they reach our team directly. You are not left relaying issues you cannot fix.' },
]

export default function PartnersPage() {
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E94E1B] mb-5">Partners</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Introduce the work,<br />
            <span className="text-[#E94E1B]">we&rsquo;ll build it</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            For consultants, agencies and vendors who work with brokerages and prop
            firms and want a development team behind them.
          </p>
          <div className="mt-9">
            <a href="/contact" className="inline-flex items-center gap-2 bg-[#E94E1B] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
              Talk to us <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Three ways to work with us</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Pick the one that matches how you already work. We do not ask you to change your model.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {TRACKS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-gray-200 p-7">
                <div className="w-12 h-12 bg-[#FCE6DD] rounded-xl flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#E94E1B]" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900">What you can expect</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="w-10 h-10 bg-[#FCE6DD] rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#E94E1B]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The line that matters most on this page */}
      <section className="pb-16 pt-4 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden />
            <p className="text-sm leading-relaxed text-gray-500">
              <span className="font-semibold text-gray-900">This is not an introducing-broker programme.</span>{' '}
              We pay for introductions to software engagements, never a rebate on trading
              volume. SetupFX does not operate a brokerage, hold client funds, route client
              orders or execute trades — your client&rsquo;s own licensed entity does, under
              their brand. IB and affiliate management is a module we build INTO their
              platform, for them to run.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Have someone in mind?</h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Tell us about the business and what they are trying to launch. We&rsquo;ll come
            back within one business day with whether we can help.
          </p>
          <a href="/contact" className="inline-flex items-center gap-2 bg-[#E94E1B] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition">
            Contact us <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}
