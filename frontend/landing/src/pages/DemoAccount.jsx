import { Link } from 'react-router-dom'
import { Check, Play } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const DemoAccount = () => {
  const features = [
    'Identical to live trading environment',
    'Unlimited demo resets',
    'Access to all platforms (Web, Copy Trading)',
    'No credit card required',
    'Real-time market data',
    'Practice with $100,000 virtual funds',
    'Test trading strategies risk-free',
    'Learn platform features'
  ]

  const benefits = [
    {
      icon: '🎓',
      title: 'Learn Risk-Free',
      description: 'Practice trading strategies and test your skills without risking real money.'
    },
    {
      icon: '📊',
      title: 'Real Market Conditions',
      description: 'Experience live market prices and conditions identical to a real trading account.'
    },
    {
      icon: '🔄',
      title: 'Unlimited Resets',
      description: 'Reset your demo account anytime and start fresh with $100,000 virtual funds.'
    }
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full mb-6 font-semibold">
              <Play className="w-5 h-5" />
              Risk-Free Practice Account
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Practice Risk-Free with $100,000 Virtual Funds
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Test your strategy on real market conditions without risking a cent. No credit card required.
            </p>
            <Button variant="primary" icon>Open Demo Account Now</Button>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollRevealGroup className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Virtual Funds</div>
                <div className="text-3xl font-bold gradient-text">$100,000</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Cost</div>
                <div className="text-3xl font-bold gradient-text">Free</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Duration</div>
                <div className="text-3xl font-bold gradient-text">Unlimited</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Platforms</div>
                <div className="text-3xl font-bold gradient-text">All</div>
              </Card>
            </ScrollRevealItem>
          </ScrollRevealGroup>

          <ScrollReveal variant="fadeUp">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
                Demo Account Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-6 h-6 text-primary-accent flex-shrink-0" />
                    <span className="text-text-secondary text-lg">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">
              Why Use a Demo Account?
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <ScrollRevealItem key={index}>
                <Card>
                  <div className="text-5xl mb-4">{benefit.icon}</div>
                  <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                  <p className="text-text-secondary">{benefit.description}</p>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <div className="glass-card p-12 text-center max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                How to Get Started
              </h2>
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div>
                  <div className="w-12 h-12 bg-primary-accent/10 text-primary-accent rounded-lg flex items-center justify-center text-lg font-bold mx-auto mb-4">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Sign Up</h3>
                  <p className="text-text-secondary">Create your free demo account in seconds</p>
                </div>
                <div>
                  <div className="w-12 h-12 bg-primary-accent/10 text-primary-accent rounded-lg flex items-center justify-center text-lg font-bold mx-auto mb-4">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Choose Platform</h3>
                  <p className="text-text-secondary">Select Web Platform or Copy Trading</p>
                </div>
                <div>
                  <div className="w-12 h-12 bg-primary-accent/10 text-primary-accent rounded-lg flex items-center justify-center text-lg font-bold mx-auto mb-4">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Start Trading</h3>
                  <p className="text-text-secondary">Practice with $100,000 virtual funds</p>
                </div>
              </div>
              <Button variant="primary" icon>Open Demo Account</Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Ready When You Are</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              When you're confident with your demo account, upgrade to a live account and start trading for real.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="primary">Open Demo Account</Button>
              <Link to="/accounts/standard">
                <Button variant="ghost">View Live Accounts</Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default DemoAccount
