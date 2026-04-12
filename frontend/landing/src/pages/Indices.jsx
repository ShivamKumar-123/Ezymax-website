import TradingPageTemplate from '../components/TradingPageTemplate'

const Indices = () => {
  const data = {
    title: 'Trade the World\'s Top Indices',
    subtitle: 'Get exposure to US500, UK100, GER40 and more with low margin requirements.',
    stats: [
      { label: 'Spread From', value: '0.4 pips' },
      { label: 'Leverage', value: '1:200' },
      { label: 'Indices', value: '20+' },
      { label: 'Market Hours', value: '24/5' }
    ],
    about: {
      title: 'What are Index CFDs?',
      description: 'Index trading allows you to speculate on the performance of entire markets or sectors without buying individual stocks. Trade popular indices like the S&P 500, NASDAQ 100, FTSE 100, and DAX 40 with TrustEdgeFX. Benefit from lower margin requirements, extended trading hours, and the ability to go long or short on market movements.'
    },
    instruments: [
      { symbol: 'US500 (S&P 500)', spread: '0.4 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'NAS100 (NASDAQ)', spread: '0.6 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'UK100 (FTSE 100)', spread: '0.8 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'GER40 (DAX 40)', spread: '0.8 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'JPN225 (Nikkei)', spread: '1.0 pips', leverage: '1:200', margin: '0.5%' },
      { symbol: 'AUS200 (ASX 200)', spread: '1.0 pips', leverage: '1:200', margin: '0.5%' }
    ],
    benefits: [
      {
        icon: '🌍',
        title: 'Global Market Access',
        description: 'Trade major indices from the US, Europe, Asia, and Australia all from one platform.'
      },
      {
        icon: '📈',
        title: 'Low Margin Requirements',
        description: 'Access large market positions with competitive margin rates and flexible leverage up to 1:200.'
      },
      {
        icon: '⏰',
        title: 'Extended Trading Hours',
        description: 'Trade indices nearly 24/5 with access to both cash and futures contracts.'
      }
    ]
  }

  return <TradingPageTemplate {...data} />
}

export default Indices
