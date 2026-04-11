import { Link } from 'react-router-dom'
import { Download, Monitor, Smartphone, Tablet, Check } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const MT4 = () => {
  const features = [
    'Expert Advisors (EA) & Automated Trading',
    '30 built-in technical indicators',
    '9 chart timeframes',
    'One-click trading',
    'Strategy Tester',
    'Real-time market quotes',
    'Advanced charting tools',
    'Custom indicators support',
    'Multi-language interface',
    'Email & push notifications'
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
              MetaTrader 4 — The World's #1 Trading Platform
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Powerful, fast, and feature-rich. MT4 gives you everything you need to trade Forex and CFDs.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Why Choose MetaTrader 4?
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
                  <div className="text-4xl font-bold gradient-text mb-2">30+</div>
                  <div className="text-text-secondary">Technical Indicators</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold gradient-text mb-2">9</div>
                  <div className="text-text-secondary">Timeframes</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold gradient-text mb-2">∞</div>
                  <div className="text-text-secondary">Custom EAs</div>
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
              Download MT4 for Your Device
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
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Start Trading on MT4?</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Download MetaTrader 4 and connect to your TrustEdgeFX account in minutes.
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

export default MT4
