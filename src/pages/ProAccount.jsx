import { Link } from 'react-router-dom'
import { Check, Crown } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const ProAccount = () => {
  const features = [
    'Priority 24/7 support',
    'Raw spreads from 0.0 pips',
    'Free VPS hosting',
    'Dedicated account manager',
    'Advanced trading tools',
    'Institutional-grade execution',
    'Premium market research',
    'Exclusive trading signals'
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <div className="inline-flex items-center gap-2 bg-primary-accent/10 text-primary-accent px-3 py-1.5 rounded mb-6 font-medium text-sm">
              <Crown className="w-5 h-5" />
              For Experienced & Professional Traders
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Pro Account</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Experience professional-grade trading with raw spreads, priority support, and exclusive benefits designed for serious traders.
            </p>
            <Link to="/accounts/demo">
              <Button variant="primary" icon>Open Pro Account</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollRevealGroup className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            <ScrollRevealItem>
              <Card className="text-center border-t-4 border-primary-accent">
                <div className="text-sm text-text-secondary mb-2">Min Deposit</div>
                <div className="text-3xl font-bold gradient-text">$5,000</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center border-t-4 border-primary-accent">
                <div className="text-sm text-text-secondary mb-2">Spreads From</div>
                <div className="text-3xl font-bold gradient-text">0.0 pips</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center border-t-4 border-primary-accent">
                <div className="text-sm text-text-secondary mb-2">Leverage</div>
                <div className="text-3xl font-bold gradient-text">1:200</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center border-t-4 border-primary-accent">
                <div className="text-sm text-text-secondary mb-2">Commission</div>
                <div className="text-3xl font-bold gradient-text">$3.5/lot</div>
              </Card>
            </ScrollRevealItem>
          </ScrollRevealGroup>

          <ScrollReveal variant="fadeUp">
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
                Premium Features
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

          <ScrollRevealGroup className="grid md:grid-cols-3 gap-6">
            <ScrollRevealItem>
              <Card>
                <Crown className="w-12 h-12 text-primary-accent mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Dedicated Manager</h3>
                <p className="text-text-secondary">
                  Get a personal account manager who understands your trading needs and provides tailored support.
                </p>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card>
                <div className="text-4xl mb-4">🖥️</div>
                <h3 className="text-xl font-semibold text-white mb-3">Free VPS Hosting</h3>
                <p className="text-text-secondary">
                  Run your Expert Advisors 24/7 with our complimentary VPS hosting service.
                </p>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card>
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-semibold text-white mb-3">Raw Spreads</h3>
                <p className="text-text-secondary">
                  Access institutional-grade pricing with spreads from 0.0 pips on major pairs.
                </p>
              </Card>
            </ScrollRevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Elevate Your Trading</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Join the elite. Open a Pro Account and experience professional-grade trading.
            </p>
            <Link to="/accounts/demo">
              <Button variant="primary">Open Pro Account</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default ProAccount
