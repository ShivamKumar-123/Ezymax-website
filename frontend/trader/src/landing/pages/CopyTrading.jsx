import { Link } from 'react-router-dom'
import { Copy, Users, TrendingUp, Shield, BarChart2, Settings, Check, ArrowRight } from 'lucide-react'
import Button from '../components/Button'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const features = [
  { icon: Users, title: 'Follow Top Traders', desc: 'Browse verified traders ranked by performance, risk score, and consistency. Choose who to follow with full transparency.' },
  { icon: Copy, title: 'Auto-Copy Trades', desc: 'Automatically replicate trades from expert traders in real time. Every position they open or close is mirrored in your account.' },
  { icon: Shield, title: 'Risk Controls', desc: 'Set maximum drawdown limits, stop-loss per trade, and daily loss caps. Stay in control even while copying others.' },
  { icon: BarChart2, title: 'Performance Analytics', desc: 'Track detailed performance metrics including win rate, profit factor, average return, and risk-adjusted returns.' },
  { icon: Settings, title: 'Custom Allocation', desc: 'Choose how much capital to allocate per trader. Scale up or down anytime without interrupting active copies.' },
  { icon: TrendingUp, title: 'Become a Signal Provider', desc: 'Share your strategy and earn commissions when others copy your trades. Build your reputation on the leaderboard.' },
]

const steps = [
  { step: '01', title: 'Open an Account', desc: 'Register and fund your TrustEdgeFX trading account.' },
  { step: '02', title: 'Browse Traders', desc: 'Explore the leaderboard and filter by performance, risk, and strategy.' },
  { step: '03', title: 'Allocate & Copy', desc: 'Set your investment amount and start copying trades automatically.' },
  { step: '04', title: 'Monitor & Adjust', desc: 'Track performance in real time. Pause, stop, or switch traders anytime.' },
]

const CopyTrading = () => {
  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Copy Trading
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Follow expert traders and automatically replicate their strategies. No experience needed — let the professionals trade for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/accounts/standard"><Button variant="primary">Start Copying</Button></Link>
              <Link to="/accounts/demo"><Button variant="ghost">Try on Demo</Button></Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">How It Works</h2>
            <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">Get started in four simple steps.</p>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <ScrollRevealItem key={i}>
                <div className="glass-card p-6 h-full">
                  <div className="text-3xl font-bold gradient-text mb-3">{s.step}</div>
                  <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{s.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">Features</h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <ScrollRevealItem key={i}>
                <div className="glass-card p-6 h-full">
                  <div className="feature-icon bg-primary-accent/10 text-primary-accent mb-4">
                    <f.icon size={20} />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <div className="glass-card p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <ScrollReveal variant="fadeLeft">
                <h2 className="text-3xl font-bold text-white mb-4">Why Copy Trade with TrustEdgeFX?</h2>
                <div className="space-y-3">
                  {['No hidden fees on copy trading', 'Transparent trader statistics', 'Full control over risk settings', 'Real-time trade replication', 'Works on all account types', 'Withdraw anytime — no lock-in'].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <Check size={16} className="text-primary-accent flex-shrink-0" />
                      <span className="text-text-secondary text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </ScrollReveal>
              <ScrollReveal variant="fadeRight" delay={0.2}>
                <div className="text-center">
                  <div className="text-5xl font-bold gradient-text mb-2">10,000+</div>
                  <p className="text-text-secondary mb-6">Active signal providers to choose from</p>
                  <Link to="/accounts/standard">
                    <Button variant="primary" className="inline-flex items-center gap-2">Get Started <ArrowRight size={16} /></Button>
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default CopyTrading
