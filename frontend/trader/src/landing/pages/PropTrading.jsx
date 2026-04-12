import { Link } from 'react-router-dom'
import { Target, DollarSign, TrendingUp, Shield, Award, BarChart2, Check, ArrowRight } from 'lucide-react'
import Button from '../components/Button'
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

const PropTrading = () => {
  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Prop Trading Program
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Prove your skills, get funded, and trade with our capital. Keep up to 90% of the profits — zero personal risk.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/accounts/standard"><Button variant="primary">Start Challenge</Button></Link>
              <Link to="/accounts/demo"><Button variant="ghost">Learn More</Button></Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">Choose Your Challenge</h2>
            <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">Select a challenge size that matches your trading experience.</p>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {challenges.map((c) => (
              <ScrollRevealItem key={c.name}>
                <div className={`rounded-lg p-6 h-full flex flex-col ${c.highlight ? 'bg-primary-accent/[0.06] border border-primary-accent/30' : 'glass-card'}`}>
                  {c.highlight && (
                    <div className="text-center mb-4">
                      <span className="bg-primary-accent text-white text-xs font-bold px-3 py-1 rounded uppercase">Most Popular</span>
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-1">{c.name}</h3>
                  <div className="text-3xl font-bold gradient-text mb-4">{c.capital}</div>

                  <div className="space-y-2 mb-6 flex-1">
                    <div className="flex justify-between text-sm"><span className="text-text-secondary">Profit Target</span><span className="text-white">{c.target}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-secondary">Max Drawdown</span><span className="text-white">{c.maxLoss}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-secondary">Daily Loss Limit</span><span className="text-white">{c.dailyLoss}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-secondary">Duration</span><span className="text-white">{c.duration}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-text-secondary">Profit Split</span><span className="text-white font-semibold">{c.split}</span></div>
                  </div>

                  <div className="text-center mb-4">
                    <span className="text-2xl font-bold text-white">{c.fee}</span>
                    <span className="text-text-secondary text-sm ml-1">one-time</span>
                  </div>
                  <Link to="/accounts/standard" className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-all ${c.highlight ? 'bg-white text-primary-accent hover:bg-white/90' : 'border border-primary-accent/30 text-primary-accent hover:bg-primary-accent/10'}`}>
                    Start Challenge
                  </Link>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">Challenge Rules</h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rules.map((r, i) => (
              <ScrollRevealItem key={i}>
                <div className="glass-card p-6 h-full">
                  <div className="feature-icon bg-primary-purple/10 text-primary-purple mb-4">
                    <r.icon size={20} />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{r.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{r.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Pass the Challenge', desc: 'Meet the profit target while staying within risk limits.' },
              { step: '2', title: 'Get Funded', desc: 'Receive a funded account with real capital to trade.' },
              { step: '3', title: 'Earn Profits', desc: 'Keep up to 90% of every dollar you make. Withdraw anytime.' },
            ].map((s) => (
              <ScrollRevealItem key={s.step}>
                <div className="glass-card p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary-accent/10 text-primary-accent font-bold text-lg flex items-center justify-center mx-auto mb-4">{s.step}</div>
                  <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-text-secondary text-sm">{s.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>
    </div>
  )
}

export default PropTrading
