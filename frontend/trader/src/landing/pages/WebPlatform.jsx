import { Link } from 'react-router-dom'
import { Check, Globe, Zap, BarChart3, Bell } from 'lucide-react'
import Button from '../components/Button'
import FeatureCard from '../components/FeatureCard'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const WebPlatform = () => {
  const features = [
    {
      icon: Globe,
      title: 'Browser-Based Trading',
      description: 'No downloads required. Access your account from any device with a web browser.'
    },
    {
      icon: BarChart3,
      title: 'TradingView Integration',
      description: 'Full TradingView chart integration with 100+ indicators and drawing tools.'
    },
    {
      icon: Zap,
      title: 'One-Click Execution',
      description: 'Execute trades instantly with our lightning-fast order execution system.'
    },
    {
      icon: Bell,
      title: 'Real-Time Alerts',
      description: 'Set price alerts and get instant notifications on market movements.'
    }
  ]

  const highlights = [
    'Full TradingView chart integration',
    'One-click order execution',
    'Real-time news feed',
    'Portfolio & margin tracker',
    'Mobile-optimized interface',
    'Advanced order types',
    'Watchlist management',
    'Trade history & analytics',
    'Multi-language support',
    'Secure SSL encryption'
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              TrustEdgeFX Web Platform — Trade Instantly, Anywhere
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              No download required. Launch the platform from any browser and start trading in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="primary" icon>Launch Platform</Button>
              <Link to="/accounts/demo">
                <Button variant="ghost">Try Demo Account</Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Everything You Need in One Platform
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <ScrollRevealItem key={index}>
                <FeatureCard {...feature} />
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal variant="fadeLeft">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Professional Trading, Simplified
                </h2>
                <p className="text-text-secondary text-lg mb-8">
                  Our web platform combines powerful features with an intuitive interface. Whether you're a beginner or experienced trader, you'll find everything you need to succeed.
                </p>
                <div className="space-y-3">
                  {highlights.map((highlight, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-primary-accent flex-shrink-0 mt-1" />
                      <span className="text-text-secondary">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeRight" delay={0.2}>
              <div className="glass-card overflow-hidden">
                <div className="aspect-video rounded-t-lg overflow-hidden">
                  <img src="/images/image2.png" alt="TrustEdgeFX Web Platform" className="w-full h-full object-cover" />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Access Anywhere</h3>
                  <p className="text-text-secondary mb-6">
                    Trade from your desktop, laptop, tablet, or smartphone. Your account syncs seamlessly across all devices.
                  </p>
                  <Button variant="primary" className="w-full" icon>Launch Web Platform</Button>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Start Trading in Seconds</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              No downloads, no installations. Just open your browser and start trading.
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

export default WebPlatform
