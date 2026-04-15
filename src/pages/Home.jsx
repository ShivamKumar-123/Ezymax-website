import HeroSection from './home/HeroSection'
import LiveMarketChartsSection from './home/LiveMarketChartsSection'
import AboutSection from './home/AboutSection'
import VisionMissionSection from './home/VisionMissionSection'
import WhySection from './home/WhySection'
import MarketsSection from './home/MarketsSection'
import PlatformSection from './home/PlatformSection'
import AccountsSection from './home/AccountsSection'
import ConditionsSection from './home/ConditionsSection'
import ToolsSection from './home/ToolsSection'
import EducationSection from './home/EducationSection'
import IslamicAccountSection from './home/IslamicAccountSection'
import PaymentsSection from './home/PaymentsSection'
import PartnerProgramSection from './home/PartnerProgramSection'
import SecuritySection from './home/SecuritySection'
import StartTradingSection from './home/StartTradingSection'
import BottomSection from './home/BottomSection'

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
      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Live Market Charts */}
      <LiveMarketChartsSection />

      {/* 3. About */}
      <AboutSection />

      {/* 4. Vision Mission Values */}
      <VisionMissionSection />

      {/* 5. Why Choose */}
      <WhySection />

      {/* 6. Markets */}
      <MarketsSection />

      {/* 7. Platform */}
      <PlatformSection />

      {/* 8. Accounts */}
      <AccountsSection />

      {/* 9. Conditions */}
      <ConditionsSection />

      {/* 10. Tools */}
      <ToolsSection />

      {/* 11. Education */}
      <EducationSection />

      {/* 12. Islamic Account */}
      <IslamicAccountSection />

      {/* 13. Payments */}
      <PaymentsSection />

      {/* 14. Partner Program */}
      <PartnerProgramSection />

      {/* 15. Security */}
      <SecuritySection />

      {/* 16. Start Trading */}
      <StartTradingSection />

      {/* 17. Bottom (Testimonials + FAQ + CTA) */}
      <BottomSection />
    </div>
  )
}

export default Home
