import { Link } from 'react-router-dom'
import { Users, DollarSign, BarChart2, Award, Globe, Headphones, Check, ArrowRight, TrendingUp } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const benefits = [
  { icon: DollarSign, title: 'Competitive Commissions', desc: 'Earn up to $12 per lot with our tiered rebate structure. The more clients you refer, the higher your earnings.' },
  { icon: Users, title: 'Multi-Level Referrals', desc: 'Earn from sub-IBs under your network. Build a team and generate passive income from multiple levels.' },
  { icon: BarChart2, title: 'Real-Time Dashboard', desc: 'Track referrals, commissions, client activity, and payouts in real time through your dedicated IB portal.' },
  { icon: Globe, title: 'Marketing Materials', desc: 'Access banners, landing pages, tracking links, and promotional content to grow your client base.' },
  { icon: Award, title: 'Performance Bonuses', desc: 'Unlock bonus tiers based on monthly volume. Top-performing IBs receive additional rewards and incentives.' },
  { icon: Headphones, title: 'Dedicated IB Manager', desc: 'Get a personal account manager to help you optimize your strategy, resolve issues, and scale your business.' },
]

const tiers = [
  { name: 'Silver', volume: '0 – 100 lots/month', rebate: '$5 / lot' },
  { name: 'Gold', volume: '100 – 500 lots/month', rebate: '$8 / lot' },
  { name: 'Platinum', volume: '500+ lots/month', rebate: '$12 / lot' },
]

const steps = [
  { step: '01', title: 'Apply', desc: 'Fill out the IB application form with your details.' },
  { step: '02', title: 'Get Approved', desc: 'Our team reviews and approves your application.' },
  { step: '03', title: 'Share Your Link', desc: 'Use your unique referral link to invite clients.' },
  { step: '04', title: 'Earn Commissions', desc: 'Get paid for every trade your referred clients make.' },
]

const portalFeatures = [
  'Real-time commission tracking',
  'Client activity monitoring',
  'Sub-IB management tools',
  'Automated payout system',
  'Custom referral links',
  'Detailed reporting & analytics',
  'Marketing resource library',
  'Priority support channel',
]

const IBManagement = () => {
  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Partner Program</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  IB Management Program
                </h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  Partner with FXArtha and earn competitive commissions by introducing new clients. Build your brokerage business with our support.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/company/contact"><Button variant="primary" icon>Become an IB</Button></Link>
                  <Link to="/accounts/demo"><Button variant="ghost">Learn More</Button></Link>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">IB Dashboard</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Why Partner With Us ──────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader
            badge="Why Us"
            title="Why Partner With Us"
            highlight="Partner"
            subtitle="Everything you need to build a successful introducing broker business."
          />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 md:mt-16">
            {benefits.map((b, i) => (
              <ScrollRevealItem key={i}>
                <div className="fx-card p-7 md:p-8 h-full">
                  <div className="feature-icon mb-5">
                    <b.icon size={20} />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{b.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Commission Tiers ─────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <SectionHeader badge="Rebates" title="Commission Tiers" highlight="Commission" />
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="fx-section-frame mt-12 md:mt-16">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fx-line-strong)' }}>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-gold-light)' }}>Tier</th>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Volume</th>
                      <th className="text-right py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Commission per lot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={t.name} style={{ borderBottom: '1px solid var(--fx-line)' }}>
                        <td className="py-4 font-semibold" style={{ color: 'var(--fx-gold-light)' }}>{t.name}</td>
                        <td className="py-4" style={{ color: 'var(--fx-text-2)' }}>{t.volume}</td>
                        <td className="py-4 text-right font-bold text-white">{t.rebate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── How to Get Started ───────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader badge="Onboarding" title="How to Get Started" highlight="Get Started" />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12 md:mt-16">
            {steps.map((s) => (
              <ScrollRevealItem key={s.step}>
                <div className="fx-card p-7 md:p-8 text-center h-full">
                  <div className="feature-icon mx-auto mb-5 text-lg font-bold">{s.step}</div>
                  <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--fx-text-2)' }}>{s.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── IB Portal Features ───────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Portal</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-8">IB Portal Features</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {portalFeatures.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <Check className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                      <span className="text-sm" style={{ color: 'var(--fx-text-2)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Portal Preview</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Earning Potential ────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-card-gold p-7 md:p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="text-center md:text-left">
                  <div className="feature-icon mx-auto md:mx-0 mb-5 w-16 h-16">
                    <TrendingUp size={28} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Unlimited Earning Potential</h3>
                  <p className="mb-6" style={{ color: 'var(--fx-text-2)' }}>No caps on commissions. The more clients you bring, the more you earn — every month, for life.</p>
                  <Link to="/company/contact">
                    <Button variant="primary" className="inline-flex items-center gap-2">Apply Now <ArrowRight size={16} /></Button>
                  </Link>
                </div>
                <div className="fx-image-slot fx-image-slot-3x2">
                  <span className="fx-image-slot-label">Earnings Overview</span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Become an IB</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                Partner with FXArtha and earn competitive commissions by introducing new clients. Build your brokerage business with our support.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/company/contact"><Button variant="primary" icon>Become an IB</Button></Link>
                <Link to="/accounts/demo"><Button variant="ghost">Learn More</Button></Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default IBManagement
