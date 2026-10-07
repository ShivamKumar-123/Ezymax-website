/* NOTE: this file is currently unreferenced (legacy Vite landing). Regulatory, custody, insurance and client-count claims were removed from it: Ezymex holds no licence, and the figures/addresses here came from the template this site was built from. Do not re-add any of them without the licence number, the audited figure or the real address behind it. */
import TradingPageTemplate from '../components/TradingPageTemplate'
import { BRAND_NAME } from '@/lib/brand'

const Forex = () => {
  const data = {
    title: 'Trade Forex with Confidence',
    subtitle: 'Access 60+ currency pairs with spreads from 0.0 pips and leverage up to 1:500.',
    stats: [
      { label: 'Spread From', value: '0.0 pips' },
      { label: 'Leverage', value: '1:500' },
      { label: 'Market Hours', value: '24/7' },
      { label: 'Currency Pairs', value: '60+' }
    ],
    about: {
      title: 'What is Forex Trading?',
      description: `Forex (foreign exchange) is the world's largest and most liquid financial market, with over $6 trillion traded daily. Trade major, minor, and exotic currency pairs with ${BRAND_NAME} and benefit from tight spreads, fast execution, and advanced trading tools. Whether you're a beginner or professional trader, our platform provides everything you need to succeed in the forex market.`
    },
    instruments: [
      { symbol: 'EUR/USD', spread: '0.0 pips', leverage: '1:500', margin: '0.2%' },
      { symbol: 'GBP/USD', spread: '0.1 pips', leverage: '1:500', margin: '0.2%' },
      { symbol: 'USD/JPY', spread: '0.1 pips', leverage: '1:500', margin: '0.2%' },
      { symbol: 'AUD/USD', spread: '0.2 pips', leverage: '1:500', margin: '0.2%' },
      { symbol: 'USD/CHF', spread: '0.2 pips', leverage: '1:500', margin: '0.2%' },
      { symbol: 'EUR/GBP', spread: '0.3 pips', leverage: '1:500', margin: '0.2%' }
    ],
    benefits: [
      {
        icon: '⚡',
        title: 'Lightning-Fast Execution',
        description: 'Execute trades in under 30ms with our institutional-grade infrastructure and zero requotes.'
      },
      {
        icon: '💰',
        title: 'Competitive Spreads',
        description: 'Enjoy spreads from 0.0 pips on major pairs and transparent pricing with no hidden fees.'
      },
      {
        icon: '🔒',
        title: 'Secure Trading',
        description: 'Margin call at 80% and stop-out at 50% are enforced server-side, so an account is closed out before it runs past its balance.'
      }
    ]
  }

  return <TradingPageTemplate {...data} />
}

export default Forex
