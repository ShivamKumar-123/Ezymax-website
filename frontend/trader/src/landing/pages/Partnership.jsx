'use client'

import { Link } from 'react-router-dom'
import {
  Handshake,
  Users,
  Megaphone,
  Briefcase,
  TrendingUp,
  Wallet,
  Globe,
  Headphones,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  UserPlus,
  Link2,
  Coins,
} from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const programs = [
  {
    icon: Users,
    title: 'Introducing Broker',
    tagline: 'Best for educators & communities',
    desc: 'Earn up to 50% of spread revenue from every client you refer — for the lifetime of their account.',
    bullets: ['Lifetime commission', 'Multi-tier structure', 'Personal account manager'],
    cta: 'Become an IB',
    href: '/platforms/ib-management',
  },
  {
    icon: Megaphone,
    title: 'Affiliate Program',
    tagline: 'Best for content creators',
    desc: 'CPA payouts up to $1,200 per funded client. Ready-made banners, links, and landing pages.',
    bullets: ['Up to $1,200 CPA', 'Real-time dashboard', 'Creative pack included'],
    cta: 'Join Affiliate',
    href: '/auth/register',
  },
  {
    icon: Briefcase,
    title: 'White Label',
    tagline: 'Launch your own brokerage',
    desc: 'Plug into our liquidity, risk engine, and infrastructure under your own brand. We handle the tech.',
    bullets: ['Custom branding', 'Liquidity bridge', 'Full back-office'],
    cta: 'Get Proposal',
    href: '/company/contact',
  },
  {
    icon: TrendingUp,
    title: 'Money Manager',
    tagline: 'PAMM / MAM accounts',
    desc: 'Manage pooled capital with performance fees. Built-in reporting and investor onboarding.',
    bullets: ['Performance fees', 'Allocation engine', 'Investor portal'],
    cta: 'Apply as Manager',
    href: '/platforms/copy-trading',
  },
]

const benefits = [
  { icon: Wallet,       title: 'High Commissions',    desc: 'Industry-leading payouts across IB, CPA, and revenue-share models.' },
  { icon: Globe,        title: 'Global Reach',        desc: 'Refer clients from 150+ countries with localized marketing assets.' },
  { icon: BarChart3,    title: 'Live Analytics',      desc: 'Real-time dashboard for clicks, conversions, volume and earnings.' },
  { icon: Headphones,   title: 'Dedicated Manager',   desc: 'A senior partner manager assigned from day one — no ticket queues.' },
  { icon: ShieldCheck,  title: 'Transparent Tracking', desc: 'Server-side tracking, audit-ready logs, and same-day payout cycles.' },
  { icon: Coins,        title: 'Multi-Currency Payouts', desc: 'Withdraw in USD, EUR, USDT, or local rails — your choice.' },
]

const steps = [
  { n: '1', icon: UserPlus, title: 'Apply',           desc: 'Tell us about your audience or business in a 2-minute form.' },
  { n: '2', icon: Link2,    title: 'Get Your Links',  desc: 'Receive tracking links, banners, and a partner dashboard within 24 hrs.' },
  { n: '3', icon: Users,    title: 'Refer Traders',   desc: 'Send traders to FXArtha through your channels and content.' },
  { n: '4', icon: Wallet,   title: 'Get Paid',        desc: 'Withdraw your earnings on demand — daily, weekly, or monthly.' },
]

const stats = [
  { value: '50%',    label: 'Max revenue share' },
  { value: '$1,200', label: 'Max CPA payout' },
  { value: '24h',    label: 'Avg payout time' },
  { value: '12k+',   label: 'Active partners' },
]

export default function Partnership() {
  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 md:pt-36 pb-16 md:pb-20">
        <div className="fx-grid-bg" aria-hidden="true" />
        <div className="fx-glow-gold" aria-hidden="true" />

        <div className="fx-container relative z-10">
          <div className="max-w-3xl">
            <ScrollReveal variant="fadeUp">
              <span className="fx-eyebrow">Partnership</span>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.05}>
              <h1 className="fx-headline mt-4 text-[44px] sm:text-[56px] md:text-[64px] lg:text-[72px]">
                Grow With Us. <br />
                <span className="fx-gold-text">Earn Without Limits.</span>
              </h1>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <p className="mt-6 text-base md:text-lg max-w-xl leading-relaxed"
                 style={{ color: 'var(--fx-text-2)' }}>
                Join the FXArtha partner ecosystem — IB, affiliate, white-label and
                money-management programs designed to scale with you.
              </p>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.15}>
              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/auth/register" className="fx-btn-primary justify-center">
                  Become a Partner <ArrowRight size={18} />
                </Link>
                <Link to="/company/contact" className="fx-btn-ghost justify-center">
                  Talk to Sales
                </Link>
              </div>
            </ScrollReveal>
          </div>

          {/* Stats strip */}
          <ScrollRevealGroup className="mt-14 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((s) => (
              <ScrollRevealItem key={s.label}>
                <div className="glass-card p-5 md:p-6 text-center">
                  <p className="text-2xl md:text-3xl font-bold fx-gold-text">{s.value}</p>
                  <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--fx-text-3)' }}>
                    {s.label}
                  </p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Programs ──────────────────────────────────────────── */}
      <section className="fx-section">
        <div className="fx-container">
          <SectionHeader
            badge="Programs"
            title="Choose the Right Partnership"
            highlight="Partnership"
            subtitle="Four flexible models — pick the one that matches your audience or business."
          />

          <ScrollRevealGroup className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.map((p) => (
              <ScrollRevealItem key={p.title}>
                <div className="glass-card p-6 md:p-7 h-full flex flex-col">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="feature-icon shrink-0">
                      <p.icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg md:text-xl leading-tight">
                        {p.title}
                      </h3>
                      <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--fx-gold-light)' }}>
                        {p.tagline}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm md:text-[15px] leading-relaxed mb-4"
                     style={{ color: 'var(--fx-text-2)' }}>
                    {p.desc}
                  </p>

                  <ul className="space-y-2 mb-6">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm"
                          style={{ color: 'var(--fx-text-2)' }}>
                        <span className="w-1.5 h-1.5 rounded-full"
                              style={{ background: 'var(--fx-gold)' }} />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <Link to={p.href} className="fx-btn-link mt-auto">
                    {p.cta} <ArrowRight size={14} />
                  </Link>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader
            badge="Why Partner"
            title="Built for Serious Partners"
            highlight="Serious Partners"
            subtitle="Tools, support, and economics that respect your time and effort."
          />

          <ScrollRevealGroup className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {benefits.map((b) => (
              <ScrollRevealItem key={b.title}>
                <div className="glass-card p-6 h-full">
                  <div className="feature-icon mb-4">
                    <b.icon size={20} />
                  </div>
                  <h3 className="text-white font-bold text-base md:text-lg mb-2">{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {b.desc}
                  </p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="fx-section">
        <div className="fx-container">
          <SectionHeader
            badge="How it Works"
            title="From Sign-up to Payout in 4 Steps"
            highlight="4 Steps"
            subtitle="Onboard in a day. Start earning the same week."
          />

          <ScrollRevealGroup className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <ScrollRevealItem key={s.n}>
                <div className="glass-card p-6 h-full text-center relative">
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: 'var(--fx-gold-soft)',
                      color: 'var(--fx-gold-light)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    STEP {s.n}
                  </div>
                  <div className="feature-icon mx-auto mt-2 mb-4">
                    <s.icon size={20} />
                  </div>
                  <h3 className="text-white font-bold text-base md:text-lg mb-2">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {s.desc}
                  </p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────────────── */}
      <section className="fx-section">
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div
              className="relative overflow-hidden rounded-2xl p-8 md:p-12 text-center"
              style={{
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 70%), var(--fx-bg-elev)',
                border: '1px solid rgba(214,169,61,0.22)',
              }}
            >
              <Handshake
                size={36}
                style={{ color: 'var(--fx-gold-light)' }}
                className="mx-auto mb-4"
              />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl">
                Ready to <span className="fx-gold-text">Partner With Us?</span>
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg"
                 style={{ color: 'var(--fx-text-2)' }}>
                Apply in two minutes. A partner manager reaches out within 24 hours.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link to="/auth/register" className="fx-btn-primary justify-center">
                  Apply Now <ArrowRight size={18} />
                </Link>
                <Link to="/company/contact" className="fx-btn-ghost justify-center">
                  Book a Call
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}
