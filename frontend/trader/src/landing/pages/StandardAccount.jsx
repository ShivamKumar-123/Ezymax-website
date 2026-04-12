import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const StandardAccount = () => {
  const features = [
    'Free educational content',
    '24/5 customer support',
    'Negative balance protection',
    'Access to all trading platforms',
    'No hidden fees',
    'Free deposits & withdrawals',
    'Real-time market data',
    'Mobile trading apps'
  ]

  const comparison = [
    { feature: 'Minimum Deposit', standard: '$100', pro: '$5,000', demo: '$0' },
    { feature: 'Spreads From', standard: '1.2 pips', pro: '0.0 pips', demo: 'Live spreads' },
    { feature: 'Leverage', standard: 'Up to 1:500', pro: 'Up to 1:200', demo: 'Up to 1:500' },
    { feature: 'Commission', standard: 'None', pro: '$3.5/lot', demo: 'None' },
    { feature: 'Platforms', standard: 'Web, Copy Trading', pro: 'Web, Copy Trading', demo: 'Web, Copy Trading' },
    { feature: 'Support', standard: '24/5', pro: 'Priority 24/7', demo: '24/5' }
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <div className="inline-block bg-primary-accent/20 text-primary-accent px-4 py-2 rounded-full mb-6 font-semibold">
              For Beginners & Retail Traders
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Standard Account</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Start your trading journey with our beginner-friendly Standard Account. Low minimum deposit, competitive spreads, and no commission.
            </p>
            <Link to="/accounts/demo">
              <Button variant="primary" icon>Open Standard Account</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollRevealGroup className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Min Deposit</div>
                <div className="text-3xl font-bold gradient-text">$100</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Spreads From</div>
                <div className="text-3xl font-bold gradient-text">1.2 pips</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Leverage</div>
                <div className="text-3xl font-bold gradient-text">1:500</div>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <div className="text-sm text-text-secondary mb-2">Commission</div>
                <div className="text-3xl font-bold gradient-text">None</div>
              </Card>
            </ScrollRevealItem>
          </ScrollRevealGroup>

          <ScrollReveal variant="fadeUp">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
                Account Features
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
              Compare Account Types
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="glass-card p-8 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 text-white font-semibold">Feature</th>
                    <th className="text-center py-4 text-white font-semibold">Standard</th>
                    <th className="text-center py-4 text-white font-semibold">Pro</th>
                    <th className="text-center py-4 text-white font-semibold">Demo</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, index) => (
                    <tr key={index} className="border-b border-white/5">
                      <td className="py-4 text-text-secondary">{row.feature}</td>
                      <td className="py-4 text-center text-white font-semibold">{row.standard}</td>
                      <td className="py-4 text-center text-text-secondary">{row.pro}</td>
                      <td className="py-4 text-center text-text-secondary">{row.demo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Start Trading?</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Open your Standard Account today with just $100 and start trading global markets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/accounts/demo">
                <Button variant="primary">Open Standard Account</Button>
              </Link>
              <Link to="/accounts/demo">
                <Button variant="ghost">Try Demo First</Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default StandardAccount
