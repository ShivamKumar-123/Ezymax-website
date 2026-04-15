import TradingPageTemplate from '../components/TradingPageTemplate'

const Commodities = () => {
  const data = {
    title: 'Trade Gold, Oil & More',
    subtitle: 'Diversify your portfolio with top global commodities at competitive rates.',
    stats: [
      { label: 'Spread From', value: '0.3 pips' },
      { label: 'Leverage', value: '1:200' },
      { label: 'Instruments', value: '15+' },
      { label: 'Market Hours', value: '23/5' }
    ],
    about: {
      title: 'Why Trade Commodities?',
      description: 'Commodities offer excellent diversification opportunities and act as a hedge against inflation. Trade precious metals like gold and silver, energy commodities like crude oil and natural gas, and agricultural products with TrustEdgeFX. Benefit from competitive spreads, flexible leverage, and access to global commodity markets 23 hours a day.'
    },
    instruments: [
      { symbol: 'XAU/USD (Gold)', spread: '0.3 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'XAG/USD (Silver)', spread: '0.5 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'WTI Crude Oil', spread: '3.0 pips', leverage: '1:100', margin: '1.0%' },
      { symbol: 'Brent Oil', spread: '3.0 pips', leverage: '1:100', margin: '1.0%' },
      { symbol: 'Natural Gas', spread: '0.5 pips', leverage: '1:100', margin: '1.0%' },
      { symbol: 'Copper', spread: '0.8 pips', leverage: '1:100', margin: '1.0%' }
    ],
    benefits: [
      {
        icon: '🥇',
        title: 'Trade Precious Metals',
        description: 'Access gold, silver, platinum, and palladium with tight spreads and flexible leverage options.'
      },
      {
        icon: '⛽',
        title: 'Energy Markets',
        description: 'Trade WTI and Brent crude oil, natural gas, and other energy commodities with real-time pricing.'
      },
      {
        icon: '📊',
        title: 'Portfolio Diversification',
        description: 'Hedge against market volatility and inflation by adding commodities to your trading portfolio.'
      }
    ]
  }

  return <TradingPageTemplate {...data} />
}

export default Commodities
