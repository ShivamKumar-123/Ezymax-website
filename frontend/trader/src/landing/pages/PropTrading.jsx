import { Link } from 'react-router-dom'
import { Target, DollarSign, TrendingUp, Shield, Award, BarChart2 } from 'lucide-react'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const challenges = [
  {
    name: 'Starter',
    capital: '$10,000',
    target: '8%',
    maxLoss: '10%',
    dailyLoss: '5%',
    duration: '30 days',
    fee: '$99',
    split: '80/20',
    highlight: false,
  },
  {
    name: 'Standard',
    capital: '$25,000',
    target: '8%',
    maxLoss: '10%',
    dailyLoss: '5%',
    duration: '30 days',
    fee: '$199',
    split: '80/20',
    highlight: true,
  },
  {
    name: 'Professional',
    capital: '$100,000',
    target: '8%',
    maxLoss: '10%',
    dailyLoss: '5%',
    duration: '60 days',
    fee: '$499',
    split: '90/10',
    highlight: false,
  },
]

const rules = [
  { icon: Target, title: 'Profit Target', desc: 'Reach the profit target within the evaluation period to pass the challenge.' },
  { icon: Shield, title: 'Max Drawdown', desc: 'Stay within the maximum drawdown limit to keep your account active.' },
  { icon: BarChart2, title: 'Minimum Trading Days', desc: 'Trade for at least 5 days during the evaluation to demonstrate consistency.' },
  { icon: DollarSign, title: 'Profit Split', desc: 'Keep up to 90% of the profits you generate on your funded account.' },
  { icon: TrendingUp, title: 'Scaling Plan', desc: 'Consistently profitable traders can scale their account up to $500,000.' },
  { icon: Award, title: 'No Time Limit (Funded)', desc: 'Once funded, there is no time limit. Trade at your own pace.' },
]

const steps = [
  { step: '1', title: 'Pass the Challenge', desc: 'Meet the profit target while staying within risk limits.' },
  { step: '2', title: 'Get Funded', desc: 'Receive a funded account with real capital to trade.' },
  { step: '3', title: 'Earn Profits', desc: 'Keep up to 90% of every dollar you make. Withdraw anytime.' },
]

const PropTrading = () => {
  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="badge mb-6">Prop Trading Program</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  Prop Trading Program
                </h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  Prove your skills, get funded, and trade with our capital. Keep up to 90% of the profits — zero personal risk.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/accounts/standard"><Button variant="primary" icon>Start Challenge</Button></Link>
                  <Link to="/accounts/demo"><Button variant="ghost">Learn More</Button></Link>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Prop Trading</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Challenge tiers ──────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader
            badge="Choose Your Challenge"
            title="Choose Your Challenge"
            highlight="Challenge"
            subtitle="Select a challenge size that matches your trading experience."
          />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 md:mt-16">
            {challenges.map((c) => (
              <ScrollRevealItem key={c.name}>
                <div className={`${c.highlight ? 'fx-card-gold' : 'fx-card'} h-full p-7 md:p-8 flex flex-col`}>
                  {c.highlight && (
                    <div className="text-center mb-4">
                      <span className="badge">Most Popular</span>
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-1">{c.name}</h3>
                  <div className="text-3xl font-bold gradient-text mb-6">{c.capital}</div>

                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex justify-between text-sm"><span style={{ color: 'var(--fx-text-2)' }}>Profit Target</span><span className="text-white">{c.target}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: 'var(--fx-text-2)' }}>Max Drawdown</span><span className="text-white">{c.maxLoss}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: 'var(--fx-text-2)' }}>Daily Loss Limit</span><span className="text-white">{c.dailyLoss}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: 'var(--fx-text-2)' }}>Duration</span><span className="text-white">{c.duration}</span></div>
                    <div className="flex justify-between text-sm"><span style={{ color: 'var(--fx-text-2)' }}>Profit Split</span><span className="text-white font-semibold">{c.split}</span></div>
                  </div>

                  <div className="text-center mb-5">
                    <span className="text-2xl font-bold text-white">{c.fee}</span>
                    <span className="text-sm ml-1" style={{ color: 'var(--fx-text-2)' }}>one-time</span>
                  </div>
                  <Link to="/accounts/standard" className="mt-auto">
                    <Button variant={c.highlight ? 'primary' : 'ghost'} icon className="w-full justify-center">Start Challenge</Button>
                  </Link>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Challenge rules ──────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <SectionHeader badge="The Rules" title="Challenge Rules" highlight="Rules" />
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 md:mt-16">
            {rules.map((r, i) => (
              <ScrollRevealItem key={i}>
                <div className="fx-card h-full p-7 md:p-8">
                  <div className="feature-icon mb-6" style={{ width: 56, height: 56 }}>
                    <r.icon size={22} />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{r.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{r.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">The Process</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-8">How It Works</h2>
                <ScrollRevealGroup className="space-y-6">
                  {steps.map((s) => (
                    <ScrollRevealItem key={s.step}>
                      <div className="flex items-start gap-5">
                        <div className="feature-icon flex-shrink-0" style={{ width: 56, height: 56 }}>
                          <span className="text-lg font-bold">{s.step}</span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{s.desc}</p>
                        </div>
                      </div>
                    </ScrollRevealItem>
                  ))}
                </ScrollRevealGroup>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Funded Trader</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">Prop Trading Program</h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                Prove your skills, get funded, and trade with our capital. Keep up to 90% of the profits — zero personal risk.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/accounts/standard"><Button variant="primary" icon>Start Challenge</Button></Link>
                <Link to="/accounts/demo"><Button variant="ghost">Learn More</Button></Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default PropTrading
