import TradingPageTemplate from '../components/TradingPageTemplate'

const Forex = () => {
  const data = {
    title: 'Trade Forex with Confidence',
    subtitle: 'Access 60+ currency pairs with spreads from 0.0 pips and leverage up to 1:500.',
    stats: [
      { label: 'Spread From', value: '0.0 pips' },
      { label: 'Leverage', value: '1:500' },
      { label: 'Market Hours', value: '24/5' },
      { label: 'Currency Pairs', value: '60+' }
    ],
    about: {
      title: 'What is Forex Trading?',
      description: 'Forex (foreign exchange) is the world\'s largest and most liquid financial market, with over $6 trillion traded daily. Trade major, minor, and exotic currency pairs with TrustEdgeFX and benefit from tight spreads, fast execution, and advanced trading tools. Whether you\'re a beginner or professional trader, our platform provides everything you need to succeed in the forex market.'
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
        description: 'Your funds are protected in segregated accounts with tier-1 banks and negative balance protection.'
      }
    ]
  }

  return <TradingPageTemplate {...data} />
}

export default Forex
