import { Link } from 'react-router-dom'
import { ArrowRight, Zap, TrendingDown, Lock, BarChart3, CreditCard, Globe, Monitor, Smartphone } from 'lucide-react'
import Button from '../components/Button'
import StatBox from '../components/StatBox'
import FeatureCard from '../components/FeatureCard'
import PlatformCard from '../components/PlatformCard'
import HeroScrollCanvas from '../components/HeroScrollCanvas'
import HeroOverlay from '../components/HeroOverlay'

const Home = () => {
  const features = [
    {
      icon: Zap,
      title: 'Ultra-Fast Execution',
      description: 'Orders executed in under 30ms with zero requotes.'
    },
    {
      icon: TrendingDown,
      title: 'Tight Spreads',
      description: 'Spreads from 0.0 pips on major currency pairs.'
    },
    {
      icon: Lock,
      title: 'Secure & Regulated',
      description: 'Client funds held in segregated accounts. Fully licensed.'
    },
    {
      icon: BarChart3,
      title: 'Advanced Charting',
      description: 'Integrated TradingView charts with 100+ indicators.'
    },
    {
      icon: CreditCard,
      title: 'Easy Deposits',
      description: 'Fund your account via card, bank wire, or crypto instantly.'
    },
    {
      icon: Globe,
      title: 'Trade Anywhere',
      description: 'Available on web, desktop, iOS and Android.'
    }
  ]

  const platforms = [
    {
      name: 'MetaTrader 4 (MT4)',
      description: "Industry's most popular trading platform",
      features: [
        '30+ built-in indicators, Expert Advisors support',
        'Available on Windows, macOS, iOS, Android',
        'One-click trading and advanced charting'
      ],
      cta: 'Download MT4',
      ctaLink: '/platforms/mt4',
      icon: Monitor
    },
    {
      name: 'MetaTrader 5 (MT5)',
      description: 'Next-gen platform with enhanced tools',
      features: [
        'Multi-asset trading, depth of market view',
        'Advanced algorithmic trading capabilities',
        '38 technical indicators + 21 timeframes'
      ],
      cta: 'Download MT5',
      ctaLink: '/platforms/mt5',
      icon: BarChart3
    },
    {
      name: 'TrustEdgeFX Web Platform',
      description: 'No download needed — trade from any browser',
      features: [
        'Clean UI, real-time charts, one-click trading',
        'Seamlessly synced with your account',
        'Mobile-optimized for trading on the go'
      ],
      cta: 'Launch Web Platform',
      ctaLink: '/platforms/web',
      icon: Smartphone
    }
  ]

  return (
    <div className="min-h-screen">
      {/* HERO SECTION — Scroll-linked canvas animation */}
      <div className="relative">
        <HeroScrollCanvas />
        <HeroOverlay />
      </div>

      {/* TRUST / STATS SECTION */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-primary-bg mb-16">
            Trusted by Traders Worldwide
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatBox value="500000+" label="Active Traders" />
            <StatBox value="2.3B+" label="Daily Trading Volume" />
            <StatBox value="1000+" label="Tradable Instruments" />
            <StatBox value="15+" label="Years Market Experience" />
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 text-primary-bg">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <span className="font-semibold">Top-Rated on Trustpilot 4.8</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-primary-accent" />
              <span className="font-semibold">Regulated by FCA & CySEC</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary-accent" />
              <span className="font-semibold">24/7 Dedicated Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <div className="text-center mb-16">
            <div className="inline-block text-primary-accent text-sm font-semibold mb-4 tracking-wider uppercase">
              Why Choose TrustEdgeFX
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Everything You Need to Trade Like a Pro
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
          
          <div className="text-center">
            <Link to="/company/why-trustedge" className="inline-flex items-center gap-2 text-primary-accent hover:text-white transition-colors font-semibold text-lg">
              Explore All Features
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* PLATFORMS SECTION */}
      <section className="section-padding bg-gray-100">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary-bg mb-6">
              Powerful Platforms. Built for Every Trader.
            </h2>
            <p className="text-xl text-gray-500 max-w-3xl mx-auto">
              Choose your preferred platform — from industry-standard MetaTrader to our sleek Web Platform.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {platforms.map((platform, index) => (
              <PlatformCard key={index} {...platform} light />
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="section-padding bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-accent/20 to-primary-purple/20 blur-3xl"></div>
        </div>
        
        <div className="container-custom relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Start Your Trading Journey?
          </h2>
          <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
            Join over 500,000 traders and access global markets in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/accounts/demo">
              <Button variant="primary" className="w-full sm:w-auto">
                Open Account
              </Button>
            </Link>
            <Link to="/accounts/demo">
              <Button variant="ghost" className="w-full sm:w-auto">
                Try Demo First
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
