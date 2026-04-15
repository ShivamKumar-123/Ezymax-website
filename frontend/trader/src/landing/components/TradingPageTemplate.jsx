import { Link } from 'react-router-dom'
import Button from './Button'
import Card from './Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from './animations/ScrollReveal'

const TradingPageTemplate = ({
  title,
  subtitle,
  stats,
  about,
  instruments,
  benefits
}) => {
  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">{title}</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">{subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/accounts/demo">
                <Button variant="primary">Start Trading Now</Button>
              </Link>
              <Link to="/accounts/demo">
                <Button variant="ghost">Open Demo Account</Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollRevealGroup className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {stats.map((stat, index) => (
              <ScrollRevealItem key={index}>
                <Card className="text-center">
                  <div className="text-sm text-text-secondary mb-2">{stat.label}</div>
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>

          <ScrollReveal variant="fadeUp">
            <div className="max-w-4xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{about.title}</h2>
              <p className="text-text-secondary text-lg leading-relaxed">{about.description}</p>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="glass-card p-8 overflow-x-auto">
              <h3 className="text-2xl font-bold text-white mb-6">Top Tradable Instruments</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 text-text-secondary font-semibold">Symbol</th>
                    <th className="text-left py-4 text-text-secondary font-semibold">Spread</th>
                    <th className="text-left py-4 text-text-secondary font-semibold">Leverage</th>
                    <th className="text-left py-4 text-text-secondary font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {instruments.map((instrument, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 text-white font-semibold">{instrument.symbol}</td>
                      <td className="py-4 text-text-secondary">{instrument.spread}</td>
                      <td className="py-4 text-text-secondary">{instrument.leverage}</td>
                      <td className="py-4 text-text-secondary">{instrument.margin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Why Trade with TrustEdgeFX
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <ScrollRevealItem key={index}>
                <Card>
                  <div className="text-4xl mb-4">{benefit.icon}</div>
                  <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                  <p className="text-text-secondary">{benefit.description}</p>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Start Trading?</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Open your account today and access global markets with TrustEdgeFX.
            </p>
            <Link to="/accounts/demo">
              <Button variant="primary">Open Account Now</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default TradingPageTemplate
