import Link from 'next/link'
import { Shield, FileText, AlertTriangle, BugPlay, ArrowRight, Scale } from 'lucide-react'
import Disclaimer from '@/landing/marketing/Disclaimer'

export const metadata = {
  title: 'Policies & Legal — SetupFX',
  description:
    'Terms of service, privacy policy, disclaimer and vulnerability reporting for SetupFX, a trading platform development company.',
}

/**
 * Policies hub, rewritten for a software development company.
 *
 * The "Regulatory framework" band on this page claimed a multi-jurisdictional
 * licensing structure and that "client money is held in segregated accounts at
 * our banking partners". We hold no client money and no such licences. That
 * was the single most serious misstatement on the site — every other page
 * could be read as loose marketing, but a claimed licence and a claimed
 * segregated client-money arrangement are assertions a regulator treats as
 * representations of fact.
 */

const DOCS = [
  {
    icon: Shield,
    title: 'Privacy Policy',
    body: 'What we collect when you enquire or become a client, how long we keep it, and — importantly — who controls the data on platforms we build for others.',
    href: '/privacy',
  },
  {
    icon: FileText,
    title: 'Terms of Service',
    body: 'What governs your use of this website and our enquiry process, and where the boundary of our services sits.',
    href: '/terms',
  },
  {
    icon: AlertTriangle,
    title: 'Disclaimer',
    body: 'What SetupFX is and is not: a software company that builds trading platforms, never a broker, and never a holder of client funds.',
    href: '/risk',
  },
  {
    icon: BugPlay,
    title: 'Vulnerability Disclosure',
    body: 'How to report a security issue responsibly. We answer every legitimate report and credit researchers when appropriate.',
    href: '/privacy#vulnerability',
  },
]

const REGULATORY = [
  {
    label: 'We hold no client funds',
    body: 'There is no segregated client account here because there are no client funds. We license software; money, where it exists, sits with the licensed operator running the platform.',
    image: '/assets/Policy_icon1.png',
  },
  {
    label: 'AML / KYC is a feature we build',
    body: 'Our platforms include onboarding, document capture, screening hooks and audit logging. Operating those controls, and satisfying a regulator that they are adequate, is the operator’s obligation.',
    image: '/assets/Policy_icon2.png',
  },
]

export default function PolicyPage() {
  return (
    <div className="bg-white text-gray-900">
      <section
        className="flex min-h-screen items-center bg-white bg-cover bg-center pt-24 pb-16 md:pt-28 md:pb-20"
        style={{ backgroundImage: 'url(/assets/Policy_hero_bg3.png)' }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Left — copy + CTAs */}
            <div className="-translate-y-10 md:-translate-y-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E94E1B]">
                Policies &amp; Legal
              </p>
              <h1 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight leading-[1.05]">
                Clear rules.<br />
                <span className="text-[#E94E1B]">No fine-print games.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base md:text-lg text-gray-700 leading-relaxed">
                Every document below is the actual contract you’re entering into. Read them in
                full before opening an account — and reach out to{' '}
                <Link href="/contact" className="text-[#E94E1B] font-semibold underline-offset-4 hover:underline">
                  legal@swisscresta.com
                </Link>{' '}
                if anything is unclear.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#documents"
                  className="inline-flex items-center justify-center rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
                >
                  Read the policies
                </a>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-7 py-3 text-sm font-semibold text-gray-900 transition-colors hover:border-[#E94E1B] hover:text-[#E94E1B]"
                >
                  Contact legal <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="documents" className="scroll-mt-24 bg-white pb-16 md:pb-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DOCS.map(({ icon: Icon, title, body, href }, i) => {
              const onLeft = i % 2 === 0
              return (
                <Link
                  key={title}
                  href={href}
                  className="group relative block rounded-3xl bg-gradient-to-b from-[#E94E1B] to-[#ff9b6b] shadow-[0_18px_45px_-20px_rgba(233,78,27,0.55)] transition-transform duration-300 hover:-translate-y-1"
                >
                  {/* white face shifted to expose a colored accent bar on one side */}
                  <div
                    className={`relative overflow-hidden rounded-3xl bg-white p-7 md:p-8 ${onLeft ? 'ml-3.5' : 'mr-3.5'}`}
                  >
                    {/* big outlined step number watermark (accent side) */}
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 select-none text-[130px] font-extrabold leading-none ${onLeft ? 'left-2' : 'right-2'}`}
                      style={{ color: 'transparent', WebkitTextStroke: '2px rgba(233,78,27,0.35)' }}
                    >
                      {i + 1}
                    </span>

                    {/* gradient icon badge (opposite corner to the number) */}
                    <span
                      className={`absolute top-7 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#E94E1B] to-[#ff8a50] text-white shadow-md ${onLeft ? 'right-6' : 'left-6'}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>

                    {/* content, kept clear of the number (one side) and icon (other) */}
                    <div className={`relative flex flex-col gap-3 ${onLeft ? 'pl-24 pr-14' : 'pr-24 pl-14'}`}>
                      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#E94E1B] group-hover:gap-2 transition-all">
                        Read the document <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="w-full mx-auto px-6 md:px-10 lg:px-16">
          <div className="relative overflow-hidden rounded-[2rem] bg-gray-50 px-6 md:px-10 lg:px-16 py-16 md:py-20">
            {/* decorative side bubbles (same motif as the Crypto section) */}
            {[
              { size: 56, top: '8%', left: '6%' },
              { size: 84, top: '24%', left: '12%' },
              { size: 44, top: '58%', left: '4%' },
              { size: 60, top: '74%', left: '16%' },
              { size: 72, top: '14%', right: '9%' },
              { size: 96, top: '42%', right: '5%' },
              { size: 56, top: '72%', right: '13%' },
            ].map((bubble, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="hidden md:block absolute rounded-full bg-gradient-to-br from-[#E94E1B]/15 to-[#E94E1B]/5 border border-[#E94E1B]/15"
                style={{
                  width: bubble.size,
                  height: bubble.size,
                  top: bubble.top,
                  left: bubble.left,
                  right: bubble.right,
                }}
              />
            ))}

            <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <Scale className="w-10 h-10 text-[#E94E1B] mx-auto" strokeWidth={1.5} />
            <h2 className="mt-4 text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
              Regulatory framework
            </h2>
            <p className="mt-3 text-sm md:text-base text-gray-600">
              SetupFX is a software development company registered in India. We hold no
              financial-services licence in any jurisdiction, and we do not need one — we build
              technology, we do not operate a trading business.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {REGULATORY.map((row) => (
              <div
                key={row.label}
                className="flex items-center gap-5 rounded-3xl bg-white p-5 ring-1 ring-gray-100 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.30)]"
              >
                {/* icon / image space — reserved on the left like the reference */}
                <div
                  className="h-24 w-24 shrink-0 rounded-2xl bg-gray-100 bg-cover bg-center"
                  style={row.image ? { backgroundImage: `url(${row.image})` } : undefined}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#E94E1B]">
                    {row.label}
                  </h3>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{row.body}</p>
                </div>
              </div>
            ))}
          </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
            Something not clear?
          </h2>
          <p className="mt-4 text-base text-gray-700">
            We&apos;d rather you ask first than be surprised later. Compliance and legal teams
            both respond within two business days.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-[#E94E1B] hover:bg-[#C73E11] text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Contact compliance
            </Link>
            <Link
              href="/risk"
              className="inline-flex items-center gap-2 border border-gray-900 hover:bg-gray-900 hover:text-white text-gray-900 text-sm font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Read the risk disclosure
            </Link>
          </div>
        </div>
      </section>

      <Disclaimer />
    </div>
  )
}
