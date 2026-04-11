import { Link } from 'react-router-dom'
import { Download, Monitor, Smartphone, Tablet, Check } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const MT5 = () => {
  const features = [
    '38 technical indicators + 21 timeframes',
    'Economic calendar built-in',
    'Depth of Market (DOM)',
    'Multi-currency strategy tester',
    'Hedging & Netting modes',
    'Advanced order types',
    'Multi-asset trading support',
    'Market depth analysis',
    'One-click trading',
    'Mobile trading apps'
  ]

  const downloads = [
    { platform: 'Windows', icon: Monitor, link: '#' },
    { platform: 'macOS', icon: Monitor, link: '#' },
    { platform: 'iOS', icon: Smartphone, link: '#' },
    { platform: 'Android', icon: Tablet, link: '#' }
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              MetaTrader 5 — Advanced Multi-Asset Trading
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              The evolution of MT4. Trade Forex, Stocks, Futures, and more on one platform.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Next-Generation Trading Platform
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {features.map((feature, index) => (
              <ScrollRevealItem key={index}>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary-accent flex-shrink-0 mt-1" />
                  <span className="text-text-secondary text-lg">{feature}</span>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>

          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="glass-card p-8 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">Platform Highlights</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold gradient-text mb-2">38</div>
                  <div className="text-text-secondary">Technical Indicators</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold gradient-text mb-2">21</div>
                  <div className="text-text-secondary">Timeframes</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold gradient-text mb-2">6</div>
                  <div className="text-text-secondary">Order Types</div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Download MT5 for Your Device
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {downloads.map((item, index) => (
              <ScrollRevealItem key={index}>
                <ScrollReveal variant="scaleUp" delay={index * 0.1}>
                  <Card className="text-center">
                    <item.icon className="w-16 h-16 text-primary-accent mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-4">{item.platform}</h3>
                    <a href={item.link} className="btn-primary w-full flex items-center justify-center gap-2">
                      <Download className="w-5 h-5" />
                      Download
                    </a>
                  </Card>
                </ScrollReveal>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Start Trading on MT5?</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Download MetaTrader 5 and experience next-generation trading technology.
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

export default MT5
